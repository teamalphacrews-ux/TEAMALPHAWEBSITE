import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Search,X,Loader2} from 'lucide-react';
import {OperationsModal} from '../operations/OperationsUI';
import {useAuth} from '../../../context/AuthContext';
import API from '../../../utils/apiConfig';
const labels={contacts:'Contacts',projects:'Projects',enquiries:'Enquiries',quotations:'Quotations',invoices:'Invoices'};
export default function WorkspaceRecordSearch(){
 const {user}=useAuth(),location=useLocation();
 return <RecordSearch key={String(user?._id||user?.id||'')+':'+String(user?.workspace?.id||user?.workspace?._id||'legacy')+location.pathname+location.search}/>;
}
function RecordSearch(){
 const {token,user}=useAuth();
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[groups,setGroups]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const session=String(user?.workspace?.id||user?.workspace?._id||'legacy')+':'+String(user?._id||user?.id||'');
 const active=useRef(0);
 useEffect(()=>{
   const shortcut=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('[aria-modal=true]')){e.preventDefault();setOpen(true);}};
   window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);
 },[]);
 useEffect(()=>{
  const request=++active.current,controller=new AbortController();
  if(!open||query.trim().length<2)return()=>controller.abort();
  const timer=setTimeout(async()=>{
    setBusy(true);setError('');setGroups([]);
    try{const response=await fetch(API+'/api/studio/search?q='+encodeURIComponent(query.trim()),{headers:{Authorization:'Bearer '+token},signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'Search is unavailable.');if(active.current===request)setGroups(Array.isArray(data.groups)?data.groups:[]);}
    catch(failure){if(!controller.signal.aborted&&active.current===request)setError(failure.message);}
    finally{if(active.current===request)setBusy(false);}
  },250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[query,open,token,session]);
 return <><button className="studio-icon-button studio-record-search-trigger" type="button" aria-label="Search clients, projects and documents" onClick={()=>setOpen(true)}><Search size={18}/></button>{open&&<OperationsModal title="Search your studio" description="Find clients, projects, enquiries and documents." onClose={()=>setOpen(false)}>
  <label className="studio-search"><Search size={18}/><input type="search" data-autofocus aria-label="Search workspace records" placeholder="Name, phone, quote or invoice…" value={query} maxLength={80} onChange={e=>{setQuery(e.target.value);setGroups([]);setError('');setBusy(e.target.value.trim().length>=2);}}/>{query&&<button type="button" className="studio-icon-button" aria-label="Clear record search" onClick={()=>{setQuery('');setBusy(false);setGroups([]);}}><X size={15}/></button>}</label>
  <div className="studio-record-results" role="status">{busy?<p><Loader2 size={16}/>Searching your studio…</p>:error?<p className="studio-error">{error}</p>:query.trim().length<2?<p className="studio-muted">Enter at least two characters.</p>:groups.every(group=>!group.results?.length)?<p className="studio-muted">No matching records. Try another name or document number.</p>:groups.filter(group=>group.results?.length).map(group=><section key={group.kind}><h3>{labels[group.kind]||'Records'}</h3>{group.results.map(row=><Link key={row.id} to={row.path} onClick={()=>setOpen(false)}><strong>{row.label}</strong><small>{row.subtitle}</small></Link>)}</section>)}</div>
 </OperationsModal>}</>;
}
