import API from '../utils/apiConfig';
export const nativeDeviceAvailable=()=>typeof window!=='undefined'&&typeof window.StudioOSNative?.deviceStatus==='function';
export const deviceWorkspace=user=>String(user?.workspace?._id||user?.workspace?.id||'legacy');
export const pushPreferenceKey=user=>'studio-native-push-enabled:'+String(user?._id||user?.id||'')+':'+deviceWorkspace(user);
export function nativeNotificationPath(value){
 if(typeof value!=='string'||value.length>600||/[\\\r\n]/.test(value))return '';
 try{const u=new URL(value,'https://studio.invalid');return u.origin==='https://studio.invalid'&&/^\/admin(?:\/(?:crm|studio-projects|quotations|invoices|calendar|post-production|chats|finance|activity-log)(?:\/[a-f\d]{24}|\/new)?)?$/.test(u.pathname)?u.pathname+u.search:'';}catch{return '';}
}
let writeTail=Promise.resolve();
export async function deviceRequest(path,token,method='GET',body,signal){
 const write=['POST','DELETE'].includes(method);
 const perform=async()=>{
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const response=await fetch(API+'/api/studio/devices'+path,{method,...(!write?{signal:signal||AbortSignal.timeout(6000)}:{}),headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Device settings could not be updated.');return data;
 };
 if(!write)return perform();const pending=writeTail.then(perform,perform);writeTail=pending.catch(()=>{});return pending;
}
export async function disconnectNativeDevice(token){
 if(!token||!nativeDeviceAvailable())return;
 try{const status=await window.StudioOSNative.deviceStatus();if(status.installationId)await deviceRequest('/'+encodeURIComponent(status.installationId),token,'DELETE');}catch{/* Session invalidation also prevents delivery after sign-out. */}
}
