import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ShieldCheck,Bell,CloudOff,RefreshCw} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {SettingsToggle} from '../admin/components/settings/SettingsEditor';
import {SettingsGroup} from '../admin/components/settings/SettingsDisclosures';
import {nativeDeviceAvailable,deviceWorkspace,deviceRequest,nativeNotificationPath,pushPreferenceKey} from './deviceFeatures';

export function NativeDeviceBridge(){
 const {user,token}=useAuth(),navigate=useNavigate();
 const userId=String(user?._id||user?.id||''),workspaceKey=deviceWorkspace(user);
 useEffect(()=>{
  if(!token||!nativeDeviceAvailable())return;
  let active=true,revision=0;let registration;
  const refresh=async()=>{const generation=++revision;registration?.abort();registration=new AbortController();
   try{
    await window.StudioOSNative.setWorkspaceContext({userId,workspaceKey});
    const status=await window.StudioOSNative.deviceStatus();
    if(!active||generation!==revision)return;
    const server=await deviceRequest('/status',token);
    if(!active||generation!==revision)return;
    let registered=false;
    if(active&&status.pushOptIn&&localStorage.getItem(pushPreferenceKey(user))!=='false'&&server.configured&&status.pushConfigured&&status.deviceToken){
     await deviceRequest('',token,'POST',{token:status.deviceToken,installationId:status.installationId},registration.signal);registered=true;
    }
    if(active&&generation===revision){const {deviceToken:_private,...publicStatus}=status;void _private;window.dispatchEvent(new CustomEvent('studio-device-status',{detail:{...publicStatus,serverConfigured:server.configured,registered}}));}
   }catch(failure){if(active&&generation===revision&&failure.name!=='AbortError')window.dispatchEvent(new CustomEvent('studio-device-status',{detail:{error:failure.message}}));}
  };
  const open=event=>{const data=event.detail,path=nativeNotificationPath(data?.path);if(active&&path&&data.userId===userId&&data.workspaceKey===workspaceKey)navigate(path);};
  const disconnect=()=>{revision++;registration?.abort();};
  window.addEventListener('studio-device-disconnect',disconnect);
  const foreground=()=>{if(document.visibilityState==='visible')refresh();};
  window.addEventListener('studio-native:device-change',refresh);
  window.addEventListener('studio-device-refresh',refresh);
  window.addEventListener('studio-native:notification',open);
  document.addEventListener('visibilitychange',foreground);
  refresh();
  return()=>{active=false;revision++;registration?.abort();window.removeEventListener('studio-device-disconnect',disconnect);window.removeEventListener('studio-native:device-change',refresh);window.removeEventListener('studio-device-refresh',refresh);window.removeEventListener('studio-native:notification',open);document.removeEventListener('visibilitychange',foreground);};
 },[token,user,userId,workspaceKey,navigate]);
 return null;
}
export default function NativeDeviceSettings(){
 const {user,token}=useAuth(),[status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const native=nativeDeviceAvailable();
 useEffect(()=>{
  const receive=event=>{if(event.detail.error)setError(event.detail.error);else{setStatus(event.detail);setError('');}};
  window.addEventListener('studio-device-status',receive);
  if(native)window.dispatchEvent(new Event('studio-device-refresh'));
  return()=>window.removeEventListener('studio-device-status',receive);
 },[native]);
 const change=async action=>{
  setBusy(true);setError('');
  try{await action();window.dispatchEvent(new Event('studio-device-refresh'));}
  catch(failure){setError(failure.message);}
  finally{setBusy(false);}
 };
 return <div>{error&&<p className="studio-error" role="alert">{error}</p>}
  <SettingsGroup defaultOpen title="App privacy" description="Keep your studio private when you leave the iPhone app.">
   <p className="studio-muted"><ShieldCheck size={16}/> Face ID, Touch ID or your device passcode protects the app when it returns from the background.</p>
   <SettingsToggle label="Lock Studio OS" description={native?'Your iPhone asks you to authenticate before changing this setting.':'Available in the installed iOS app.'} disabled={!native||!status||busy||(!status?.canAuthenticate&&!status?.privacyLockEnabled)} value={Boolean(status?.privacyLockEnabled)} onChange={value=>change(()=>window.StudioOSNative.setPrivacyLock(value))}/>
   {native&&status&&!status.canAuthenticate&&<p className="studio-muted">Set an iPhone passcode before enabling app lock.</p>}
  </SettingsGroup>
  <SettingsGroup title="Push notifications" description="Open the exact enquiry, event or document from an alert.">
   <p className="studio-muted"><Bell size={16}/> Notification previews show a generic studio update. Client information stays inside the app.</p>
   <p role="status">{!native?'Available in the installed iOS app.':!status?'Checking this iPhone…':!status.pushConfigured||!status.serverConfigured?'Apple push configuration is required for this build and server.':status.registered?'This iPhone is connected.':status.notifications==='denied'?'Notifications are turned off in iPhone Settings.':'Connect this iPhone to receive studio updates.'}</p>
   {native&&status?.notifications==='denied'?<button type="button" className="studio-button" disabled={busy} onClick={()=>change(()=>window.StudioOSNative.openSystemSettings())}>Open iPhone Settings</button>:<button type="button" className="studio-button primary" disabled={!native||!status?.pushConfigured||!status?.serverConfigured||busy} onClick={()=>change(async()=>{const result=await window.StudioOSNative.requestNotifications();if(['authorized','provisional','ephemeral'].includes(result.notifications))localStorage.setItem(pushPreferenceKey(user),'true');})}>Enable notifications</button>}
   {status?.registered&&<button type="button" className="studio-button" disabled={busy} onClick={()=>change(async()=>{localStorage.setItem(pushPreferenceKey(user),'false');window.dispatchEvent(new Event('studio-device-disconnect'));await window.StudioOSNative.disconnectNotifications();await deviceRequest('/'+status.installationId,token,'DELETE');setStatus(previous=>({...previous,registered:false}));})}>Disconnect this iPhone</button>}
  </SettingsGroup>
  <SettingsGroup title="Offline drafts" description="Prepare work when your connection drops."><p className="studio-muted"><CloudOff size={16}/> New enquiries, quotation drafts and project notes can be kept on this device. Review and submit them when you reconnect.</p><Link className="studio-button" to="/admin/offline-drafts">Open offline drafts</Link><p className="studio-muted">Opening the app from fully closed still needs a connection. Existing client records are not downloaded for offline browsing.</p></SettingsGroup>
  {native&&<button type="button" className="studio-button" disabled={busy} onClick={()=>window.dispatchEvent(new Event('studio-device-refresh'))}><RefreshCw size={14}/>Refresh device status</button>}
 </div>;
}
