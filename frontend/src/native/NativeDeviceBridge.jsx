import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
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
