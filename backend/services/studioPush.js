const crypto=require('node:crypto'), http2=require('node:http2');
const {pushDestination}=require('../utils/pushDestination');
const categories={Lead:'enquiries',Event:'calendar',Task:'tasks',Gallery:'tasks',Finance:'finance',Invoice:'finance',Chat:'messages',Message:'messages',System:'system'};
function key(env=process.env){const s=env.PUSH_TOKEN_SECRET||env.VAULT_SECRET;if(typeof s!=='string'||s.length<32)throw Error('Push token encryption needs a stable 32-character secret.');return crypto.createHash('sha256').update(s).digest();}
function configuration(env=process.env){
 if(env.APNS_ENABLED!=='true'||!/^\w{10}$/.test(env.APNS_KEY_ID||'')||!/^\w{10}$/.test(env.APNS_TEAM_ID||'')||!/^[A-Za-z0-9.-]{3,255}$/.test(env.APNS_BUNDLE_ID||''))return null;
 try{key(env);const privateKey=crypto.createPrivateKey(String(env.APNS_PRIVATE_KEY||'').replace(/\\n/g,'\n'));if(privateKey.asymmetricKeyType!=='ec'||privateKey.asymmetricKeyDetails?.namedCurve!=='prime256v1')return null;return{privateKey,keyId:env.APNS_KEY_ID,teamId:env.APNS_TEAM_ID,topic:env.APNS_BUNDLE_ID,origin:env.APNS_SANDBOX==='true'?'https://api.sandbox.push.apple.com':'https://api.push.apple.com'};}catch{return null;}
}
function pushConfigured(env=process.env){return !!configuration(env);}
function sealToken(token,env=process.env){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(env),iv);const bytes=Buffer.concat([c.update(token,'utf8'),c.final()]);return[iv.toString('base64'),c.getAuthTag().toString('base64'),bytes.toString('base64')].join('.');}
function unsealToken(text,env=process.env){const[iv,tag,data]=String(text).split('.'),d=crypto.createDecipheriv('aes-256-gcm',key(env),Buffer.from(iv,'base64'));d.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([d.update(Buffer.from(data,'base64')),d.final()]).toString('utf8');}
let cached;
function providerToken(config,now=Date.now()){
 const fingerprint=crypto.createHash('sha256').update(config.privateKey.export({type:'pkcs8',format:'pem'})).update(config.keyId).update(config.teamId).digest('hex');
 if(cached?.fingerprint===fingerprint&&now-cached.at<50*60000)return cached.token;
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const input=encode({alg:'ES256',kid:config.keyId})+'.'+encode({iss:config.teamId,iat:Math.floor(now/1000)});
 const signature=crypto.sign('sha256',Buffer.from(input),{key:config.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');cached={fingerprint,at:now,token:input+'.'+signature};return cached.token;
}
function sendAPNs(token,payload,{env=process.env,connect=http2.connect,now=Date.now()}={}){
 const config=configuration(env);if(!config)return Promise.resolve({disabled:true});
 if(!/^[a-f\d]{64,200}$/i.test(token))return Promise.reject(Error('Invalid push token.'));
 return new Promise((resolve,reject)=>{
  const client=connect(config.origin),timer=setTimeout(()=>finish(Error('Push request timed out.')),10000);let done=false,request,status=0,body='';
  function finish(error,result){if(done)return;done=true;clearTimeout(timer);request?.close();client.close();error?reject(error):resolve(result);}
  client.once('error',error=>finish(error));
  try{
   request=client.request({':method':'POST',':path':'/3/device/'+token,authorization:'bearer '+providerToken(config,now),'apns-topic':config.topic,'apns-push-type':'alert','apns-priority':'10','apns-expiration':String(Math.floor(now/1000)+3600),'content-type':'application/json'});
   request.on('response',headers=>{status=Number(headers[':status']);});request.setEncoding('utf8');
   request.on('data',chunk=>{body+=chunk;if(body.length>8192)finish(Error('Unexpected push response.'));});
   request.on('error',error=>finish(error));request.on('end',()=>{let reason;try{reason=JSON.parse(body).reason;}catch{}finish(null,{ok:status===200,status,reason,invalid:status===410||(status===400&&['BadDeviceToken','DeviceTokenNotForTopic'].includes(reason))});});
   request.end(JSON.stringify(payload));
  }catch(error){finish(error);}
 });
}
function notificationCategory(note){if(note.type==='System'&&/^\/admin\/(quotations|invoices|finance)(?:[/?#]|$)/.test(note.link||''))return'finance';if(note.type==='System'&&/^\/admin\/(chats|email|whatsapp)(?:[/?#]|$)/.test(note.link||''))return'messages';return categories[note.type]||'system';}
function quietNow(prefs,now,studioZone='Asia/Kolkata'){
 if(!prefs.quietHoursEnabled)return false;
 const minutes=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||'')?Number(v.slice(0,2))*60+Number(v.slice(3)):null;
 const start=minutes(prefs.quietHoursStart),end=minutes(prefs.quietHoursEnd);if(start===null||end===null)return false;if(start===end)return true;
 let zone=prefs.timezone&&prefs.timezone!=='studio'?prefs.timezone:studioZone;try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();}catch{zone='Asia/Kolkata';}
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),m=Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value);return start<end?m>=start&&m<end:m>=start||m<end;
}
function payloadFor(note,device,prefs={}){return{aps:{alert:{title:'Studio OS',body:'You have new studio activity. Open the app to view it.'},category:'STUDIO_ACTIVITY',...(prefs.notificationSound===true&&prefs.notificationVolume!==0?{sound:'default'}:{})},studio:{path:pushDestination(note.link),workspaceKey:device.workspaceKey,userId:device.userId,notificationId:String(note._id)}};}
async function deliverNotification(note){
 if(!pushConfigured()||!note?._id||note.isRead)return;
 const Device=require('../models/StudioPushDevice'),{currentWorkspace}=require('../saas/tenantContext'),workspace=currentWorkspace(),workspaceKey=workspace?String(workspace._id):'legacy',db=note.constructor.db;
 const User=db.model('User'),Session=db.model('AdminSession'),Config=db.model('StudioConfig');
 const config=await Config.findOne({key:'studio'}).select('security timezone').lean();const{DEFAULTS}=require('../utils/studioSettings');const security={...DEFAULTS.security,...config?.security};const now=new Date();
 const devices=await Device.find({workspaceKey,enabled:true,expiresAt:{$gt:now},lastNotificationId:{$ne:String(note._id)}}).select('+encryptedToken').limit(100);
 for(const device of devices){
  try{
   const[user,session]=await Promise.all([User.findById(device.userId).select('role studioPreferences +sessionVersion'),Session.findById(device.sessionId)]);
   if(!user||user.role!=='admin'||!session||String(session.user)!==device.userId||session.version!==(user.sessionVersion||0)||require('./studioSecurity').sessionExpired(session,security,now.getTime())){await Device.updateOne({_id:device._id,sessionId:device.sessionId},{$set:{enabled:false}});continue;}
   if(workspace){const registry=require('../saas/models');const member=await registry.Membership.findOne({workspaceId:workspace._id,localUserId:device.userId,state:'active'});if(!member||!await registry.Account.exists({_id:member.accountId,state:'active'}))continue;}
   const prefs=user.studioPreferences||{};if((Array.isArray(prefs.notificationCategories)&&!prefs.notificationCategories.includes(notificationCategory(note)))||quietNow(prefs,now,config?.timezone))continue;
   const claimed=await Device.updateOne({_id:device._id,enabled:true,sessionId:device.sessionId,lastNotificationId:{$ne:String(note._id)}},{$set:{lastNotificationId:String(note._id)}});if(!claimed.modifiedCount)continue;
   const result=await sendAPNs(unsealToken(device.encryptedToken),payloadFor(note,device,prefs));
   if(result.invalid)await Device.updateOne({_id:device._id,sessionId:device.sessionId},{$set:{enabled:false}});
  }catch{/* Saved in-app activity remains available if push delivery fails. */}
 }
}
module.exports={pushConfigured,configuration,sealToken,unsealToken,providerToken,sendAPNs,notificationCategory,quietNow,payloadFor,deliverNotification};
