const http = require('node:http');
const frontendOrigin='http://127.0.0.1:5176';
const { buildStudioOverview } = require('../../backend/utils/studioOverview');
const { studioDayStart } = require('../../backend/utils/studioDay');
const { overviewTimezone, overviewInsightWindow, groupOverviewRecords, buildOverviewInsights } = require('../../backend/utils/studioOverviewInsights');
const { Server } = require('../../backend/node_modules/socket.io');
const base = new Date();
const inDays = (days,hour=10) => { const d=new Date(base);d.setDate(d.getDate()+days);d.setHours(hour,0,0,0);return d.toISOString(); };
const dateOnly = days => inDays(days).slice(0,10);
let leads = [
{_id:'l1',name:'Maya & Aditya',email:'maya@example.com',phone:'+919800000001',status:'Meeting',eventType:'Wedding',eventDate:dateOnly(48),eventLocation:'Bengaluru',followUpDate:dateOnly(1),totalAmount:280000,depositAmount:0,paymentStatus:'Unpaid',people:['Arun Kumar'],createdAt:inDays(-1),tasks:[]},
{_id:'l2',name:'Riya & Karthik',email:'riya@example.com',phone:'+919800000002',status:'Converted',eventType:'Wedding',eventDate:dateOnly(3),eventLocation:'The Leela, Bengaluru',totalAmount:360000,depositAmount:120000,paymentStatus:'Deposit Paid',people:['Arun Kumar','Sara Joseph'],createdAt:inDays(-3),tasks:[]},
{_id:'l3',name:'Nisha & Varun',email:'nisha@example.com',phone:'+919800000003',status:'New',eventType:'Engagement',eventDate:dateOnly(32),eventLocation:'Mysuru',totalAmount:90000,paymentStatus:'Unpaid',createdAt:inDays(-4),tasks:[]},
{_id:'l4',name:'Anika & Dev',email:'anika@example.com',phone:'+919800000004',status:'Follow-up',eventType:'Pre-Wedding',eventDate:dateOnly(25),eventLocation:'Coorg',followUpDate:dateOnly(-1),totalAmount:150000,paymentStatus:'Unpaid',createdAt:inDays(-5),tasks:[]},
{_id:'l5',name:'Tara & Nikhil',email:'tara@example.com',status:'Converted',eventType:'Wedding',eventDate:dateOnly(7),eventLocation:'ITC Gardenia, Bengaluru',totalAmount:300000,depositAmount:100000,paymentStatus:'Deposit Paid',people:['Sara Joseph'],createdAt:inDays(-8),tasks:[]},
{_id:'l6',name:'Aditi & Rohan',email:'aditi@example.com',status:'Negotiation',eventType:'Wedding',eventDate:dateOnly(60),totalAmount:250000,paymentStatus:'Unpaid',createdAt:inDays(-9),tasks:[]},
{_id:'l7',name:'Meera & Vikram',email:'meera@example.com',status:'Converted',eventType:'Wedding',eventDate:dateOnly(-20),totalAmount:420000,paymentStatus:'Paid',people:['Arun Kumar'],createdAt:inDays(-40),tasks:[]}
];
let tasks=[{_id:'t1',title:'Send the wedding collection proposal',lead:'l1',status:'pending',dueDate:dateOnly(-1),createdAt:inDays(-3)},{_id:'t2',title:'Review the wedding film first cut',lead:'l7',status:'pending',dueDate:dateOnly(1),createdAt:inDays(-4)},{_id:'t3',title:'Confirm the crew and shoot schedule',lead:'l2',status:'pending',dueDate:dateOnly(2),createdAt:inDays(-2)},{_id:'t4',title:'Share album selections with the couple',lead:'l7',status:'pending',dueDate:dateOnly(4),createdAt:inDays(-2)},{_id:'t5',title:'Back up wedding footage',lead:'l7',status:'completed',dueDate:dateOnly(-14),createdAt:inDays(-15)}];
let crew=[{_id:'c1',name:'Arun Kumar',email:'arun@example.com',phone:'+919800000010',specialty:'LEAD PHOTOGRAPHER',status:'Active'},{_id:'c2',name:'Sara Joseph',email:'sara@example.com',phone:'+919800000011',specialty:'LEAD CINEMATOGRAPHER',status:'Active'},{_id:'c3',name:'Kiran Rao',email:'kiran@example.com',specialty:'EDITOR',status:'Active'},{_id:'c4',name:'Neha Sharma',email:'neha@example.com',specialty:'DRONE OPERATOR',status:'Active'}];
let events=[{_id:'e1',title:'Riya & Karthik',start:inDays(3),end:inDays(3,18),type:'Wedding',location:'The Leela, Bengaluru',teamMembers:['Arun Kumar','Sara Joseph'],lead:'l2'},{_id:'e2',title:'Maya & Aditya — consultation',start:inDays(1),end:inDays(1,11),type:'Meeting',location:'Team Alpha Studio',teamMembers:['Arun Kumar'],lead:'l1'},{_id:'e3',title:'Tara & Nikhil',start:inDays(7),end:inDays(7,19),type:'Wedding',location:'ITC Gardenia, Bengaluru',teamMembers:['Sara Joseph'],lead:'l5'}];
let gallery=[{_id:'g1',name:'Riya & Karthik',thumbnail:'/assets/services/wedding.jpg',clientId:{firstName:'Riya',lastName:'Karthik'},createdAt:inDays(-5)},{_id:'g2',name:'Meera & Vikram',thumbnail:'/assets/services/pre_wedding.jpg',clientId:{firstName:'Meera'},createdAt:inDays(-8)}];
let studioSettings={studioName:'Team Alpha',email:'hello@example.com',phone:'+919800000000',website:'https://example.com',address:'Bengaluru',invoicePrefix:'TA',quotationValidityDays:14,quotationTerms:'Coverage is confirmed after written acceptance and the agreed booking payment.',paymentInstructions:'Payment milestones are agreed with your studio.',defaultDeliverables:'Edited photographs, films and album selections as listed in your collection.',currency:'INR',timezone:'Asia/Kolkata'};
let quotations=[{_id:'q1',clientName:'Maya & Aditya',email:'maya@example.com',title:'Wedding photography & cinematography',validUntil:dateOnly(14),status:'Sent',revision:1,items:[{description:'Wedding photography coverage',quantity:1,unitPricePaise:14000000},{description:'Cinematic wedding film',quantity:1,unitPricePaise:10000000}],discountPaise:0,taxRateBps:0,subtotalPaise:24000000,taxPaise:0,totalPaise:24000000,terms:studioSettings.quotationTerms,history:[]},{_id:'q2',clientName:'Nisha & Varun',email:'nisha@example.com',title:'Engagement collection',validUntil:dateOnly(10),status:'Draft',revision:1,items:[{description:'Engagement photography',quantity:1,unitPricePaise:8000000}],discountPaise:0,taxRateBps:0,subtotalPaise:8000000,taxPaise:0,totalPaise:8000000,terms:'Collection details to be confirmed.',history:[]}];
let assetRecords=[{_id:'a1',label:'Meera & Vikram — wedding masters',lead:leads.find(l=>l._id==='l7'),mediaType:'Video',storageLocation:'NAS / Weddings / Meera-Vikram / Masters',sizeGb:420,backupLocation:'Offsite drive / Wedding archive',backupStatus:'Verified',verifiedAt:inDays(-3),notes:'Backup checked by the studio team.'},{_id:'a2',label:'Riya & Karthik — project files',lead:leads.find(l=>l._id==='l2'),mediaType:'Project files',storageLocation:'NAS / Active projects / Riya-Karthik',sizeGb:85,backupLocation:'',backupStatus:'Pending',notes:''}];
let studioClients=[{_id:'u1',firstName:'Riya',lastName:'Karthik',email:'riya@example.com',leadId:leads.find(l=>l._id==='l2'),cloudLink:'https://example.com/client-delivery',createdAt:inDays(-7)},{_id:'u2',firstName:'Meera',lastName:'Vikram',email:'meera@example.com',leadId:leads.find(l=>l._id==='l7'),cloudLink:'',createdAt:inDays(-30)}];
let ledgerEntries=[{_id:'f1',type:'expense',amount:15000,description:'Crew travel and accommodation',category:'Travel',status:'Paid',date:inDays(-3)},{_id:'f2',type:'expense',amount:28000,description:'Wedding editing work',category:'Post production',status:'Paid',date:inDays(-8)},{_id:'f3',type:'income',amount:120000,description:'Wedding booking receipt',category:'Booking',status:'Received',date:inDays(-4)}];
let studioInvoices=[{_id:'i1',clientName:'Riya & Karthik',invoiceDate:inDays(-4),total:360000,advancePaid:120000,status:'Pending'}];

