'use strict';
const crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path'),mongoose=require('mongoose'),bcrypt=require('bcryptjs');
const codec=require('../utils/workspaceArchive'),modules=require('../utils/moduleAccess'),security=require('./studioSecurity');
const fail=security.fail;
const RESET_CONFIRMATION='DELETE WORKSPACE DATA',RESTORE_CONFIRMATION='RESTORE WORKSPACE',RESUME_CONFIRMATION='RESUME INTEGRATIONS';
const RECOVERY_RELEASE_BLOCK='Master reset and replacement restore are disabled until recovery has been verified on a disposable database and explicitly enabled by the server operator. Encrypted backups remain available.';
const recoveryEnabled=env=>env.WORKSPACE_RECOVERY_ENABLED==='true';
function assertRecoveryEnabled(env){if(!recoveryEnabled(env))throw fail(RECOVERY_RELEASE_BLOCK,503);}
function assertPersonal(){if(require('../saas/tenantContext').currentWorkspace())throw fail('Workspace replacement is available only for the personal studio installation; no SaaS workspace was changed.',403);}
async function localFileBlockers({readDirectory=fs.readdir,directory=path.join(__dirname,'..','uploads')}={}){
 const pending=[directory];let scanned=0;
 while(pending.length){
  const current=pending.pop();let entries;
  try{entries=await readDirectory(current,{withFileTypes:true});}
  catch(error){if(error.code==='ENOENT')continue;throw fail('Local attachment coverage could not be verified. No data was changed.',503);}
  if((scanned+=entries.length)>1024)return['Local upload coverage exceeds the safe scan limit. Destructive actions are blocked until files are reviewed.'];
  for(const entry of entries){
   if(entry.name==='.gitkeep'&&entry.isFile())continue;
   if(entry.isDirectory())pending.push(path.join(current,entry.name));
   else return['Local uploaded chat/media files exist. Reset/replace is blocked because these file bytes are not included in the database archive.'];
  }
 }
 return[];
}
async function* defaultRows(Model,session,name){
 let query=Model.find({}).session(session).lean();
 if(name==='User')query=query.select(codec.USER_FIELDS.join(' '));
 if(['FinanceReceipt','StudioProfileImage'].includes(name))query=query.select('+data');
 const cursor=query.cursor({batchSize:10});
 try{for await(const row of cursor)yield row;}finally{await cursor.close();}
}
function metadata(row){const raw=row.toObject?.()||row;return{id:String(raw._id),backupId:String(raw._id),kind:raw.kind,createdAt:raw.createdAt,sourceCreatedAt:raw.sourceCreatedAt,counts:raw.counts instanceof Map?Object.fromEntries(raw.counts):raw.counts,historicalAccounts:raw.historicalAccounts||0,unresolvedReferences:raw.unresolvedReferences||0,bytes:raw.bytes,encryptedBytes:raw.encryptedBytes,expiresAt:raw.expiresAt,coverage:codec.COVERAGE};}
function createArchiveService(options={}){
 const get=()=>({
  registry:options.registry||codec.registry(),User:options.User||require('../models/User'),Session:options.Session||require('../models/AdminSession'),
  Archive:options.Archive||require('../models/StudioArchive'),Chunk:options.Chunk||require('../models/StudioArchiveChunk'),State:options.State||require('../models/StudioArchiveState'),
  PushDevice:options.PushDevice||require('../models/StudioPushDevice'),gate:options.gate||require('./studioArchiveGate'),transaction:options.transaction||require('./studioRecovery').inTransaction,
  readRows:options.readRows||defaultRows,env:options.env||process.env,now:options.now||(()=>new Date()),fileBlockers:options.fileBlockers||localFileBlockers,
 });
 const attempts=new Map();
 function rateLimit(actorId,now){
  const value=attempts.get(actorId);if(value&&value.until>now&&value.count>=5)throw fail('Too many password attempts. Wait one minute before trying again.',429);
  attempts.set(actorId,{until:value?.until>now?value.until:now+60000,count:value?.until>now?value.count+1:1});
  if(attempts.size>1000)for(const [key,row]of attempts)if(row.until<=now)attempts.delete(key);
 }
 async function owner(actorId,password,{reauth=false}={}){
  assertPersonal();if(!codec.identity(actorId))throw fail('Studio owner authentication required.',403);
  const deps=get(),user=await deps.User.findById(actorId).select('+sessionVersion');
  if(!user||user.accountDisabled||!modules.isStudioOwner(user)||!modules.hasFullAccess(user))throw fail('Only the active studio owner can manage full workspace data.',403);
  if(reauth){
   if(typeof password!=='string'||!password||Buffer.byteLength(password)>1024)throw fail('Enter your current administrator sign-in password.',400);
   rateLimit(actorId,deps.now().getTime());
   if(!await (options.comparePassword||bcrypt.compare)(password,user.password))throw fail('Your current administrator sign-in password is incorrect.',400);
   attempts.delete(actorId);
  }
  return user;
 }
 async function capture(actorId,session,deps){
  const collections={};let count=0,bytes=0;
  for(const name of codec.MODEL_NAMES){
   collections[name]=[];
   for await(const raw of deps.readRows(deps.registry[name],session,name)){
    if(++count>codec.MAX_RECORDS)throw fail('Full workspace backups support at most 10,000 records. Nothing was deleted.',413);
    const row=codec.exportRecord(name,raw);bytes+=Buffer.byteLength(JSON.stringify(row));
    if(bytes>codec.MAX_BYTES-65536)throw fail('Full workspace archive exceeds 32 MB. Nothing was deleted.',413);
    collections[name].push(row);
   }
  }
  const snapshot={format:codec.FORMAT,version:codec.VERSION,createdAt:deps.now().toISOString(),sourceOwnerId:String(actorId),coverage:codec.COVERAGE,collections};
  codec.addHistoricalUsers(snapshot,deps.registry,{reservedEmail:deps.env.ADMIN_EMAIL});
  snapshot.unresolvedReferences=codec.unresolvedReferences(snapshot.collections,deps.registry);
  return codec.validateSnapshot(snapshot,deps.registry);
 }
 async function persist(snapshot,actorId,kind,session,deps){
  const archive=codec.seal(snapshot,deps.env),serialized=JSON.stringify(archive),bytes=Buffer.byteLength(serialized);
  const expiresAt=new Date(deps.now().getTime()+(kind.startsWith('pre-')?90:30)*86400000),id=new mongoose.Types.ObjectId();
  const data=[];for(let offset=0;offset<serialized.length;offset+=codec.CHUNK_BYTES)data.push(serialized.slice(offset,offset+codec.CHUNK_BYTES));
  if(data.length>64||bytes>codec.MAX_UPLOAD_BYTES)throw fail('Encrypted archive exceeds the storage limit.',413);
  const counts=Object.fromEntries(Object.entries(snapshot.collections).map(([name,rows])=>[name,rows.length]));
  const [row]=await deps.Archive.create([{_id:id,kind,createdBy:actorId,sourceCreatedAt:snapshot.createdAt,counts,historicalAccounts:(snapshot.historicalUserIds||[]).length,unresolvedReferences:(snapshot.unresolvedReferences||[]).length,bytes:Buffer.byteLength(JSON.stringify(snapshot)),encryptedBytes:bytes,chunkCount:data.length,checksum:crypto.createHash('sha256').update(serialized).digest('hex'),expiresAt}],{session});
  await deps.Chunk.insertMany(data.map((value,index)=>({archive:id,index,data:value,expiresAt})),{session,ordered:true});
  return{archive,backupId:String(id),summary:metadata(row)};
 }
 async function createPortableArchive({actorId,password,reason='manual'}){
  const verified=await owner(actorId,password,{reauth:true}),deps=get();codec.archiveKey(deps.env);
  if(!['manual','drive'].includes(reason))throw fail('Unsupported archive action.',400);
  return deps.gate.withShared(()=>deps.transaction(async session=>{
   await confirmOwner(verified,session,deps);
   return persist(await capture(actorId,session,deps),actorId,reason,session,deps);
  }));
 }
 async function readStoredArchive({actorId,backupId}){
  await owner(actorId);if(!codec.identity(backupId))throw fail('Archive not found.',404);const deps=get();
  return deps.gate.withShared(async()=>{
   const row=await deps.Archive.findOne({_id:backupId,expiresAt:{$gt:deps.now()}});
   if(!row)throw fail('Archive not found or expired.',404);
   const chunks=await deps.Chunk.find({archive:row._id}).select('+data').sort({index:1}).lean();
   if(chunks.length!==row.chunkCount||chunks.some((chunk,index)=>chunk.index!==index||typeof chunk.data!=='string'||chunk.data.length>codec.CHUNK_BYTES))throw fail('Archive storage is incomplete. No data was changed.',409);
   const text=chunks.map(chunk=>chunk.data).join('');
   if(Buffer.byteLength(text)>codec.MAX_UPLOAD_BYTES||crypto.createHash('sha256').update(text).digest('hex')!==row.checksum)throw fail('Archive storage integrity check failed.',409);
   try{return JSON.parse(text);}catch{throw fail('Archive storage is damaged.',409);}
  });
 }
 async function inspectPortableArchive({actorId,archive}){
  await owner(actorId);const deps=get(),snapshot=codec.validateSnapshot(codec.unseal(archive,deps.env),deps.registry);
  return{counts:Object.fromEntries(Object.entries(snapshot.collections).map(([name,rows])=>[name,rows.length])),coverage:codec.COVERAGE,sourceCreatedAt:snapshot.createdAt,restoredMembersDisabled:Math.max(0,snapshot.collections.User.length-1),historicalAccounts:(snapshot.historicalUserIds||[]).length,unresolvedReferences:snapshot.unresolvedReferences||[],warnings:(snapshot.unresolvedReferences||[]).length?['This archive preserves historical links to deleted records. Their exact unresolved references are listed for review.']:[]};
 }
 async function confirmOwner(verified,session,deps){
  const current=await deps.User.findById(verified._id).select('+sessionVersion').session(session);
  if(!current||current.accountDisabled||current.password!==verified.password||(current.sessionVersion||0)!==(verified.sessionVersion||0)||!modules.isStudioOwner(current))throw fail('Owner access changed. Sign in and verify your password again.',409);
  return current;
 }
 async function cleanupCredentials(session,deps,currentSessionId,actorId){
  for(const name of codec.RESET_CREDENTIAL_MODELS){
   let Model=options.credentialModels?.[name]||mongoose.models[name];
   if(!Model&&name!=='OAuthStateNonce')try{Model=require('../models/'+name);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
   if(Model)await Model.deleteMany({},{session});
   else if(name==='OAuthStateNonce'&&!options.credentialModels)await mongoose.connection.collection('oauthstatenonces').deleteMany({},{session});
  }
  await deps.Session.deleteMany({_id:{$ne:currentSessionId}},{session});
  await deps.PushDevice.deleteMany({workspaceKey:'legacy'},{session});
 }
 function rewriteOwnerRefs(name,row,sourceOwnerId,actorId){
  const value=structuredClone(row),fields=[];
  function refs(schema,prefix=''){schema.eachPath((key,type)=>{const path=prefix?prefix+'.'+key:key,ref=type.options?.ref||type.caster?.options?.ref;if(ref==='User')fields.push(path.split('.'));if(type.schema)refs(type.schema,path);});}
  refs(get().registry[name].schema);
  if(name==='Message')fields.push(['sender'],['recipient'],['deletedForUsers'],['reactions','userId']);
  if(name==='ChatRoom')fields.push(['userId']);
  if(name==='Notification')fields.push(['readBy'],['hiddenBy']);
  function mapAt(target,parts){
   if(Array.isArray(target)){for(let i=0;i<target.length;i++){if(!parts.length&&String(target[i])===sourceOwnerId)target[i]=actorId;else mapAt(target[i],parts);}return;}
   if(!target||typeof target!=='object'||!parts.length)return;
   const key=parts[0];if(parts.length===1){if(Array.isArray(target[key]))target[key]=target[key].map(item=>String(item)===sourceOwnerId?actorId:item);else if(String(target[key])===sourceOwnerId)target[key]=actorId;}else mapAt(target[key],parts.slice(1));
  }
  for(const parts of fields)mapAt(value,parts);
  return value;
 }
 function restoredCollections(snapshot,actingOwner,dataVersion,deps){
  const actorId=String(actingOwner._id),collections={};
  for(const name of codec.MODEL_NAMES){
   collections[name]=[];
   for(const source of snapshot.collections[name]){
    if(name==='User'&&source._id===snapshot.sourceOwnerId)continue;
    if(name==='User'&&(source._id===actorId||source.email.toLowerCase()===actingOwner.email.toLowerCase()))throw fail('Archive account conflicts with the current owner. Nothing was changed.',400);
    let row=rewriteOwnerRefs(name,source,snapshot.sourceOwnerId,actorId);
    if(name==='User'){
     modules.assertTeamEmail(row.email,deps.env);
     row={...row,password:'!disabled-restored-'+crypto.randomBytes(24).toString('hex'),studioOwner:false,accountDisabled:true,sessionVersion:1,workspaceDataVersion:dataVersion};
    }
    if(name==='Quotation'){row.remindersEnabled=false;delete row.scheduledDelivery;}
    if(name==='Invoice'){row.paymentReminders=false;delete row.scheduledDelivery;}
    if(name==='QuoteDelivery'&&['queued','processing'].includes(row.status)){row.status='cancelled';row.error='Cancelled during workspace restore.';}
    if(name==='WhatsAppMessage'&&['sending','submitted'].includes(row.status)){row.status='unknown';row.error='Not resumed after workspace restore.';}
    if(name==='Event'){for(const key of ['googleEventId','googleCalendarId','googleHtmlLink','googleEtag'])delete row[key];row.origin='local';row.isReadOnly=false;row.lastUpdatedFrom='local';}
    collections[name].push(codec.decodedRecord(name,row));
   }
  }
  return collections;
 }
 async function replace({actorId,password,confirmation,archive,currentSessionId,reset}){
  assertRecoveryEnabled(get().env);
  if(confirmation!==(reset?RESET_CONFIRMATION:RESTORE_CONFIRMATION))throw fail('Type '+(reset?RESET_CONFIRMATION:RESTORE_CONFIRMATION)+' exactly to confirm.',400);
  const verified=await owner(actorId,password,{reauth:true}),deps=get();codec.archiveKey(deps.env);
  if(!codec.identity(currentSessionId))throw fail('A current owner session is required. Sign in again.',409);
  const incoming=reset?null:codec.validateSnapshot(codec.unseal(archive,deps.env),deps.registry);
  return deps.gate.withExclusive(async()=>{
   const blockers=await deps.fileBlockers();if(blockers.length)throw fail(blockers.join(' '),409);
   return deps.transaction(async session=>{
    const actingOwner=await confirmOwner(verified,session,deps);
    const currentSession=await deps.Session.findOne({_id:currentSessionId,user:actorId,revokedAt:null}).session(session);
    if(!currentSession)throw fail('Your owner session ended. No data was changed.',409);
    const state=await deps.State.findById('legacy').session(session),dataVersion=(state?.dataVersion||0)+1;
    const incomingRows=incoming?restoredCollections(incoming,actingOwner,dataVersion,deps):null;
    // This durable safety archive and every destructive write share one transaction.
    // A failed snapshot, import, session update or commit rolls everything back.
    const safety=await persist(await capture(actorId,session,deps),actorId,reset?'pre-reset':'pre-restore',session,deps);
    const beforeCounts={...safety.summary.counts,User:Math.max(0,(safety.summary.counts.User||0)-1-(safety.summary.historicalAccounts||0))};
    for(const name of codec.MODEL_NAMES){
     if(name==='User')await deps.User.deleteMany({_id:{$ne:actorId}},{session});
     else await deps.registry[name].deleteMany({},{session});
    }
    await cleanupCredentials(session,deps,currentSessionId,actorId);
    const preserved=new Set(['_id','firstName','lastName','email','password','role','studioOwner','moduleAccess','sessionVersion','workspaceDataVersion','accountDisabled','studioPreferences','createdAt','updatedAt','__v']);
    const unset=Object.fromEntries(Object.keys(deps.User.schema.paths).map(key=>key.split('.')[0]).filter(key=>!preserved.has(key)).map(key=>[key,1]));
    const preferences=incoming?.collections.User.find(row=>row._id===incoming.sourceOwnerId)?.studioPreferences||require('../utils/studioPreferences').defaults();
    const ownerUpdate=await deps.User.updateOne({_id:actorId,password:verified.password},{$set:{studioOwner:true,role:'admin',moduleAccess:null,accountDisabled:false,studioPreferences:preferences,workspaceDataVersion:dataVersion},$unset:unset},{session,runValidators:true});
    if(ownerUpdate.matchedCount!==1)throw fail('Owner credentials changed. No data was changed.',409);
    if(incomingRows)for(const name of codec.MODEL_NAMES)if(incomingRows[name].length)await deps.registry[name].insertMany(incomingRows[name],{session,ordered:true});
    const now=deps.now(),expiresAt=new Date(Math.min(new Date(currentSession.expiresAt).getTime(),now.getTime()+24*3600000));
    const kept=await deps.Session.updateOne({_id:currentSessionId,user:actorId,revokedAt:null},{$set:{createdAt:now,lastSeenAt:now,expiresAt,version:actingOwner.sessionVersion||0}},{session});
    if(kept.matchedCount!==1)throw fail('Your owner session ended. No data was changed.',409);
    await deps.State.updateOne({_id:'legacy'},{$set:{dataVersion,integrationsPaused:true}},{session});
    if(deps.gate.assertExclusive)await deps.gate.assertExclusive(session);
    const counts=incoming?Object.fromEntries(Object.entries(incoming.collections).map(([name,rows])=>[name,rows.length])):Object.fromEntries(codec.MODEL_NAMES.map(name=>[name,name==='User'?1:0]));
    return{safetyBackupId:safety.backupId,dataVersion,counts,deletedCounts:beforeCounts,coverage:codec.COVERAGE,sourceCreatedAt:incoming?.createdAt||safety.summary.sourceCreatedAt,restoredMembersDisabled:incoming?incoming.collections.User.length-1:0,historicalAccounts:(incoming?.historicalUserIds||[]).length,unresolvedReferences:incoming?.unresolvedReferences||[],integrationsPaused:true,ownerPreserved:true};
   });
  });
 }
 async function getStatus({actorId}){
  await owner(actorId);const deps=get();
  return deps.gate.withShared(async()=>{
   const counts={};for(const name of codec.MODEL_NAMES)counts[name]=await deps.registry[name].countDocuments({});
   const state=await deps.gate.getState(),blockers=await deps.fileBlockers();
   if(!recoveryEnabled(deps.env))blockers.push(RECOVERY_RELEASE_BLOCK);
   if(state?.uncertainReaders)blockers.push('A previous operation lost its safety lease. Destructive maintenance is blocked until an operator confirms all old processes stopped and clears the stale state.');
   const latest=await deps.Archive.findOne({expiresAt:{$gt:deps.now()}}).sort({createdAt:-1});
   return{counts,coverage:codec.COVERAGE,limits:{maxBytes:codec.MAX_BYTES,maxUploadBytes:codec.MAX_UPLOAD_BYTES,maxRecords:codec.MAX_RECORDS},keyConfigured:codec.keyConfigured(deps.env),recoveryEnabled:recoveryEnabled(deps.env),dataVersion:state?.dataVersion||0,integrationsPaused:state?.integrationsPaused===true,maintenanceBlocked:state?.uncertainReaders===true,latestArchiveWarnings:latest?{sourceCreatedAt:latest.sourceCreatedAt,historicalAccounts:latest.historicalAccounts||0,unresolvedReferences:latest.unresolvedReferences||0}:null,resetBlocked:blockers.length>0,blockers};
  });
 }
 async function listBackups({actorId}){
  await owner(actorId);const deps=get();
  return deps.gate.withShared(async()=>({backups:(await deps.Archive.find({expiresAt:{$gt:deps.now()}}).sort({createdAt:-1}).limit(30)).map(metadata),coverage:codec.COVERAGE}));
 }
 async function resumeIntegrations({actorId,password,confirmation}){
  assertRecoveryEnabled(get().env);
  if(confirmation!==RESUME_CONFIRMATION)throw fail('Type '+RESUME_CONFIRMATION+' exactly to confirm.',400);
  const verified=await owner(actorId,password,{reauth:true}),deps=get();
  return deps.gate.withExclusive(()=>deps.transaction(async session=>{
   await confirmOwner(verified,session,deps);await deps.State.updateOne({_id:'legacy'},{$set:{integrationsPaused:false}},{session});
   if(deps.gate.assertExclusive)await deps.gate.assertExclusive(session);
   return{integrationsPaused:false};
  }));
 }
 return{createPortableArchive,readStoredArchive,inspectPortableArchive,restorePortableArchive:args=>replace({...args,reset:false}),resetWorkspace:args=>replace({...args,reset:true}),getStatus,listBackups,resumeIntegrations};
}
module.exports={...createArchiveService(),createArchiveService,RESET_CONFIRMATION,RESTORE_CONFIRMATION,RESUME_CONFIRMATION,localFileBlockers,metadata};
