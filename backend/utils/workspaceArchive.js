'use strict';
const crypto=require('node:crypto'),mongoose=require('mongoose');
const {fail}=require('../services/studioSecurity');
const MODEL_NAMES=Object.freeze(['StudioConfig','StudioContact','StudioProject','Lead','Quotation','Invoice','QuoteTemplate','ContactDocument','Finance','Event','Photographer','Task','AssetRecord','Gallery','Media','ProjectMessage','User','FinanceReceipt','StudioProfileImage','DriveGallery','GalleryEvent','SheetConfig','DocumentCounter','Message','ChatRoom','Notification','QuoteDelivery','WhatsAppConversation','WhatsAppMessage']);
const RESET_CREDENTIAL_MODELS=Object.freeze(['AdminSettings','StudioOperationLease','GmailConnection','GmailOAuthNonce','WhatsAppConnection','WhatsAppReceipt','WabbMessageAttempt','DriveBackupConnection','DriveBackupOAuthNonce','OAuthStateNonce']);
const USER_FIELDS=Object.freeze(['_id','firstName','lastName','email','role','moduleAccess','studioPreferences','galleryTag','cloudLink','leadId','createdAt','updatedAt']);
const MAX_BYTES=32*1024*1024,MAX_UPLOAD_BYTES=48*1024*1024,MAX_RECORDS=10000,CHUNK_BYTES=1024*1024;
const FORMAT='teamalpha-workspace',ENVELOPE_FORMAT='teamalpha-encrypted-workspace',VERSION=2;
const SECRET=/password|secret|token|credential|authorization|cookie|^iv$|^session|^google(access|refresh|webhook|resource)|^vault/i;
const EXCLUSIONS=Object.freeze([
 'Passwords, password hashes, gallery passwords, OAuth/provider credentials, live sessions, push tokens and public sharing tokens are excluded.',
 'Other restored team/client accounts remain disabled until the studio owner sets a new password; no other owner privileges are restored.',
 'External Google Drive/Cloudinary photos, videos, document covers and other externally hosted files are references only; their bytes are not downloaded or deleted.',
 'Local uploaded chat/media file bytes and repository/static website assets are not included. Destructive actions are blocked while any local uploaded files exist.',
 'Environment secrets, SMTP/provider configuration, remote Google Drive/iCloud/provider content and the separate SaaS account/billing registry are not changed.',
 'Historical queues, delivery attempts and connection credentials are cleared or restored in inactive state; outgoing reminders and public document links must be deliberately reissued.',
 'Existing recovery snapshots and archive history remain outside the reset so recovery is possible.',
 'Archives require the original server BACKUP_SECRET or VAULT_SECRET; that key is not contained in the archive and must stay stable across reset.',
 'Missing historical account IDs are preserved as disabled, credential-free former-account placeholders. Missing business links are preserved with an authenticated unresolved-reference manifest rather than silently dropped.',
]);
const COVERAGE=Object.freeze({format:FORMAT,version:VERSION,collections:[...MODEL_NAMES],inlineBinary:['FinanceReceipt.data','StudioProfileImage.data'],referencesOnly:['Gallery','DriveGallery','GalleryEvent','Media','Message.attachments','StudioConfig external/static images'],exclusions:[...EXCLUSIONS]});
const identity=value=>typeof value==='string'&&/^[a-f\d]{24}$/i.test(value);
function registry(){return Object.fromEntries(MODEL_NAMES.map(name=>[name,require('../models/'+name)]));}
function archiveKey(env=process.env){
 const key=env.BACKUP_SECRET||env.VAULT_SECRET;
 if(typeof key!=='string'||key.trim().length<32)throw fail('A stable BACKUP_SECRET or VAULT_SECRET of at least 32 characters is required. Keep the original key to restore this archive.',503);
 return crypto.createHash('sha256').update(key).digest();
}
function keyConfigured(env){try{archiveKey(env);return true;}catch{return false;}}
function checkTree(value,depth=0,tracker={nodes:0}){
 if(++tracker.nodes>500000||depth>30)throw fail('Archive structure is too complex.',413);
 if(value===null)return;
 if(Array.isArray(value)){for(const row of value)checkTree(row,depth+1,tracker);return;}
 if(typeof value==='object'){for(const [key,row]of Object.entries(value)){if(key.startsWith('$')||key.includes('.')||['__proto__','constructor','prototype'].includes(key))throw fail('Archive contains an unsafe field.',400);checkTree(row,depth+1,tracker);}return;}
 if(typeof value==='number'&&!Number.isFinite(value))throw fail('Archive contains an invalid number.',400);
 if(!['string','number','boolean'].includes(typeof value))throw fail('Archive contains an unsupported value.',400);
}
function safeString(value){
 let text=value.replace(/(\/(?:quote|invoice)\/)[a-f\d.]{24,100}/gi,'$1[link removed]');
 if(/^https?:\/\//i.test(text))try{const url=new URL(text);let changed=!!(url.username||url.password);url.username='';url.password='';for(const key of [...url.searchParams.keys()])if(/token|secret|password|credential|authorization|api[_-]?key|signature/i.test(key)){url.searchParams.delete(key);changed=true;}if(changed)text=url.href;}catch{}
 return text;
}
function portable(value,depth=0){
 if(depth>30)throw fail('Record nesting exceeds the archive limit.',413);
 if(value===undefined)return undefined;
 if(value===null)return null;
 if(value instanceof Date)return value.toISOString();
 if(value instanceof mongoose.Types.ObjectId)return String(value);
 if(Buffer.isBuffer(value)||value?._bsontype==='Binary'){const data=Buffer.isBuffer(value)?value:value.buffer;return{encoding:'base64',base64:Buffer.from(data).toString('base64')};}
 if(Array.isArray(value))return value.map(row=>portable(row,depth+1));
 if(typeof value==='object'){const result={};for(const [key,row]of Object.entries(value)){if(SECRET.test(key))continue;if(key.startsWith('$')||key.includes('.')||['__proto__','constructor','prototype'].includes(key))throw fail('Record contains an unsafe field.',400);const cleaned=portable(row,depth+1);if(cleaned!==undefined)result[key]=cleaned;}return result;}
 if(typeof value==='number'&&!Number.isFinite(value))throw fail('Record contains an invalid number.',400);
 if(typeof value==='string')return safeString(value);
 if(!['number','boolean'].includes(typeof value))throw fail('Unsupported archive record value.',400);
 return value;
}
function exportRecord(name,record){
 const raw=record.toObject?.()||record;
 const value=name==='User'?Object.fromEntries(USER_FIELDS.filter(key=>raw[key]!==undefined).map(key=>[key,raw[key]])):raw;
 const cleaned=portable(value);if(name==='User'&&typeof cleaned.email==='string')cleaned.email=cleaned.email.trim().toLowerCase();return cleaned;
}
function decodedRecord(name,row){
 const value=structuredClone(row);
 if(['FinanceReceipt','StudioProfileImage'].includes(name)){
  const field=value.data;
  if(!field||Object.keys(field).sort().join(',')!=='base64,encoding'||field.encoding!=='base64'||typeof field.base64!=='string'||!field.base64||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(field.base64))throw fail('Archive contains invalid image bytes.',400);
  const data=Buffer.from(field.base64,'base64'),max=name==='FinanceReceipt'?4*1024*1024:2*1024*1024;
  if(!data.length||data.length>max||data.toString('base64')!==field.base64)throw fail('Archive image exceeds its supported size.',413);
  const jpeg=data[0]===255&&data[1]===216&&data[2]===255,png=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP';
  if(!((value.mimeType==='image/jpeg'&&jpeg)||(value.mimeType==='image/png'&&png)||(value.mimeType==='image/webp'&&webp)))throw fail('Archive image content does not match its type.',400);
  if(name==='FinanceReceipt'&&value.bytes!==data.length)throw fail('Receipt byte length is inconsistent.',400);
  value.data=data;
 }
 return value;
}
function valuesAt(value,parts){
 if(Array.isArray(value))return value.flatMap(row=>valuesAt(row,parts));
 if(!parts.length)return value===undefined||value===null?[]:[value];
 if(!value||typeof value!=='object')return[];
 return valuesAt(value[parts[0]],parts.slice(1));
}
function referencePaths(schema,prefix=''){
 const refs=[];
 schema.eachPath((path,type)=>{
  const key=prefix?prefix+'.'+path:path,ref=type.options?.ref||type.caster?.options?.ref;
  if(typeof ref==='string')refs.push([key,ref]);
  if(type.schema)refs.push(...referencePaths(type.schema,key));
 });
 return refs;
}
function userReferences(collections,models){
 const values=[];
 for(const [name,rows]of Object.entries(collections))for(const [path,target]of referencePaths(models[name].schema))if(target==='User')for(const row of rows)values.push(...valuesAt(row,path.split('.')).flat().map(String));
 for(const name of ['Message','ChatRoom'])for(const row of collections[name]||[]){
  values.push(...(name==='Message'?[row.sender,row.recipient,...(row.deletedForUsers||[]),...(row.reactions||[]).map(item=>item.userId)]:[row.userId]).filter(Boolean).map(String));
 }
 for(const row of collections.Notification||[])values.push(...[...(row.readBy||[]),...(row.hiddenBy||[])].map(String));
 return values.filter(value=>!['admin','hardcoded-admin-id',''].includes(value));
}
function addHistoricalUsers(snapshot,models=registry(),{reservedEmail=process.env.ADMIN_EMAIL}={}){
 const ids=new Set(snapshot.collections.User.map(row=>String(row._id))),emails=new Set(snapshot.collections.User.map(row=>row.email.toLowerCase()));
 if(typeof reservedEmail==='string')emails.add(reservedEmail.trim().toLowerCase());
 const historical=[];
 for(const value of [...new Set(userReferences(snapshot.collections,models))].sort()){
  if(ids.has(value))continue;
  if(!identity(value))throw fail('Historical account reference has an unsupported identity.',400);
  let suffix=0,email;do{email='former-'+value+(suffix?'-'+suffix:'')+'@inactive.invalid';suffix++;}while(emails.has(email));
  snapshot.collections.User.push({_id:value,firstName:'Former account '+value.slice(-6),lastName:'',email,role:'client',moduleAccess:[]});
  ids.add(value);emails.add(email);historical.push(value);
 }
 if(Object.values(snapshot.collections).reduce((sum,rows)=>sum+rows.length,0)>MAX_RECORDS)throw fail('Archive including historical account placeholders exceeds 10,000 records.',413);
 snapshot.historicalUserIds=historical;
 return snapshot;
}
const referenceKey=row=>JSON.stringify([row.model,row.id,row.path,row.target,row.targetId]);
function unresolvedReferences(collections,models){
 const ids=Object.fromEntries(Object.entries(collections).map(([name,rows])=>[name,new Set(rows.map(row=>String(row._id)))])),missing=new Map();
 const add=(model,id,path,target,targetId)=>{const value={model,id:String(id),path,target,targetId:String(targetId)};missing.set(referenceKey(value),value);};
 for(const [name,rows]of Object.entries(collections))for(const [path,target]of referencePaths(models[name].schema)){
  if(!ids[target])throw fail('Archive contains an unsupported relationship type.',400);
  for(const row of rows)for(const value of valuesAt(row,path.split('.')).flat())if(value!==''&&!ids[target].has(String(value)))add(name,row._id,path,target,value);
 }
 for(const company of collections.StudioConfig||[])for(const path of ['logoUrl','profilePhotoUrl']){
  const match=/^\/api\/studio\/profile-images\/([a-f\d]{24})$/i.exec(company[path]||'');if(match&&!ids.StudioProfileImage.has(match[1]))add('StudioConfig',company._id,path,'StudioProfileImage',match[1]);
 }
 for(const value of userReferences(collections,models))if(!ids.User.has(value))throw fail('Archive has an unresolved account reference; a capture-generated former-account placeholder is required.',400);
 return [...missing.values()].sort((a,b)=>referenceKey(a).localeCompare(referenceKey(b)));
}
function validateReferences(collections,models,manifest=[]){
 if(!Array.isArray(manifest)||manifest.some(row=>!row||typeof row!=='object'||Object.keys(row).sort().join(',')!=='id,model,path,target,targetId'))throw fail('Archive has an invalid unresolved-reference manifest.',400);
 const actual=unresolvedReferences(collections,models),expected=manifest.map(({model,id,path,target,targetId})=>({model,id,path,target,targetId})).sort((a,b)=>referenceKey(a).localeCompare(referenceKey(b)));
 if(new Set(expected.map(referenceKey)).size!==expected.length||JSON.stringify(actual)!==JSON.stringify(expected))throw fail('Archive unresolved-reference manifest does not match its records.',400);
 return actual;
}
function validateSnapshot(snapshot,models=registry()){
 checkTree(snapshot);
 if(!snapshot||snapshot.format!==FORMAT||snapshot.version!==VERSION||!identity(snapshot.sourceOwnerId)||!Number.isFinite(Date.parse(snapshot.createdAt||''))||!snapshot.collections||Array.isArray(snapshot.collections)||Object.keys(snapshot).some(key=>!['format','version','createdAt','sourceOwnerId','collections','coverage','historicalUserIds','unresolvedReferences'].includes(key)))throw fail('Unsupported workspace archive.',400);
 if(Object.keys(snapshot.collections).sort().join(',')!==[...MODEL_NAMES].sort().join(','))throw fail('Archive must contain every supported collection; partial archives cannot replace a workspace.',400);
 if(Buffer.byteLength(JSON.stringify(snapshot))>MAX_BYTES)throw fail('Workspace archive exceeds the 32 MB limit.',413);
 let total=0;const seen=new Set(),emails=new Set();
 for(const name of MODEL_NAMES){
  const rows=snapshot.collections[name];if(!Array.isArray(rows))throw fail('Archive collection must be an array.',400);
  for(const row of rows){
   if(++total>MAX_RECORDS)throw fail('Workspace archive exceeds 10,000 records.',413);
   if(!row||typeof row!=='object'||Array.isArray(row)||!(name==='DocumentCounter'?typeof row._id==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(row._id):identity(row._id)))throw fail('Archive contains an invalid record identity.',400);
   if(seen.has(name+':'+row._id))throw fail('Archive contains duplicate record identities.',400);seen.add(name+':'+row._id);
   if(JSON.stringify(portable(row))!==JSON.stringify(row))throw fail('Archive contains excluded credentials or live sharing links.',400);
   if(name==='User'){
    if(Object.keys(row).some(key=>!USER_FIELDS.includes(key))||!['admin','client'].includes(row.role)||typeof row.email!=='string'||row.email!==row.email.trim().toLowerCase()||row.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))throw fail('Archive contains invalid account metadata.',400);
    if(emails.has(row.email))throw fail('Archive contains duplicate account emails.',400);emails.add(row.email);
   }
   const decoded=decodedRecord(name,row),data=name==='User'?{...decoded,password:'!disabled-archive-member!',accountDisabled:true,studioOwner:false}:decoded;
   try{const doc=new models[name](data,undefined,{strict:'throw'});if(doc.validateSync())throw Error();if(name==='StudioConfig')require('./studioSettings').parseAdvancedSettings(data);}catch{throw fail('Archive contains invalid '+name+' records.',400);}
  }
 }
 const owner=snapshot.collections.User.find(row=>row._id===snapshot.sourceOwnerId);
 if(owner?.role!=='admin'||snapshot.collections.StudioConfig.length>1||snapshot.collections.StudioConfig.some(row=>row.key!=='studio'))throw fail('Archive owner or company identity is invalid.',400);
 for(const name of MODEL_NAMES){
  for(const [fields,options]of models[name].schema.indexes()){
   if(!options.unique||Object.keys(fields).some(key=>key.includes('.')))continue;
   const signatures=new Set();
   for(const row of snapshot.collections[name]){
    const keys=Object.keys(fields);if(keys.some(key=>row[key]===undefined||row[key]===null||row[key]===''))continue;
    const signature=JSON.stringify(keys.map(key=>row[key]));if(signatures.has(signature))throw fail('Archive contains conflicting '+name+' records.',400);signatures.add(signature);
   }
  }
 }
 const historical=snapshot.historicalUserIds||[];
 if(!Array.isArray(historical)||new Set(historical).size!==historical.length||historical.some(value=>{const user=snapshot.collections.User.find(row=>row._id===value);return !identity(value)||!user||user.role!=='client'||!Array.isArray(user.moduleAccess)||user.moduleAccess.length||!new RegExp('^former-'+value+'(?:-\\d+)?@inactive\\.invalid$').test(user.email)||user.firstName!=='Former account '+value.slice(-6)||user.lastName!==''||Object.keys(user).sort().join(',')!=='_id,email,firstName,lastName,moduleAccess,role'||!userReferences(snapshot.collections,models).includes(value);}))throw fail('Archive former-account metadata is invalid.',400);
 validateReferences(snapshot.collections,models,snapshot.unresolvedReferences||[]);
 return snapshot;
}
function seal(snapshot,env=process.env){
 const text=JSON.stringify(snapshot);if(Buffer.byteLength(text)>MAX_BYTES)throw fail('Workspace archive exceeds the 32 MB limit.',413);
 const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',archiveKey(env),nonce);
 cipher.setAAD(Buffer.from(ENVELOPE_FORMAT+':'+VERSION));
 const data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);
 return{format:ENVELOPE_FORMAT,version:VERSION,algorithm:'AES-256-GCM',iv:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
}
function unseal(envelope,env=process.env){
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||Object.keys(envelope).sort().join(',')!=='algorithm,data,format,iv,tag,version'||envelope.format!==ENVELOPE_FORMAT||envelope.version!==VERSION||envelope.algorithm!=='AES-256-GCM'||typeof envelope.data!=='string'||envelope.data.length>MAX_UPLOAD_BYTES||typeof envelope.iv!=='string'||typeof envelope.tag!=='string')throw fail('Unsupported encrypted archive.',400);
 const key=archiveKey(env);
 try{
  for(const field of ['iv','tag','data'])if(Buffer.from(envelope[field],'base64').toString('base64')!==envelope[field])throw Error();
  const nonce=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64');if(nonce.length!==12||tag.length!==16)throw Error();
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,nonce);decipher.setAAD(Buffer.from(ENVELOPE_FORMAT+':'+VERSION));decipher.setAuthTag(tag);
  const bytes=Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]);if(bytes.length>MAX_BYTES)throw Error();
  const result=JSON.parse(bytes.toString('utf8'));checkTree(result);return result;
 }catch{throw fail('This archive is damaged or uses a different original backup key. No data was changed.',400);}
}
function parseUpload(buffer){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>MAX_UPLOAD_BYTES)throw fail('Choose an encrypted workspace archive smaller than 48 MB.',413);
 try{const value=JSON.parse(buffer.toString('utf8'));checkTree(value);return value;}catch(error){if(error.status)throw error;throw fail('Choose a valid encrypted workspace archive file.',400);}
}
module.exports={MODEL_NAMES,RESET_CREDENTIAL_MODELS,USER_FIELDS,MAX_BYTES,MAX_UPLOAD_BYTES,MAX_RECORDS,CHUNK_BYTES,FORMAT,VERSION,COVERAGE,EXCLUSIONS,registry,keyConfigured,archiveKey,portable,exportRecord,decodedRecord,validateSnapshot,validateReferences,addHistoricalUsers,unresolvedReferences,seal,unseal,parseUpload,identity};
