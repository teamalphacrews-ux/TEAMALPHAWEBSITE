export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_LOCAL_DRAFTS = 50;
export const MAX_DRAFT_BYTES = 128 * 1024;
const fields = {
  enquiry: ['name','email','phone','status','eventType','eventDate','eventTime','eventLocation','followUpDate','remarks','notes','totalAmount'],
  quotation: ['clientName','email','lead','contactId','studioProjectId','title','documentNumber','issueDate','validUntil','items','discountType','discountValue','discountPaise','taxRateBps','terms','notes','autoCreateInvoice','expiryEnabled','remindersEnabled','reminderDays','design'],
  'project-note': ['body'],
};
export function draftScope(user) {
  const account = String(user?._id || user?.id || '');
  const studio = String(typeof user?.workspace === 'string' ? user.workspace : user?.workspace?._id || user?.workspace?.id || 'legacy');
  return /^[a-zA-Z0-9_-]{1,100}$/.test(account) && /^[a-zA-Z0-9_-]{1,100}$/.test(studio) ? account + ':' + studio : '';
}
export function cleanDraft(kind, value) {
  if (!fields[kind] || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This draft type is unavailable.');
  const result = Object.fromEntries(fields[kind].filter(key => Object.hasOwn(value,key)).map(key => [key,value[key]]));
  if (kind === 'quotation') {
    if (result.items && (!Array.isArray(result.items) || result.items.some(row=>!row || typeof row!=='object' || Array.isArray(row)))) throw new Error('Invalid quotation items in local draft.');
    if (result.design && (typeof result.design!=='object' || Array.isArray(result.design))) throw new Error('Invalid quotation design in local draft.');
    if (result.items) result.items = result.items.slice(0,100).map(row => Object.fromEntries(['title','description','quantity','unitPricePaise'].filter(key => Object.hasOwn(row,key)).map(key => [key,row[key]])));
    if (result.design) result.design = Object.fromEntries(['colorTheme','fontTheme'].filter(key => Object.hasOwn(result.design,key)).map(key => [key,result.design[key]]));
  }
  const text = JSON.stringify(result, (key,item) => /token|password|secret|authorization|cloudlink/i.test(key) ? undefined : item);
  if (new TextEncoder().encode(text).length > MAX_DRAFT_BYTES) throw new Error('This draft is too large to keep on this device.');
  return JSON.parse(text);
}
export function draftRoute(kind, recordId='new') {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(recordId)) return '';
  if (kind === 'enquiry') return recordId === 'new' ? '/admin/crm?new=1' : '/admin/crm?lead=' + encodeURIComponent(recordId);
  if (kind === 'quotation') return recordId === 'new' ? '/admin/quotations?new=1' : '/admin/quotations?quote=' + encodeURIComponent(recordId);
  if (kind === 'project-note' && recordId !== 'new') return '/admin/studio-projects/' + encodeURIComponent(recordId) + '?tab=overview';
  return '';
}
export function createDraftVault({adapter,crypto=globalThis.crypto,now=Date.now}) {
  let generation=0;
  const locks=new Map(), revisions=new Map();
  const valid=(scope,kind,recordId) => {
    if (!scope || !/^[a-zA-Z0-9_-]{1,100}:[a-zA-Z0-9_-]{1,100}$/.test(scope) || !fields[kind] || !/^[a-zA-Z0-9_-]{1,100}$/.test(recordId)) throw new Error('Sign in to a studio to keep a local draft.');
  };
  const keyFor=async scope => {
    if (!crypto?.subtle || !crypto?.getRandomValues) throw new Error('Encrypted local drafts are unavailable in this browser.');
    const id=scope+':key';
    if (locks.has(id)) return locks.get(id);
    const promise=(async()=>{
      const existing=await adapter.get(id);
      if (existing?.key) return existing.key;
      const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const record={id,scope,type:'key',key};
      if(adapter.ensureKey)return (await adapter.ensureKey(id,record)).key;
      await adapter.set(id,record);return key;
    })();
    locks.set(id,promise);
    try {return await promise;} finally {locks.delete(id);}
  };
  const idFor=(scope,kind,recordId)=>scope+':draft:'+kind+':'+recordId;
  const remove=async(scope,kind,recordId='new')=>{valid(scope,kind,recordId);const id=idFor(scope,kind,recordId);revisions.set(id,(revisions.get(id)||0)+1);await adapter.delete(id);};
  const save=async(scope,kind,recordId='new',value,uncertain=false)=>{
    valid(scope,kind,recordId);
    const snapshot=generation,payload=cleanDraft(kind,value),id=idFor(scope,kind,recordId),revision=revisions.get(id)||0;
    const rows=await adapter.list();
    if(!rows.some(row=>row.id===id)&&rows.filter(row=>row.scope===scope&&row.type==='draft'&&row.expiresAt>now()).length>=MAX_LOCAL_DRAFTS)throw new Error('This studio has 50 local drafts. Remove an old draft in Offline drafts before saving another.');
    const key=await keyFor(scope);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(JSON.stringify(payload)));
    if(snapshot!==generation||revision!==(revisions.get(id)||0)) throw new Error('Your studio changed. This draft was not saved.');
    const updatedAt=now();
    await adapter.set(id,{id,scope,kind,recordId,updatedAt,expiresAt:updatedAt+DRAFT_TTL_MS,uncertain:Boolean(uncertain),type:'draft',iv,ciphertext});
    if(snapshot!==generation||revision!==(revisions.get(id)||0)){await adapter.delete(id);throw new Error('Your studio changed. This draft was not saved.');}
    return {updatedAt};
  };
  const decrypt=async(row,scope)=>{
    if(!row||row.scope!==scope||row.type!=='draft') return null;
    if(!fields[row.kind]||!/^[a-zA-Z0-9_-]{1,100}$/.test(row.recordId)||row.id!==idFor(scope,row.kind,row.recordId)||!Number.isFinite(row.updatedAt)||!Number.isFinite(row.expiresAt)||row.expiresAt<=row.updatedAt||row.expiresAt-row.updatedAt>DRAFT_TTL_MS||row.expiresAt<=now()){await adapter.delete(row.id);return null;}
    try{
      const stored=await adapter.get(scope+':key');
      if(!stored?.key) throw new Error('Missing local key');
      const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv,additionalData:new TextEncoder().encode(row.id)},stored.key,row.ciphertext);
      return {kind:row.kind,recordId:row.recordId,updatedAt:row.updatedAt,expiresAt:row.expiresAt,uncertain:row.uncertain,value:cleanDraft(row.kind,JSON.parse(new TextDecoder().decode(bytes)))};
    }catch{await adapter.delete(row.id);return null;}
  };
  const read=async(scope,kind,recordId='new')=>{valid(scope,kind,recordId);return decrypt(await adapter.get(idFor(scope,kind,recordId)),scope);};
  const list=async scope=>{if(!scope)return [];const rows=await adapter.list();return (await Promise.all(rows.filter(row=>row.scope===scope&&row.type==='draft').map(row=>decrypt(row,scope)))).filter(Boolean).sort((a,b)=>b.updatedAt-a.updatedAt);};
  const purge=async scope=>{generation++;await Promise.allSettled([...locks.values()]);const rows=await adapter.list();await Promise.all(rows.filter(row=>!scope||row.scope===scope).map(row=>adapter.delete(row.id)));};
  return {save,read,list,remove,purge};
}
let opening;
function database(){
  if(!globalThis.indexedDB)return Promise.reject(new Error('Encrypted local drafts are unavailable on this device.'));
  opening ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open('studio-os-local-drafts',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('vault',{keyPath:'id'});
    request.onerror=()=>{opening=null;reject(new Error('Local draft storage could not be opened.'));};
    request.onblocked=()=>{opening=null;reject(new Error('Close other Studio OS tabs and retry local drafts.'));};
    request.onsuccess=()=>resolve(request.result);
  });
  return opening;
}
async function ensureDeviceKey(id,record){
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite'),store=tx.objectStore('vault');let chosen;const request=store.get(id);
 request.onsuccess=()=>{chosen=request.result?.key?request.result:record;if(!request.result?.key)store.put(record);};
 tx.oncomplete=()=>resolve(chosen);tx.onerror=tx.onabort=()=>reject(new Error('The local encryption key could not be stored.'));});
}
async function transact(mode,action){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('vault',mode),request=action(tx.objectStore('vault'));tx.oncomplete=()=>resolve(request?.result);tx.onerror=tx.onabort=()=>reject(new Error('This device could not store the draft. Check available storage.'));});}
export const deviceDrafts=createDraftVault({adapter:{ensureKey:ensureDeviceKey,get:id=>transact('readonly',store=>store.get(id)),set:(_id,value)=>transact('readwrite',store=>store.put(value)),delete:id=>transact('readwrite',store=>store.delete(id)),list:()=>transact('readonly',store=>store.getAll())}});
export const clearLocalDrafts=scope=>deviceDrafts.purge(scope).catch(()=>{});
