const test=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const modules=require('../utils/moduleAccess');
const {createAuth}=require('../middleware/auth');
const {createSocketAuth}=require('../realtime/studioSocket');
const User=require('../models/User'),Session=require('../models/AdminSession');
const router=require('../routes/adminUserRoutes');
const id='507f1f77bcf86cd799439011',otherId='507f1f77bcf86cd799439012';
const secret='synthetic-module-access-session-test-secret';
const actor=(moduleAccess=['overview'])=>({_id:id,id,role:'admin',moduleAccess,studioOwner:false});
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},set(){return this;}});
const route=(path,method)=>router.stack.find(layer=>layer.route?.path===path&&layer.route.methods[method]).route;
async function authorize(saved,url,body={},method='GET'){
 const auth=createAuth({User:{findById(){return{select:async()=>saved};}},env:{JWT_SECRET:secret},verifySession:async()=>null});
 const token=jwt.sign({user:{id,role:'admin',moduleAccess:null,studioOwner:true}},secret);
 const req={originalUrl:url,url,method,body,headers:{authorization:'Bearer '+token},header:()=>undefined};
 const res=response();let passed=false;await auth(req,res,()=>{passed=true;});return{req,res,passed};
}
test('module allowlists validate known unique IDs and preserve explicit empty restrictions',()=>{
 assert.equal(modules.parseModuleAccess(null),null);assert.deepEqual(modules.parseModuleAccess([]),[]);
 for(const value of ['finance',{},['unknown'],['finance','finance'],[null]])assert.throws(()=>modules.parseModuleAccess(value),error=>error.status===400);
 assert.equal(new User({firstName:'Crew',email:'crew@example.test',password:'hashed',role:'admin'}).moduleAccess,null);
 assert.ok(new User({firstName:'Crew',email:'crew@example.test',password:'hashed',role:'admin',moduleAccess:['unknown']}).validateSync());
});
test('direct REST requests use current database modules, ignoring JWT owner and access claims',async()=>{
 const denied=await authorize(actor(['projects']),'/api/finance/overview');assert.equal(denied.res.statusCode,403);assert.equal(denied.passed,false);
 assert.equal(denied.req.user.studioOwner,false);assert.deepEqual(denied.req.user.moduleAccess,['projects']);
 assert.equal((await authorize(actor(['finance']),'/api/studio/finance')).passed,true);
 assert.equal((await authorize(actor(['projects']),'/api/finance/overview')).passed,false);
});
test('restricted users cannot bypass via alternate verbs, paths, aggregates, exports or capabilities',async()=>{
 for(const [method,path]of [['HEAD','/api/finance'],['POST','/api/invoices'],['GET','/API/FINANCE'],['GET','/api/%66inance/overview'],['GET','/api/dashboard/studio-overview'],['GET','/api/studio/search?q=invoice'],['GET','/api/notifications'],['GET','/api/google-sheets'],['GET','/api/studio/security/backups'],['POST','/api/admin-users/update-master'],['GET','/api/future-private-api'],['GET','/api/studio/quotations/'+id+'/client-link'],['GET','/api/studio/quotations/'+id+'/email-history'],['POST','/api/studio/quotations/'+id+'/email'],['PUT','/api/studio/quotations/'+id+'/settings']]){
  const out=await authorize(actor(['overview','projects','quotations','team','data']),path,{},method);assert.equal(out.res.statusCode,403,method+' '+path);assert.equal(out.passed,false);
 }
 for(const path of ['/api/auth/me','/api/studio/preferences','/api/studio/security/access','/api/studio/security/logout'])assert.equal((await authorize(actor([]),path)).passed,true,path);
});
test('legacy administrators and the saved studio owner retain existing full access',async()=>{
 for(const saved of [actor(null),{...actor([]),studioOwner:true}])assert.equal((await authorize(saved,'/api/dashboard/studio-overview')).passed,true);
 assert.equal((await authorize(actor(['unknown']),'/api/finance')).passed,false);
 assert.equal(modules.accessPayload(actor(null)).canManageTeam,true);assert.equal(modules.accessPayload(actor([])).canManageTeam,false);
});
test('operational responses redact nested finance, quotation, crew, production and credential fields',async()=>{
 const out=await authorize(actor(['enquiries']),'/api/leads');assert.equal(out.passed,true);
 const record={name:'Private enquiry',totalAmount:100,depositAmount:20,paymentStatus:'Paid',quotationId:otherId,cloudPassword:'private',cloudLink:'private',people:['Crew'],tasks:[{lead:{totalAmount:100}}],googleRefreshToken:'private'};
 out.res.json([record]);assert.deepEqual(out.res.body,[{name:'Private enquiry'}]);assert.equal(record.totalAmount,100);
 const finances=modules.sanitizeOperational(record,actor(['enquiries','finance']));assert.equal(finances.totalAmount,100);assert.equal(finances.quotationId,undefined);
});
test('hidden operational fields cannot be written even when the base module is allowed',async()=>{
 for(const body of [{totalAmount:0},{depositAmount:0},{paymentStatus:'Paid'},{people:[]},{tasks:[]},{cloudLink:''},{createAccount:true}]){
  const out=await authorize(actor(['enquiries']),'/api/leads/'+id,body,'PATCH');assert.equal(out.res.statusCode,403);assert.equal(out.passed,false);
 }
 assert.equal((await authorize(actor(['enquiries']),'/api/leads/'+id,{remarks:'Review'},'PATCH')).passed,true);
});
test('team scope guards prevent self escalation, owner changes and taking over broader accounts',()=>{
 const manager=actor(['team','projects']);assert.deepEqual(modules.assertGrant(manager,['projects']),['projects']);
 for(const scope of [null,['finance'],['team','projects','finance']])assert.throws(()=>modules.assertGrant(manager,scope),error=>error.status===403);
 for(const target of [{...manager,_id:id},{...actor([]),_id:otherId,studioOwner:true},{...actor(null),_id:otherId},{...actor(['finance']),_id:otherId}])assert.throws(()=>modules.assertManagedTarget(manager,target),error=>error.status===403);
 assert.doesNotThrow(()=>modules.assertManagedTarget(manager,{...actor(['projects']),_id:otherId,id:otherId}));
});
test('scoped team managers can create an administrator within their own module scope',async t=>{
 let created;
 t.mock.method(User,'findOne',async()=>null);
 t.mock.method(User.prototype,'save',async function(){created=this;return this;});
 const res=response();await route('/create','post').stack.at(-1).handle({user:actor(['projects','team']),body:{firstName:'One',lastName:'',email:'one@example.test',password:'synthetic-team-password',role:'admin',moduleAccess:['projects']}},res);
 assert.equal(res.statusCode,201);assert.equal(created.role,'admin');assert.deepEqual([...created.moduleAccess],['projects']);assert.equal(created.vaultPassword,undefined);assert.equal(created.iv,undefined);
 assert.equal(await require('bcryptjs').compare('synthetic-team-password',created.password),true);
});
test('team directory exposes access metadata without reversible passwords or provider secrets',async t=>{
 t.mock.method(User,'find',()=>({sort:async()=>[{_id:otherId,firstName:'Team',email:'team@example.test',role:'admin',moduleAccess:['projects'],password:'hash',plainPassword:'private',vaultPassword:'private',iv:'private',cloudPassword:'private',googleRefreshToken:'private'}]}));
 const res=response();await route('/','get').stack.at(-1).handle({user:actor(null)},res);
 assert.equal(res.statusCode,200);assert.deepEqual(res.body[0].moduleAccess,['projects']);assert.equal(res.body[0].studioOwner,false);assert.equal(/private|hash|plainPassword|vaultPassword|googleRefreshToken/.test(JSON.stringify(res.body)),false);
});
test('team access updates persist session-version revocation and disconnect active sockets',async t=>{
 const events=[],target={_id:otherId,role:'admin',moduleAccess:['projects'],sessionVersion:3,save:async()=>events.push('saved')};
 t.mock.method(User,'findById',()=>({select:async()=>target}));
 t.mock.method(Session,'updateMany',async(filter,update)=>{assert.equal(String(filter.user),otherId);assert.ok(update.$set.revokedAt instanceof Date);events.push('revoked');});
 const req={user:actor(null),params:{id:otherId},body:{moduleAccess:['projects','production']},app:{get:()=>({sockets:{sockets:new Map([['socket',{user:{id:otherId},disconnect:()=>events.push('disconnected')}]])}})}};
 const res=response();await route('/:id','put').stack.at(-1).handle(req,res);
 assert.equal(res.statusCode,200);assert.equal(target.sessionVersion,4);assert.deepEqual(target.moduleAccess,['projects','production']);assert.deepEqual(events,['saved','disconnected','revoked']);
});
test('restricted sockets cannot join shared studio rooms or receive cross-module broadcasts',async()=>{
 const auth=createSocketAuth({User:{findById:()=>({select:async()=>actor(['projects'])})},getSecret:()=>secret,verifySession:async()=>null});
 const socket={handshake:{auth:{token:jwt.sign({user:{id,role:'admin'}},secret)}}};let error;await auth(socket,value=>{error=value;});assert.ok(error);assert.equal(socket.user,undefined);
});
test('restricted settings expose permitted defaults while protecting security and recovery',()=>{
 const value={studioName:'Studio',security:{permissions:{exports:'all_admins'}},backups:{enabled:true},bankDetails:'private',productionDefaults:{templates:[]},quotationTerms:'Quote terms'};
 assert.deepEqual(modules.safeSettings(value,actor(['overview'])),{studioName:'Studio'});
 assert.deepEqual(modules.safeSettings(value,actor(['quotations'])),{studioName:'Studio',bankDetails:'private',quotationTerms:'Quote terms'});
 assert.equal(modules.safeSettings(value,actor(null)),value);
});
test('contact detail never queries documents or project groups from hidden modules',async t=>{
 const Contact=require('../models/StudioContact'),Project=require('../models/StudioProject'),Quote=require('../models/Quotation'),Invoice=require('../models/Invoice'),Event=require('../models/Event'),Document=require('../models/ContactDocument');
 t.mock.method(Contact,'findOne',async()=>({_id:id,firstName:'Client',email:'client@example.test'}));
 for(const Model of [Project,Quote,Invoice,Event])t.mock.method(Model,'find',()=>assert.fail('Hidden module queried: '+Model.modelName));
 t.mock.method(Document,'find',()=>({sort(){return this;},lean:async()=>[]}));
 const contacts=require('../routes/contactRoutes'),handler=contacts.stack.find(layer=>layer.route?.path==='/contacts/:id'&&layer.route.methods.get).route.stack.at(-1).handle;
 const res=response();await handler({user:actor(['contacts']),params:{id}},res);
 assert.equal(res.statusCode,200);for(const field of ['projects','quotations','invoices','sessions'])assert.deepEqual(res.body[field],[]);
});
test('scoped settings save only submitted branding fields and reject hidden module changes',async t=>{
 const Config=require('../models/StudioConfig'),studio=require('../routes/studioRoutes');
 const handler=studio.stack.find(layer=>layer.route?.path==='/settings'&&layer.route.methods.put).route.stack.at(-1).handle;
 const saved=new Config({studioName:'Saved',invoicePrefix:'TA'});let update;
 t.mock.method(Config,'findOne',async()=>saved);
 t.mock.method(Config,'findOneAndUpdate',async(_filter,value)=>{update=value;return saved;});
 const res=response();await handler({user:actor(['settings']),body:{studioName:'Scoped'}},res);
 assert.equal(res.statusCode,200);assert.deepEqual(update.$set,{studioName:'Scoped'});
 const denied=response();await handler({user:actor(['settings']),body:{studioName:'Scoped',bankDetails:'redirect'}},denied);
 assert.equal(denied.statusCode,403);
});
test('a renamed owner cannot be impersonated through the vacant configured owner email',async t=>{
 const former=process.env.ADMIN_EMAIL;process.env.ADMIN_EMAIL='owner@example.test';t.after(()=>{if(former===undefined)delete process.env.ADMIN_EMAIL;else process.env.ADMIN_EMAIL=former;});
 t.mock.method(User,'findOne',async()=>null);
 t.mock.method(User.prototype,'save',async()=>assert.fail('Reserved owner address must never be saved'));
 const body={firstName:'Other',email:' OWNER@example.test ',password:'synthetic-team-password',moduleAccess:['projects']};
 for(const manager of [actor(['team','projects']),actor(null)]){
  const created=response();await route('/create','post').stack.at(-1).handle({user:manager,body},created);assert.equal(created.statusCode,400);
  const updated=response();await route('/:id','put').stack.at(-1).handle({user:manager,params:{id:otherId},body:{email:body.email}},updated);assert.equal(updated.statusCode,400);
 }
});
test('finance-only accounts cannot use legacy invoice aliases or read hidden document aggregates',async t=>{
 for(const [method,url] of [['GET','/api/finance/overview'],['GET','/api/finance/pending-payments'],['DELETE','/api/finance/income/Invoice/'+otherId],['PATCH','/api/studio/booking-payments/'+otherId]])assert.equal((await authorize(actor(['finance']),url,{},method)).passed,false,url);
 const Lead=require('../models/Lead'),Invoice=require('../models/Invoice'),Finance=require('../models/Finance');
 t.mock.method(Lead,'find',()=>assert.fail('Hidden enquiries queried'));
 t.mock.method(Invoice,'find',()=>assert.fail('Hidden invoices queried'));
 t.mock.method(Finance,'find',()=>({sort(){return this;},lean:async()=>[{type:'Income',amount:10}]}));
 const studio=require('../routes/studioRoutes');const handler=studio.stack.find(layer=>layer.route?.path==='/finance'&&layer.route.methods.get).route.stack.at(-1).handle;
 const res=response();await handler({user:actor(['finance'])},res);
 assert.equal(res.statusCode,200);assert.deepEqual(res.body,{leads:[],invoices:[],entries:[{type:'Income',amount:10}]});
});
test('ordinary calendar and task edits preserve omitted hidden crew while explicit assignments are forbidden',async()=>{
 for(const [url,body] of [['/api/calendar/'+otherId,{teamMembers:[]}],['/api/tasks/'+otherId,{assignee:''}],['/api/leads/'+otherId+'/tasks',{assignee:otherId}]]){
  const result=await authorize(actor(['calendar','production','enquiries']),url,body,'PATCH');assert.equal(result.res.statusCode,403,url);
 }
 for(const url of ['/api/calendar/'+otherId,'/api/tasks/'+otherId])assert.equal((await authorize(actor(['calendar','production']),url,{title:'Keep crew unchanged'},'PATCH')).passed,true,url);
});
