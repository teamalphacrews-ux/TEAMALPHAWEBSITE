import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudOff, FileClock, RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { deviceDrafts, draftScope, draftRoute, clearLocalDrafts } from './draftVault';
import './offlineDrafts.css';
const Context=createContext(null);
const changed=()=>window.dispatchEvent(new Event('studio-drafts-changed'));
export function OfflineDraftsProvider({children}) {
  const {user}=useAuth();
  const scope=draftScope(user), previous=useRef(scope);
  const [online,setOnline]=useState(()=>navigator.onLine);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  useEffect(()=>{if(previous.current&&previous.current!==scope)clearLocalDrafts(previous.current);previous.current=scope;},[scope]);
  return <Context.Provider value={{scope,online}}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components -- Shared private provider context.
export function useOfflineDraft({kind,recordId='new',value,dirty=false,enabled=true,onRestore}){
 const context=useContext(Context),scope=context?.scope||'',online=context?.online??navigator.onLine,identity=scope+':'+kind+':'+recordId;
 const empty=()=>({identity,candidate:null,ready:false,status:'loading',error:'',savedAt:null});
 const [state,setState]=useState(empty),current=state.identity===identity?state:empty();
 const latest=useRef(value),restoreCallback=useRef(onRestore),requestVersion=useRef(0),writeVersion=useRef(0),writeQueue=useRef(Promise.resolve()),suspended=useRef(false),uncertain=useRef(false),lastSignature=useRef('');
 const signature=JSON.stringify(value);
 useEffect(()=>{latest.current=value;restoreCallback.current=onRestore;},[value,onRestore]);
 useEffect(()=>{if(lastSignature.current!==signature){suspended.current=false;lastSignature.current=signature;}},[signature]);
 useEffect(()=>{
  const guard=requestVersion,sequence=++guard.current;uncertain.current=false;let active=true;
  Promise.resolve().then(async()=>{if(!active)return;if(!scope||!enabled){setState({identity,candidate:null,ready:false,status:'idle',error:'',savedAt:null});return;}
   try{const candidate=await deviceDrafts.read(scope,kind,recordId);if(!active||guard.current!==sequence)return;uncertain.current=Boolean(candidate?.uncertain);setState({identity,candidate,ready:true,status:candidate?'recoverable':'idle',error:'',savedAt:candidate?.updatedAt||null});}
   catch(failure){if(active&&guard.current===sequence)setState({identity,candidate:null,ready:false,status:'unavailable',error:failure.message,savedAt:null});}
  });return()=>{active=false;guard.current++;};
 },[identity,scope,kind,recordId,enabled]);
 const saveNow=useCallback(async(markUncertain=false)=>{
  if(!scope||!enabled||!current.ready||current.candidate||suspended.current)return false;
  const sequence=requestVersion.current,write=++writeVersion.current,snapshot=latest.current;
  if(markUncertain)uncertain.current=true;const unknown=uncertain.current;
  setState(previous=>previous.identity===identity?{...previous,status:'saving',error:''}:previous);
  const task=writeQueue.current.catch(()=>{}).then(()=>{if(sequence!==requestVersion.current||suspended.current)throw new Error('This draft is no longer open.');return deviceDrafts.save(scope,kind,recordId,snapshot,unknown);});writeQueue.current=task.then(()=>{},()=>{});
  try{const result=await task;if(sequence!==requestVersion.current)return false;if(write===writeVersion.current)setState(previous=>previous.identity===identity?{...previous,savedAt:result.updatedAt,status:unknown?'uncertain':'local',error:''}:previous);changed();return true;}
  catch(failure){if(sequence===requestVersion.current&&write===writeVersion.current)setState(previous=>previous.identity===identity?{...previous,status:'unavailable',error:failure.message}:previous);return false;}
 },[scope,kind,recordId,enabled,current.ready,current.candidate,identity]);
 useEffect(()=>{if(!current.ready||!dirty||current.candidate||!enabled||suspended.current)return;const timer=setTimeout(()=>{saveNow();},700);return()=>clearTimeout(timer);},[current.ready,current.candidate,dirty,enabled,signature,saveNow]);
 const clear=async()=>{suspended.current=true;const sequence=++requestVersion.current;writeVersion.current++;await writeQueue.current;await deviceDrafts.remove(scope,kind,recordId);if(sequence!==requestVersion.current)return;uncertain.current=false;setState({identity,candidate:null,ready:true,status:'synced',error:'',savedAt:null});changed();};
 const restore=()=>{if(!current.candidate)return;uncertain.current=Boolean(current.candidate.uncertain);restoreCallback.current?.(current.candidate.value);setState({identity,candidate:null,ready:true,status:current.candidate.uncertain?'uncertain':'local',savedAt:current.candidate.updatedAt,error:''});};
 const discard=async()=>{try{suspended.current=true;const sequence=++requestVersion.current;writeVersion.current++;await writeQueue.current;await deviceDrafts.remove(scope,kind,recordId);if(sequence!==requestVersion.current)return;uncertain.current=false;setState({identity,candidate:null,ready:true,status:'idle',savedAt:null,error:''});changed();}catch(failure){setState(previous=>previous.identity===identity?{...previous,error:failure.message}:previous);}};
 return {...current,online,restore,discard,saveNow,clear,markUncertain:()=>saveNow(true),enabled:Boolean(scope&&enabled)};
}
export function OfflineDraftStatus({draft}) {
  if(!draft.enabled)return null;
  const messages={loading:'Checking for a local draft…',idle:'Edits can be kept on this device.',saving:'Saving a local draft…',local:'Draft saved on this device. It has not been sent.',synced:'Saved to your studio.',uncertain:'The last submission could not be confirmed. Check your studio records before submitting again.',unavailable:'Local draft storage is unavailable.'};
  return <aside className={'studio-offline-draft is-'+draft.status}>
    <div className="studio-offline-draft-title"><CloudOff size={16}/><strong>{draft.candidate?'Continue your saved draft?':draft.online?'Local draft':'You’re offline'}</strong></div>
    {draft.candidate?<><p>A draft from {new Date(draft.candidate.updatedAt).toLocaleString()} is available on this device. Restoring replaces the fields in this form.{draft.candidate.uncertain?' Its last submission was not confirmed. Check for an existing record before creating another.':''}</p><div><button type="button" className="studio-button small" onClick={draft.restore}>Restore draft</button><button type="button" className="studio-button small" onClick={draft.discard}>Discard local draft</button></div></>:<p role="status">{messages[draft.status]||messages.idle}</p>}
    {draft.error&&<p role="alert">{draft.error}</p>}
    {!draft.candidate&&draft.status!=='synced'&&<button type="button" className="studio-button small" onClick={()=>draft.saveNow()} disabled={!draft.ready||draft.status==='saving'}>Save on this device</button>}
  </aside>;
}
const kindLabel={enquiry:'Enquiry',quotation:'Quotation','project-note':'Project note'};
export function OfflineDraftsHub(){
 const context=useContext(Context),scope=context?.scope||'';
 const [state,setState]=useState({scope:'',rows:[],error:'',loading:true}),requestVersion=useRef(0);
 const load=useCallback(async()=>{const sequence=++requestVersion.current;setState({scope,rows:[],error:'',loading:true});try{const rows=await deviceDrafts.list(scope);if(sequence===requestVersion.current)setState({scope,rows,error:'',loading:false});}catch(failure){if(sequence===requestVersion.current)setState({scope,rows:[],error:failure.message,loading:false});}},[scope]);
 useEffect(()=>{const guard=requestVersion;let active=true;Promise.resolve().then(()=>{if(active)load();});window.addEventListener('studio-drafts-changed',load);return()=>{active=false;guard.current++;window.removeEventListener('studio-drafts-changed',load);};},[load]);
 const remove=async row=>{if(!window.confirm('Delete this local draft? Saved studio records will stay.'))return;try{await deviceDrafts.remove(scope,row.kind,row.recordId);changed();}catch(failure){setState(previous=>previous.scope===scope?{...previous,error:failure.message}:previous);}};
 const {rows,error,loading}=state.scope===scope?state:{rows:[],error:'',loading:true};
 return <div className="studio-offline-hub"><div className="studio-page-heading"><div><h1>Offline drafts</h1><p>Continue work you kept on this device.</p></div><button type="button" className="studio-button" onClick={load}><RefreshCw size={15}/>Refresh</button></div><p className="studio-muted">Drafts expire after 7 days and are removed when you sign out or switch studios. Reconnect and review each draft before submitting; nothing is sent automatically.</p>{error&&<p className="studio-error" role="alert">{error}</p>}{loading?<p role="status">Loading local drafts…</p>:rows.length?<div className="studio-offline-list">{rows.map(row=><article key={row.kind+':'+row.recordId}><FileClock size={22}/><div><h2>{kindLabel[row.kind]}</h2><p>{row.value.name||row.value.clientName||row.value.title||'Unsaved project note'}</p><small>Saved {new Date(row.updatedAt).toLocaleString()}{row.uncertain?' · Submission not confirmed':''}</small></div><Link className="studio-button" to={draftRoute(row.kind,row.recordId)}>Continue<ArrowRight size={14}/></Link><button type="button" className="studio-icon-button" aria-label={'Delete local '+kindLabel[row.kind].toLowerCase()} onClick={()=>remove(row)}><Trash2 size={16}/></button></article>)}</div>:<div className="studio-empty"><CloudOff size={25}/><p>No local drafts on this device.</p></div>}</div>;
}