const notifications=[{_id:'n1',title:'New enquiry received',description:'Maya & Aditya are planning their wedding celebration.',isRead:false,createdAt:inDays(-1)}];
const user={_id:'preview-admin',firstName:'Yogesh',lastName:'Preview',role:'admin',email:'preview@teamalpha.test',isPreview:true};
const fullTasks=()=>tasks.map(t=>({...t,lead:leads.find(l=>l._id===t.lead)||null}));
const fullLeads=()=>leads.map(l=>({...l,tasks:tasks.filter(t=>t.lead===l._id)}));
const express=require('../../backend/node_modules/express');
const publicApp=express();publicApp.use(express.json());
const QuoteModel=require('../../backend/models/Quotation');
const InvoiceModel=require('../../backend/models/Invoice');
const StudioModel=require('../../backend/models/StudioConfig');
const lifecycle=require('../../backend/utils/quoteLifecycle');
QuoteModel.findOne=async f=>quotations.find(q=>q.shareTokenHash===f.shareTokenHash&&['Sent','Accepted'].includes(q.status));
QuoteModel.findOneAndUpdate=async(f,u)=>{const q=quotations.find(q=>q._id===f._id);if(!q||q.status!==f.status||(f.revision&&q.revision!==f.revision)||(f.shareTokenHash&&q.shareTokenHash!==f.shareTokenHash))return null;Object.assign(q,u.$set);return {...q};};
InvoiceModel.findOneAndUpdate=async(f,u)=>{let i=studioInvoices.find(i=>String(i._id)===String(f._id));if(!i){i={_id:f._id,...u.$setOnInsert};studioInvoices.push(i);}return i;};
StudioModel.findOne=async()=>studioSettings;
publicApp.use('/api/quotes',require('../../backend/routes/publicQuoteRoutes'));
let quoteTemplates=[];
// Keep the disposable preview on the same enquiry store as the production routes.
const sampleId=value=>typeof value==='string'&&/^[lt][0-9]+$/.test(value)?(value[0]==='l'?'1':'2')+value.slice(1).padStart(23,'0'):value;
leads=leads.map(l=>({...l,_id:sampleId(l._id)}));
tasks=tasks.map(t=>({...t,_id:sampleId(t._id),lead:sampleId(t.lead)}));
events=events.map(e=>({...e,lead:sampleId(e.lead)}));
crew.forEach((person,index)=>{person._id='607f1f77bcf86cd7994390'+String(40+index);});
let referenceApp;require('./reference-memory.cjs')({settings:studioSettings,leads,tasks,crew,entries:ledgerEntries}).then(async app=>{
  referenceApp=app;leads=app.locals.stores.Lead;tasks=app.locals.stores.Task;ledgerEntries=app.locals.stores.Finance;
  const project=app.locals.stores.StudioProject[0],lead=leads.find(row=>String(row.studioProjectId)===String(project?._id));
  if(project&&lead){const event={_id:'307f1f77bcf86cd799439011',title:'Reference wedding — shoot briefing',start:inDays(0),end:inDays(0,18),type:'Wedding',location:'Team Alpha Studio, Bengaluru',studioProjectId:project._id,contactId:project.contactId,lead:lead._id,teamMembers:['Arun Kumar','Sara Joseph']};events.unshift(event);await app.locals.models.Event.create(event);}
}).catch(error=>console.error('Preview initialization failed:',error.message));

