const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),v8=require('node:v8');
const codec=require('../utils/workspaceArchive'),{createArchiveService,RESET_CONFIRMATION,RESTORE_CONFIRMATION}=require('../services/studioArchive');
const real=codec.registry();
function clone(value){if(value instanceof require('mongoose').Types.ObjectId)return String(value);if(Buffer.isBuffer(value))return Buffer.from(value);if(value instanceof Date)return new Date(value);if(Array.isArray(value))return value.map(clone);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,row])=>[key,clone(row)]));return value;}
const id=n=>'507f1f77bcf86cd7994'+String(n).padStart(5,'0'),ownerId=id(1),memberId=id(2),sessionId=id(3),fixed=new Date('2026-11-03T12:00:00.000Z');
const env={BACKUP_SECRET:'synthetic-archive-key-32-characters-or-longer'};
const image=Buffer.from([255,216,255,224,0,16,255,217]);
function snapshot(){
 const collections=Object.fromEntries(codec.MODEL_NAMES.map(name=>[name,[]]));
 const add=(name,data)=>collections[name].push(codec.exportRecord(name,new real[name](data).toObject()));
 add('User',{_id:ownerId,firstName:'Owner',email:'owner@example.test',password:'never-export-this-secret',role:'admin',studioOwner:true});
 add('User',{_id:memberId,firstName:'Team',email:'team@example.test',password:'never-export-this-secret',role:'admin',moduleAccess:['projects']});
 add('StudioContact',{_id:id(10),firstName:'Client',email:'client@example.test'});
 add('StudioProject',{_id:id(11),contactId:id(10),leadId:id(12),name:'Wedding',status:'Booked'});
 add('Lead',{_id:id(12),name:'Client',email:'client@example.test',contactId:id(10),studioProjectId:id(11),quotationId:id(13),totalAmount:100,paymentStatus:'Unpaid',tasks:[id(16)]});
 add('Quotation',{_id:id(13),clientName:'Client',email:'client@example.test',title:'Wedding',invoiceId:id(14),contactId:id(10),studioProjectId:id(11),lead:id(12),remindersEnabled:true,items:[{title:'Photos',quantity:1,unitPricePaise:10000}],totalPaise:10000});
 add('Invoice',{_id:id(14),clientName:'Client',invoiceDate:fixed,sourceQuotation:id(13),contactId:id(10),studioProjectId:id(11),leadId:id(12),total:100,paymentReminders:true,scheduledDelivery:{at:fixed,state:'scheduled',requestedBy:ownerId}});
 add('Photographer',{_id:id(15),name:'Crew',email:'crew@example.test'});
 add('Task',{_id:id(16),title:'Edit',lead:id(12),assignee:id(15)});
 add('Finance',{_id:id(17),type:'expense',amount:50,studioProjectId:id(11)});
 add('FinanceReceipt',{_id:id(18),financeId:id(17),mimeType:'image/jpeg',bytes:image.length,data:image,uploadedBy:ownerId});
 add('StudioProfileImage',{_id:id(19),mimeType:'image/jpeg',data:image,uploadedBy:ownerId});
 add('StudioConfig',{_id:id(20),key:'studio',studioName:'Company',logoUrl:'/api/studio/profile-images/'+id(19)});
 add('DocumentCounter',{_id:'invoice:TA-2026-27',value:50});
 add('DriveGallery',{_id:id(21),name:'Collection',clientId:memberId,passwordHash:'never-export-this-secret'});
 add('GalleryEvent',{_id:id(22),name:'Wedding',clientId:id(21),driveFolderId:'external-folder'});
 add('QuoteDelivery',{_id:id(23),quotation:id(13),revision:1,key:'historical-attempt',status:'queued',dueAt:fixed});
 return{format:codec.FORMAT,version:codec.VERSION,createdAt:fixed.toISOString(),sourceOwnerId:ownerId,coverage:codec.COVERAGE,collections};
}
function fixture({source=snapshot(),failInsert,blockers=[],differentOwner=false}={}){
 const state={db:{},commits:0,rollbacks:0,reauth:[],gate:[],rowsRead:[]};
 for(const name of codec.MODEL_NAMES)state.db[name]=source.collections[name].map(row=>codec.decodedRecord(name,row));
 const actingId=differentOwner?id(99):ownerId;
 state.db.User=state.db.User.filter(row=>row._id!==ownerId);
 state.db.User.unshift({_id:actingId,firstName:'Current',email:'current@example.test',password:'current-private-hash',role:'admin',studioOwner:true,sessionVersion:4,workspaceDataVersion:3,googleRefreshToken:'old-private-provider-token'});
 if(differentOwner)for(const name of codec.MODEL_NAMES.filter(name=>name!=='User')){const walk=value=>{if(!value||typeof value!=='object'||Buffer.isBuffer(value)||value instanceof Date)return;for(const key of Object.keys(value)){if(value[key]===ownerId)value[key]=actingId;else walk(value[key]);}};for(const row of state.db[name])walk(row);}
 state.db.AdminSession=[{_id:sessionId,user:actingId,version:4,expiresAt:new Date('2026-11-04T12:00:00Z'),revokedAt:null},{_id:id(44),user:memberId,revokedAt:null}];
 state.db.StudioPushDevice=[{_id:id(50),workspaceKey:'legacy'},{_id:id(51),workspaceKey:id(52)}];
 state.db.StudioArchiveState=[{_id:'legacy',dataVersion:3,integrationsPaused:false}];state.db.StudioArchive=[];state.db.StudioArchiveChunk=[];state.db.SaaSAccount=[{_id:'global-preserved'}];
 for(const name of codec.RESET_CREDENTIAL_MODELS)state.db[name]=[{_id:'private-'+name}];
 const selected=session=>session?.db||state.db;
 function matches(row,filter){return Object.entries(filter).every(([key,value])=>{if(value&&typeof value==='object'&&!(value instanceof Date)){if('$ne'in value)return String(row[key])!==String(value.$ne);if('$gt'in value)return new Date(row[key])>new Date(value.$gt);}return String(row[key])===String(value);});}
 function query(fn){return{_session:null,select(){return this;},sort(){return this;},limit(){return this;},lean(){return this;},session(value){this._session=value;return this;},then(resolve,reject){return Promise.resolve().then(()=>fn(this._session)).then(resolve,reject);}};}
 const model=name=>{
  const Real=real[name];function Model(...args){return new Real(...args);}Model.schema=Real?.schema;Model.modelName=name;
  Model.findById=value=>query(session=>selected(session)[name].find(row=>String(row._id)===String(value))||null);
  Model.findOne=filter=>query(session=>selected(session)[name].find(row=>matches(row,filter))||null);
  Model.find=filter=>query(session=>selected(session)[name].filter(row=>matches(row,filter||{})));
  Model.countDocuments=async()=>state.db[name].length;
  Model.create=async(rows,{session}={})=>{const output=rows.map(row=>({...clone(row),createdAt:fixed}));selected(session)[name].push(...output);return output;};
  Model.insertMany=async(rows,{session}={})=>{if(name===failInsert)throw Error('synthetic insertion failure');selected(session)[name].push(...clone(rows));return rows;};
  Model.deleteMany=async(filter,{session}={})=>{selected(session)[name]=selected(session)[name].filter(row=>!matches(row,filter));return{acknowledged:true};};
  Model.updateOne=async(filter,update,{session}={})=>{const row=selected(session)[name].find(row=>matches(row,filter));if(!row)return{matchedCount:0};Object.assign(row,clone(update.$set||{}));for(const key of Object.keys(update.$unset||{}))delete row[key];return{matchedCount:1};};
  return Model;
 };
 const registry=Object.fromEntries(codec.MODEL_NAMES.map(name=>[name,model(name)])),User=registry.User;
 const gate={withShared:async fn=>{state.gate.push('shared');return fn();},withExclusive:async fn=>{state.gate.push('exclusive');return fn();},assertExclusive:async()=>{state.gate.push('fenced');},getState:async()=>state.db.StudioArchiveState[0]};
 const service=createArchiveService({registry,User,Session:model('AdminSession'),PushDevice:model('StudioPushDevice'),Archive:model('StudioArchive'),Chunk:model('StudioArchiveChunk'),State:model('StudioArchiveState'),credentialModels:Object.fromEntries(codec.RESET_CREDENTIAL_MODELS.map(name=>[name,model(name)])),gate,env,now:()=>new Date(fixed),fileBlockers:async()=>blockers,
  comparePassword:async(input,hash)=>{state.reauth.push([input,hash]);return input==='correct-owner-password'&&hash==='current-private-hash';},
  readRows:async function*(Model,session){state.rowsRead.push(Model.modelName);for(const row of selected(session)[Model.modelName])yield row;},
  transaction:async work=>{const staged={db:clone(state.db)};try{const result=await work(staged);state.db=staged.db;state.commits++;return result;}catch(error){state.rollbacks++;throw error;}},
 });
 return{state,service,actingId,args:{actorId:actingId,password:'correct-owner-password',currentSessionId:sessionId}};
}
test('portable snapshot covers company, team, finance images, galleries and string counters without credentials',()=>{
 const value=snapshot();assert.equal(codec.validateSnapshot(value),value);
 assert.ok(codec.MODEL_NAMES.includes('FinanceReceipt'));assert.ok(codec.MODEL_NAMES.includes('StudioProfileImage'));assert.ok(codec.MODEL_NAMES.includes('User'));assert.ok(codec.MODEL_NAMES.includes('DocumentCounter'));
 const text=JSON.stringify(value);assert.equal(text.includes('never-export-this-secret'),false);assert.equal(value.collections.FinanceReceipt[0].data.base64,image.toString('base64'));assert.ok(value.coverage.exclusions.some(line=>line.includes('Local uploaded chat/media')));
});
test('encrypted archive is authenticated and requires its original configured server key',()=>{
 const value=snapshot(),sealed=codec.seal(value,env);assert.equal(JSON.stringify(sealed).includes('client@example.test'),false);assert.deepEqual(codec.unseal(sealed,env),value);
 assert.throws(()=>codec.unseal(sealed,{BACKUP_SECRET:'different-archive-key-that-is-still-long'}),error=>error.status===400);
 assert.throws(()=>codec.unseal({...sealed,tag:Buffer.alloc(16).toString('base64')},env),error=>error.status===400);
 assert.throws(()=>codec.unseal({...sealed,algorithm:'none'},env),error=>error.status===400);
 assert.throws(()=>codec.seal(value,{BACKUP_SECRET:'short'}),error=>error.status===503);
});
test('malicious and partial archives reject secrets, unknown collections, unsafe keys and invalid relationships',()=>{
 const variants=[];
 let value=snapshot();delete value.collections.Invoice;variants.push(value);
 value=snapshot();value.collections.User[1].studioOwner=true;variants.push(value);
 value=snapshot();value.collections.User[1].password='not-allowed';variants.push(value);
 value=snapshot();value.collections.Task[0].lead=id(999);variants.push(value);
 value=snapshot();value.collections.FinanceReceipt[0].bytes=99;variants.push(value);
 value=snapshot();value.collections.StudioProject[0].contactId=id(999);variants.push(value);
 value=snapshot();value.collections.User.push(clone(value.collections.User[0]));variants.push(value);
 value=snapshot();value.collections.StudioConfig[0]=JSON.parse('{"_id":"'+id(20)+'","key":"studio","__proto__":{"polluted":true}}');variants.push(value);
 for(const candidate of variants)assert.throws(()=>codec.validateSnapshot(candidate),error=>error.status===400||error.status===413);
 assert.equal({}.polluted,undefined);
});
test('archive exports redact sharing capabilities, provider fields and user secrets',()=>{
 const row=codec.exportRecord('User',{_id:ownerId,firstName:'Owner',email:' OWNER@EXAMPLE.TEST ',password:'private',vaultPassword:'private',googleRefreshToken:'private',sessionVersion:4,studioOwner:true,role:'admin'});
 assert.deepEqual(row,{_id:ownerId,firstName:'Owner',email:'owner@example.test',role:'admin'});
 assert.equal(codec.portable({shareToken:'private',url:'https://example.test/quote/'+ownerId,note:'normal'}).url.includes(ownerId),false);
});
test('creation snapshots all supported data into encrypted chunks and owner history',async()=>{
 const {service,state,args}=fixture();const result=await service.createPortableArchive(args);
 assert.ok(result.backupId);assert.equal(state.db.StudioArchive.length,1);assert.ok(state.db.StudioArchiveChunk.length);
 assert.equal(JSON.stringify(state.db.StudioArchiveChunk).includes('current-private-hash'),false);
 assert.deepEqual(codec.validateSnapshot(codec.unseal(result.archive,env)).collections.User.map(row=>row.role),['admin','admin']);
 assert.equal(state.rowsRead.length,codec.MODEL_NAMES.length);
});
test('wrong actor password and nonowner accounts never enter destructive work',async()=>{
 const f=fixture();await assert.rejects(f.service.resetWorkspace({...f.args,password:'legacy-master-password',confirmation:RESET_CONFIRMATION}),error=>error.status===400);
 assert.equal(f.state.commits,0);assert.equal(f.state.gate.includes('exclusive'),false);
 f.state.db.User[0].studioOwner=false;await assert.rejects(f.service.resetWorkspace({...f.args,confirmation:RESET_CONFIRMATION}),error=>error.status===403);
 assert.equal(f.state.commits,0);
});
test('literal confirmations, active current session and personal-studio boundary fail closed',async()=>{
 const f=fixture();await assert.rejects(f.service.resetWorkspace({...f.args,confirmation:'yes'}),error=>error.status===400);
 f.state.db.AdminSession=[];await assert.rejects(f.service.resetWorkspace({...f.args,confirmation:RESET_CONFIRMATION}),error=>error.status===409);
 const context=require('../saas/tenantContext'),workspaceId=id(90);
 await assert.rejects(context.runInWorkspace({_id:workspaceId,databaseName:'studio_'+workspaceId},()=>f.service.resetWorkspace({...f.args,confirmation:RESET_CONFIRMATION})),error=>error.status===403);
 assert.equal(f.state.db.StudioProject.length,1);
});
test('reset transaction preserves actual owner credentials and current session, blocks other users and SaaS/global scope',async()=>{
 const f=fixture(),ownerBefore=clone(f.state.db.User[0]),result=await f.service.resetWorkspace({...f.args,confirmation:RESET_CONFIRMATION});
 assert.equal(result.ownerPreserved,true);assert.equal(result.dataVersion,4);assert.ok(result.safetyBackupId);
 assert.equal(f.state.db.User.length,1);assert.equal(f.state.db.User[0].password,ownerBefore.password);assert.equal(f.state.db.User[0].email,ownerBefore.email);assert.equal(f.state.db.User[0].studioOwner,true);assert.equal(f.state.db.User[0].googleRefreshToken,undefined);
 for(const name of codec.MODEL_NAMES.filter(name=>name!=='User'))assert.equal(f.state.db[name].length,0,name);
 assert.equal(f.state.db.AdminSession.length,1);assert.equal(f.state.db.AdminSession[0]._id,sessionId);
 assert.deepEqual(f.state.db.StudioPushDevice,[{_id:id(51),workspaceKey:id(52)}]);assert.deepEqual(f.state.db.SaaSAccount,[{_id:'global-preserved'}]);
 for(const name of codec.RESET_CREDENTIAL_MODELS)assert.equal(f.state.db[name].length,0,name);
 assert.equal(f.state.db.StudioArchive.length,1);assert.equal(f.state.db.StudioArchiveState[0].integrationsPaused,true);
 assert.equal(f.state.db.User[0].workspaceDataVersion,4);assert.ok(f.state.gate.includes('fenced'));
});
test('restore maps source owner references, restores binary bytes and leaves all other accounts disabled',async()=>{
 const f=fixture({differentOwner:true}),archive=codec.seal(snapshot(),env),result=await f.service.restorePortableArchive({...f.args,archive,confirmation:RESTORE_CONFIRMATION});
 assert.equal(result.restoredMembersDisabled,1);assert.equal(f.state.db.User.find(row=>row._id===f.actingId).password,'current-private-hash');
 assert.equal(f.state.db.User.some(row=>row._id===ownerId),false);
 const member=f.state.db.User.find(row=>row._id===memberId);assert.equal(member.accountDisabled,true);assert.equal(member.studioOwner,false);assert.deepEqual(member.moduleAccess,['projects']);
 assert.equal(f.state.db.FinanceReceipt[0].uploadedBy,f.actingId);assert.deepEqual(f.state.db.FinanceReceipt[0].data,image);
 assert.equal(f.state.db.Quotation[0].remindersEnabled,false);assert.equal(f.state.db.Invoice[0].paymentReminders,false);assert.equal(f.state.db.Invoice[0].scheduledDelivery,undefined);assert.equal(f.state.db.QuoteDelivery[0].status,'cancelled');
});
test('failed restore rolls back deletes, archive chunks, memberships and acting owner credentials',async()=>{
 const f=fixture({failInsert:'Invoice'}),before=clone(f.state.db),archive=codec.seal(snapshot(),env);
 await assert.rejects(f.service.restorePortableArchive({...f.args,archive,confirmation:RESTORE_CONFIRMATION}),/synthetic insertion/);
 assert.deepEqual(f.state.db,before);assert.equal(f.state.rollbacks,1);assert.equal(f.state.commits,0);
});
test('local uploaded files block destructive operations before transaction and recovery snapshot failure aborts deletion',async()=>{
 const f=fixture({blockers:['Local chat files exist.']});await assert.rejects(f.service.resetWorkspace({...f.args,confirmation:RESET_CONFIRMATION}),error=>error.status===409);
 assert.equal(f.state.commits,0);assert.equal(f.state.db.StudioProject.length,1);
 const g=fixture({failInsert:'StudioArchiveChunk'}),before=clone(g.state.db);await assert.rejects(g.service.resetWorkspace({...g.args,confirmation:RESET_CONFIRMATION}),/synthetic insertion/);assert.deepEqual(g.state.db,before);
});
test('import cannot collide with the current owner or create a reserved fallback owner',async()=>{
 const f=fixture(),value=snapshot();value.collections.User[1].email='current@example.test';
 await assert.rejects(f.service.restorePortableArchive({...f.args,archive:codec.seal(value,env),confirmation:RESTORE_CONFIRMATION}),error=>error.status===400);
 assert.equal(f.state.db.StudioProject.length,1);
});
test('stored encrypted history checks contiguous chunks and integrity before download',async()=>{
 const f=fixture(),created=await f.service.createPortableArchive(f.args),download=await f.service.readStoredArchive({actorId:f.actingId,backupId:created.backupId});
 assert.deepEqual(download,created.archive);
 f.state.db.StudioArchiveChunk[0].data+='tampered';
 await assert.rejects(f.service.readStoredArchive({actorId:f.actingId,backupId:created.backupId}),error=>error.status===409);
});
test('disabled restored accounts are rejected by current-user REST authentication',async()=>{
 const jwt=require('jsonwebtoken'),{createAuth}=require('../middleware/auth'),secret='synthetic-disabled-account-auth-secret';
 const auth=createAuth({User:{findById:()=>({select:async()=>({_id:memberId,role:'admin',accountDisabled:true,moduleAccess:null})})},env:{JWT_SECRET:secret},verifySession:async()=>assert.fail('Disabled account must stop before session verification')});
 const token=jwt.sign({user:{id:memberId,role:'admin'}},secret),req={headers:{authorization:'Bearer '+token},header:()=>undefined},out={status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
 let passed=false;await auth(req,out,()=>{passed=true;});assert.equal(out.code,401);assert.equal(passed,false);
});

test('only an owner setting a fresh password can reactivate an imported member',async t=>{
 const User=require('../models/User'),Session=require('../models/AdminSession'),router=require('../routes/adminUserRoutes');
 const target={_id:memberId,role:'admin',email:'member@example.test',accountDisabled:true,moduleAccess:['projects'],sessionVersion:1,password:'!disabled!',save:async()=>{}};
 t.mock.method(User,'findById',()=>({select:async()=>target}));
 t.mock.method(Session,'updateMany',async()=>({acknowledged:true}));
 const handler=router.stack.find(layer=>layer.route?.path==='/:id'&&layer.route.methods.put).route.stack.at(-1).handle;
 const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}});
 let out=response();await handler({user:{id:ownerId,role:'admin',studioOwner:false,moduleAccess:null},params:{id:memberId},body:{password:'fresh-owner-password'}},out);
 assert.equal(out.statusCode,403);assert.equal(target.accountDisabled,true);
 out=response();await handler({user:{id:ownerId,role:'admin',studioOwner:true,moduleAccess:null},params:{id:memberId},body:{password:'fresh-owner-password'}},out);
 assert.equal(out.statusCode,200);assert.equal(target.accountDisabled,false);assert.equal(await require('bcryptjs').compare('fresh-owner-password',target.password),true);
});
test('disabled imported users cannot obtain a new login session even with a matching old password',async()=>{
 const {createLoginHandler}=require('../utils/adminBootstrap');
 const handler=createLoginHandler({User:{find:()=>({limit:async()=>[{_id:memberId,role:'admin',email:'member@example.test',password:'old-hash',accountDisabled:true}]})},env:{JWT_SECRET:'synthetic'},compare:async()=>assert.fail('Disabled users must stop before password verification'),issueSession:async()=>assert.fail('Disabled users must not receive a session')});
 const out={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await handler({body:{email:'member@example.test',password:'old-password'}},out);assert.equal(out.code,400);
});

test('all local uploaded files, including leftover temporary media, block destructive actions',async()=>{
 const {localFileBlockers}=require('../services/studioArchive');
 const directory={name:'temp',isDirectory:()=>true,isFile:()=>false};
 const file={name:'photo.jpg',isDirectory:()=>false,isFile:()=>true};
 const blockers=await localFileBlockers({directory:'/virtual/uploads',readDirectory:async name=>name.endsWith('/temp')?[file]:[directory]});
 assert.equal(blockers.length,1);assert.match(blockers[0],/chat\/media/);
 assert.deepEqual(await localFileBlockers({directory:'/virtual/uploads',readDirectory:async()=>[]}),[]);
 const symlink={name:'unknown-link',isDirectory:()=>false,isFile:()=>false};
 assert.equal((await localFileBlockers({directory:'/virtual/uploads',readDirectory:async()=>[symlink]})).length,1);
});
test('capture after team deletion preserves historical uploader, notification and chat references as disabled placeholders',async()=>{
 const f=fixture();f.state.db.User=f.state.db.User.filter(row=>row._id!==memberId);
 f.state.db.FinanceReceipt[0].uploadedBy=memberId;f.state.db.StudioProfileImage[0].uploadedBy=memberId;
 f.state.db.Notification.push({_id:id(60),title:'History',type:'System',readBy:[memberId],hiddenBy:[]});
 f.state.db.Message.push({_id:id(61),sender:memberId,senderName:'Former person',recipient:ownerId,text:'Historical message'});
 f.state.db.ChatRoom.push({_id:id(62),userId:memberId});
 const saved=await f.service.createPortableArchive(f.args),value=codec.validateSnapshot(codec.unseal(saved.archive,env));
 assert.deepEqual(value.historicalUserIds,[memberId]);const former=value.collections.User.find(row=>row._id===memberId);
 assert.equal(former.role,'client');assert.deepEqual(former.moduleAccess,[]);assert.equal(former.password,undefined);
 assert.equal(value.collections.FinanceReceipt[0].uploadedBy,memberId);assert.equal(saved.summary.historicalAccounts,1);
 await f.service.restorePortableArchive({...f.args,archive:saved.archive,confirmation:RESTORE_CONFIRMATION});
 assert.equal(f.state.db.User.find(row=>row._id===memberId).accountDisabled,true);
});
test('authenticated unresolved-reference manifest preserves dangling business IDs and receipt bytes without fabricating parents',async()=>{
 const f=fixture();f.state.db.Finance=[];f.state.db.Photographer=[];f.state.db.Lead=[];
 const saved=await f.service.createPortableArchive(f.args),value=codec.unseal(saved.archive,env);
 assert.ok(value.unresolvedReferences.some(row=>row.model==='FinanceReceipt'&&row.path==='financeId'&&row.target==='Finance'));
 assert.ok(value.unresolvedReferences.some(row=>row.model==='Task'&&row.path==='assignee'&&row.target==='Photographer'));
 assert.ok(value.unresolvedReferences.some(row=>row.target==='Lead'));
 assert.equal(codec.validateSnapshot(value),value);
 const tampered=clone(value);tampered.unresolvedReferences=[];assert.throws(()=>codec.validateSnapshot(tampered),error=>error.status===400);
 await f.service.restorePortableArchive({...f.args,archive:saved.archive,confirmation:RESTORE_CONFIRMATION});
 assert.equal(f.state.db.Finance.length,0);assert.equal(f.state.db.FinanceReceipt[0].financeId,id(17));assert.deepEqual(f.state.db.FinanceReceipt[0].data,image);
});
test('historical documents and mutable project/enquiry backlinks need not match current project client identities',()=>{
 const value=snapshot();value.collections.StudioContact.push(codec.exportRecord('StudioContact',new real.StudioContact({_id:id(70),firstName:'New client',email:'new@example.test'}).toObject()));
 value.collections.StudioProject[0].contactId=id(70);value.collections.StudioProject[0].leadId=undefined;delete value.collections.StudioProject[0].leadId;
 assert.equal(codec.validateSnapshot(value),value);
});
test('restored company security policies retain strict bounds',()=>{
 const value=snapshot();value.collections.StudioConfig[0].security.absoluteSessionHours=100000000;
 assert.throws(()=>codec.validateSnapshot(value),error=>error.status===400);
});

test('import recomputes declared reference gaps and rejects forged former-account markers',()=>{
 const value=snapshot();value.historicalUserIds=[memberId];
 assert.throws(()=>codec.validateSnapshot(value),error=>error.status===400);
 const wrong=snapshot();wrong.unresolvedReferences=[{model:'Task',id:id(16),path:'lead',target:'Lead',targetId:id(12)}];
 assert.throws(()=>codec.validateSnapshot(wrong),error=>error.status===400);
 const captured=snapshot();captured.collections.User=captured.collections.User.filter(row=>row._id!==memberId);codec.addHistoricalUsers(captured);
 captured.unresolvedReferences=codec.unresolvedReferences(captured.collections,real);assert.equal(codec.validateSnapshot(captured),captured);
 captured.collections.User.find(row=>row._id===memberId).firstName='Owner impersonation';
 assert.throws(()=>codec.validateSnapshot(captured),error=>error.status===400);
});