const server=http.createServer(async(req,res)=>{
if(/^\/api\/(contacts|studio-projects|contact-documents|invoices|public-invoices|quotes|leads|tasks|photographers|project-support)(\/|$)/.test(req.url.split('?')[0])||/^\/api\/studio\/(search|devices|quotations|quote-templates|settings|finance|ledger|booking-payments)(\/|$)/.test(req.url.split('?')[0])){if(!referenceApp){res.statusCode=503;res.end();return;}referenceApp(req,res);return;}

if(req.url.startsWith('/api/quotes/')){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS'){res.end();return;}publicApp(req,res);return;}

res.setHeader('Access-Control-Allow-Origin',frontendOrigin);res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,x-auth-token');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS');
if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
let text='';for await(const chunk of req)text+=chunk;
let body={};try{body=JSON.parse(text||'{}')}catch{}
const url=new URL(req.url,'http://127.0.0.1:5001');const path=url.pathname;
const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
if(path==='/api/studio/settings'){if(req.method==='PUT')studioSettings={...studioSettings,...body};send(studioSettings);return;}
if(path==='/api/studio/finance'){send({leads,invoices:studioInvoices,entries:ledgerEntries});return;}
if(path==='/api/studio/clients'){if(req.method==='POST'){const {password,...safe}=body;studioClients.unshift({...safe,_id:'u'+Date.now(),createdAt:new Date().toISOString(),leadId:leads.find(l=>l._id===body.leadId)||null});}send(req.method==='POST'?studioClients[0]:studioClients,req.method==='POST'?201:200);return;}
const clientId=path.match(/^\/api\/studio\/clients\/([^/]+)$/);if(clientId){const client=studioClients.find(c=>c._id===clientId[1]);Object.assign(client,body,{leadId:leads.find(l=>l._id===body.leadId)||null});send(client);return;}
if(path==='/api/studio/quote-templates'){if(req.method==='POST'){quoteTemplates.push({...body,_id:'template'+Date.now()});send(quoteTemplates.at(-1),201);return;}send(quoteTemplates);return;}
const templateId=path.match(/^\/api\/studio\/quote-templates\/([^/]+)$/);if(templateId){quoteTemplates=quoteTemplates.filter(t=>t._id!==templateId[1]);send({archived:true});return;}
const shareId=path.match(/^\/api\/studio\/quotations\/([^/]+)\/share$/);if(shareId){const q=quotations.find(q=>q._id===shareId[1]);q.shareToken=q.shareToken||require('crypto').randomBytes(32).toString('hex');q.shareTokenHash=lifecycle.tokenHash(q.shareToken);q.status='Sent';q.sharedAt=q.sharedAt||new Date().toISOString();send({token:q.shareToken,quote:q});return;}
if(path==='/api/studio/quotations'){if(req.method==='POST'){const subtotal=body.items.reduce((s,i)=>s+i.quantity*i.unitPricePaise,0);const tax=Math.round((subtotal-body.discountPaise)*body.taxRateBps/10000);quotations.unshift({...body,_id:'q'+Date.now(),subtotalPaise:subtotal,taxPaise:tax,totalPaise:subtotal-body.discountPaise+tax,revision:1,history:[]});send(quotations[0],201);return;}send(quotations);return;}
const quoteId=path.match(/^\/api\/studio\/quotations\/([^/]+)$/);if(quoteId){const quote=quotations.find(q=>q._id===quoteId[1]);Object.assign(quote,body,{revision:quote.revision+1});quote.subtotalPaise=quote.items.reduce((s,i)=>s+i.quantity*i.unitPricePaise,0);quote.taxPaise=Math.round((quote.subtotalPaise-quote.discountPaise)*quote.taxRateBps/10000);quote.totalPaise=quote.subtotalPaise-quote.discountPaise+quote.taxPaise;send(quote);return;}
if(path==='/api/studio/assets'){if(req.method==='POST'){assetRecords.unshift({...body,_id:'a'+Date.now(),lead:leads.find(l=>l._id===body.lead)||null,verifiedAt:body.backupStatus==='Verified'?new Date().toISOString():null});send(assetRecords[0],201);return;}send(assetRecords.filter(a=>!a.archived));return;}
const assetId=path.match(/^\/api\/studio\/assets\/([^/]+)$/);if(assetId){const record=assetRecords.find(a=>a._id===assetId[1]);if(req.method==='DELETE'){record.archived=true;send({archived:true});return;}Object.assign(record,body,{lead:leads.find(l=>l._id===body.lead)||null,verifiedAt:body.backupStatus==='Verified'?new Date().toISOString():null});send(record);return;}
if(path==='/api/studio/ledger'){ledgerEntries.unshift({...body,_id:'f'+Date.now(),description:body.title,amount:Number(body.amount)});send(ledgerEntries[0],201);return;}
const ledgerId=path.match(/^\/api\/studio\/ledger\/([^/]+)$/);if(ledgerId){const row=ledgerEntries.find(f=>f._id===ledgerId[1]);Object.assign(row,body,{description:body.title,amount:Number(body.amount)});send(row);return;}
if(path==='/api/calendar'&&req.method==='POST'){events.push({...body,_id:'e'+Date.now()});send(events.at(-1),201);return;}
const eventId=path.match(/^\/api\/calendar\/([^/]+)$/);if(eventId&&['PATCH','DELETE'].includes(req.method)){const row=events.find(e=>e._id===eventId[1]);if(req.method==='DELETE'){events=events.filter(e=>e._id!==eventId[1]);send({success:true});return;}Object.assign(row,body);send(row);return;}

if(path==='/api/auth/login'){if(body.email!=='preview@teamalpha.test'||body.password!=='preview-only'){send({msg:'This local design preview accepts the sample account only.'},401);return;}send({user,token:'local-sample-data-only'});return;}
if(path==='/api/auth/profile'){send({...user,firstName:body.name?.split(' ')[0]||user.firstName});return;}
if(path==='/api/auth/me'){send(user);return;}
if(path==='/api/admin-users' && req.method==='GET'){send([user]);return;}
if(path==='/api/dashboard/studio-overview'){
  const now=new Date();
  let timezone;
  try { timezone=url.searchParams.has('timezone')?overviewTimezone(url.searchParams.get('timezone'),true):overviewTimezone(studioSettings.timezone); }
  catch(error) { send({error:error.message},400);return; }
  const window=overviewInsightWindow(now,timezone), throughNow=new Date(now.getTime()+1);
  const statuses=['New','Follow-up','Meeting','Negotiation','Converted','Archived'];
  const leadCounts=statuses.map(status=>({_id:status,count:leads.filter(lead=>lead.status===status).length}));
  const future=events.filter(event=>new Date(event.end)>=now).sort((a,b)=>new Date(a.start)-new Date(b.start));
  const pending=fullTasks().filter(task=>task.status==='pending');
  const pendingTaskCount=pending.length, completedTaskCount=tasks.filter(task=>task.status==='completed').length;
  const insightData={leadCounts,pendingTaskCount,completedTaskCount,
    leadActivity:groupOverviewRecords(leads,'createdAt',window,false,throughNow),
    eventActivity:groupOverviewRecords(events,'start',window),
    taskActivity:groupOverviewRecords(tasks,'createdAt',window,false,throughNow),
    taskDueActivity:groupOverviewRecords(tasks,'dueDate',window,true)};
  send(buildStudioOverview({leadCounts,upcomingEventCount:future.length,pendingTaskCount,
    overdueTaskCount:pending.filter(task=>task.dueDate&&new Date(task.dueDate)<studioDayStart(now,timezone)).length,
    activeCrew:crew.filter(person=>person.status==='Active').length,clientCollections:gallery.length,
    events:future.slice(0,6),datedTasks:pending.filter(task=>task.dueDate).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)),
    undatedTasks:pending.filter(task=>!task.dueDate).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)),
    recentLeads:[...leads].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6),
    insights:buildOverviewInsights(insightData,now,timezone)},now));return;
}
if(path==='/api/leads'&&req.method==='GET'){send(fullLeads());return;}
if(path==='/api/leads'&&req.method==='POST'){const lead={...body,_id:'l'+Date.now(),createdAt:new Date().toISOString(),status:body.status||'New',tasks:[]};leads.unshift(lead);send(lead,201);return;}
const leadId=path.match(/^\/api\/leads\/([^/]+)$/);if(leadId){const lead=leads.find(l=>l._id===leadId[1]);if(req.method==='PATCH'){Object.assign(lead,body);send(lead);return;}}
const leadTask=path.match(/^\/api\/leads\/([^/]+)\/tasks$/);if(leadTask&&req.method==='POST'){const task={...body,lead:leadTask[1],_id:'t'+Date.now(),status:'pending',createdAt:new Date().toISOString()};tasks.unshift(task);send(task,201);return;}
if(path==='/api/tasks'&&req.method==='GET'){send(fullTasks());return;}
if(path==='/api/tasks'&&req.method==='POST'){const task={...body,_id:'t'+Date.now(),status:'pending',createdAt:new Date().toISOString()};tasks.unshift(task);send(task,201);return;}
const taskId=path.match(/^\/api\/tasks\/([^/]+)$/);if(taskId){const task=tasks.find(t=>t._id===taskId[1]);if(req.method==='PATCH'){Object.assign(task,body);send(task);return;}}
if(path==='/api/photographers'&&req.method==='GET'){send(crew);return;}
if(path==='/api/photographers'&&req.method==='POST'){const member={...body,_id:'c'+Date.now()};crew.push(member);send(member,201);return;}
if(path==='/api/calendar'){send(events);return;}
if(path==='/api/notifications'){send(notifications);return;}
if(path==='/api/notifications/mark-all-read'){notifications.forEach(n=>n.isRead=true);send({success:true});return;}
if(path==='/api/drive-gallery'){send(gallery);return;}
if(path==='/api/webhooks/enquiries/status'){send({configured:false,method:'POST',path:'/api/webhooks/enquiries',authentication:'Bearer',idempotencyHeader:'Idempotency-Key'});return;}
if(path==='/api/chat/admin/unread-count'){send({count:0});return;}
if(path.endsWith('/sync-status')){send({isSynced:false});return;}
if(req.method==='GET'){send([]);return;}
send({error:'Design preview does not implement this action'},501);
});
new Server(server,{cors:{origin:frontendOrigin}}).on('connection',socket=>socket.on('join_chat',room=>socket.join(room)));
server.listen(5001,'127.0.0.1',()=>console.log('Isolated sample API: http://127.0.0.1:5001'));
