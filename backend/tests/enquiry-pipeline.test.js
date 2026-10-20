const test = require('node:test');
const assert = require('node:assert/strict');
const { createPipeline, authoritativeQuote, stageFor } = require('../services/enquiryPipeline');
const clone = value => structuredClone(value);
const same = (a,b) => String(a?._id || a || '') === String(b?._id || b || '');
function matches(row, filter = {}) {
  return Object.entries(filter).every(([key,value]) => {
    if (key === '$or') return value.some(part => matches(row, part));
    const current = row[key];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('$ne' in value) return !same(current,value.$ne);
      if ('$in' in value) return value.$in.some(v => same(current,v));
    }
    return value === null ? current == null : same(current,value);
  });
}
function memory(rows = [], defaults = {}) {
  const records = new Map(rows.map(row => [String(row._id), clone(row)]));
  let serial = 0;
  const all = filter => [...records.values()].filter(row => matches(row,filter));
  const update = (row, patch) => { Object.assign(row, clone(patch.$set || {})); return clone(row); };
  return {
    records,
    find(filter = {}) { const promise = Promise.resolve(all(filter).map(clone)); promise.sort = () => promise; return promise; },
    async findById(id) { return clone(records.get(String(id)) || null); },
    async findOne(filter) { return clone(all(filter)[0] || null); },
    async findOneAndUpdate(filter, patch, options = {}) {
      let row = all(filter)[0];
      if (!row && options.upsert) {
        row = { _id:'generated-' + (++serial), ...clone(defaults), ...clone(patch.$setOnInsert || {}) };
        records.set(String(row._id),row);
      }
      return row ? update(row,patch) : null;
    },
    async updateOne(filter, patch) { const row=all(filter)[0]; if(row) update(row,patch); return {matchedCount:row?1:0}; },
    async updateMany(filter, patch) { const rows=all(filter); rows.forEach(row=>update(row,patch)); return {matchedCount:rows.length}; },
  };
}
function setup({projects, leads = [], quotes = [], events = []} = {}) {
  const models = {
    Contact:memory([{_id:'c1',firstName:'Maya',lastName:'Rao',email:'maya@example.test',phone:'9000000000'}]),
    Project:memory(projects || [{_id:'p1',contactId:'c1',name:'Maya wedding',type:'Wedding',status:'Inquiry',startDate:new Date('2028-01-20'),location:'Bengaluru'}]),
    Lead:memory(leads,{status:'New',paymentStatus:'Unpaid',depositAmount:0,totalAmount:0,tasks:[],people:[]}),
    Quotation:memory(quotes), Event:memory(events),
  };
  return {...models, pipeline:createPipeline(models)};
}
const quote = (id,status,extra={}) => ({_id:id,studioProjectId:'p1',status,totalPaise:17000000,documentNumber:'Q-101',updatedAt:new Date('2028-01-01'),...extra});

test('concurrent project repair creates one enquiry and links documents and sessions',async()=>{
  const s=setup({quotes:[quote('q1','Draft')],events:[{_id:'e1',studioProjectId:'p1'}]});
  const results=await Promise.all(Array.from({length:6},()=>s.pipeline.ensureProject('p1')));
  assert.equal(s.Lead.records.size,1);
  assert.equal(new Set(results.map(v=>String(v._id))).size,1);
  const lead=results[0];
  assert.equal(lead.projectName,'Maya wedding'); assert.equal(lead.status,'New');
  assert.equal(lead.totalAmount,170000); assert.equal(lead.quotationStatus,'Draft');
  assert.equal((await s.Project.findById('p1')).leadId,lead._id);
  assert.equal((await s.Quotation.findById('q1')).lead,lead._id);
  assert.equal((await s.Event.findById('e1')).lead,lead._id);
});
test('one contact can have several projects without merging enquiries',async()=>{
  const s=setup({projects:[{_id:'p1',contactId:'c1',name:'Wedding',status:'Inquiry'},{_id:'p2',contactId:'c1',name:'Portraits',status:'Inquiry'}]});
  const [first,second]=await Promise.all(['p1','p2'].map(id=>s.pipeline.ensureProject(id)));
  assert.notEqual(first._id,second._id); assert.equal(s.Lead.records.size,2); assert.equal(first.email,second.email);
});
test('sharing and acceptance advance enquiry without inventing payments or losing operations',async()=>{
  const existing={_id:'l1',studioProjectId:'p1',name:'Maya Rao',email:'maya@example.test',status:'Follow-up',paymentStatus:'Deposit Paid',depositAmount:5000,tasks:['task-1'],people:['editor'],cloudLink:'https://example.test/gallery',followUpDate:new Date('2028-01-03')};
  const s=setup({leads:[existing],quotes:[quote('q1','Sent')]});
  await s.pipeline.syncQuote(await s.Quotation.findById('q1'));
  assert.equal((await s.Lead.findById('l1')).status,'Negotiation');
  await s.Quotation.updateOne({_id:'q1'},{$set:{status:'Accepted'}});
  await s.pipeline.syncQuote(await s.Quotation.findById('q1'));
  const lead=await s.Lead.findById('l1');
  assert.equal(lead.status,'Converted'); assert.equal(lead.quotationStatus,'Accepted');
  assert.equal((await s.Project.findById('p1')).status,'Booked');
  for(const field of ['paymentStatus','depositAmount','tasks','people','cloudLink','followUpDate']) assert.deepEqual(lead[field],existing[field],field);
});
test('backfill gives accepted quote priority over a newer sent quote',async()=>{
  const accepted=quote('accepted','Accepted',{totalPaise:9000000,documentNumber:'Q-90'});
  const later=quote('sent','Sent',{totalPaise:20000000,updatedAt:new Date('2028-02-01')});
  const s=setup({quotes:[later,accepted]}); await s.pipeline.reconcile();
  const lead=[...s.Lead.records.values()][0];
  assert.equal(lead.status,'Converted'); assert.equal(lead.totalAmount,90000); assert.equal(lead.quotationId,'accepted');
  assert.equal(authoritativeQuote([later,accepted])._id,'accepted');
});
test('legacy explicit enquiry is adopted and conflicting clients are rejected',async()=>{
  const s=setup({leads:[{_id:'legacy',email:'MAYA@example.test',name:'Old',status:'Meeting',paymentStatus:'Paid',tasks:['t1']}],quotes:[quote('q1','Draft',{lead:'legacy'})]});
  const lead=await s.pipeline.ensureProject('p1');
  assert.equal(lead._id,'legacy'); assert.equal(s.Lead.records.size,1); assert.deepEqual(lead.tasks,['t1']); assert.equal(lead.paymentStatus,'Paid');
  const bad=setup({leads:[{_id:'other',email:'other@example.test',status:'New'}],quotes:[quote('q1','Draft',{lead:'other'})]});
  await assert.rejects(()=>bad.pipeline.ensureProject('p1'),{status:409});
  assert.equal((await bad.pipeline.reconcile()).length,1);
});
test('contact changes refresh enquiries without rewriting accepted client identity',async()=>{
  const s=setup({quotes:[quote('q1','Accepted',{clientName:'Maya Rao',email:'maya@example.test'})]}); await s.pipeline.ensureProject('p1');
  await s.Contact.updateOne({_id:'c1'},{$set:{lastName:'Shah',email:'new@example.test'}});
  await s.Project.updateOne({_id:'p1'},{$set:{name:'Maya and Arun',startDate:null,location:''}});
  await s.pipeline.syncContact('c1'); const lead=[...s.Lead.records.values()][0];
  assert.equal(lead.name,'Maya Shah'); assert.equal(lead.email,'new@example.test'); assert.equal(lead.eventDate,null);
  assert.equal((await s.Quotation.findById('q1')).email,'maya@example.test');
});
test('archived projects remain archived even with accepted quotes',async()=>{
  const s=setup({projects:[{_id:'p1',contactId:'c1',name:'Archived',status:'Archived'}],quotes:[quote('q1','Accepted')]});
  assert.equal((await s.pipeline.ensureProject('p1')).status,'Archived'); await s.pipeline.reconcile(); assert.equal(s.Lead.records.size,1);
  assert.equal(stageFor({status:'Archived'},quote('q','Accepted'),'Negotiation'),'Archived');
});
test('share racing acceptance cannot downgrade booking',async()=>{
  const s=setup({leads:[{_id:'l1',studioProjectId:'p1',email:'maya@example.test',status:'New',paymentStatus:'Unpaid',depositAmount:0}],quotes:[quote('q1','Sent')]});
  const atomic=s.Lead.findOneAndUpdate.bind(s.Lead); let intercepted=false;
  s.Lead.findOneAndUpdate=async(filter,patch,options)=>{
    if(!intercepted && filter.status==='New') {
      intercepted=true; await s.Quotation.updateOne({_id:'q1'},{$set:{status:'Accepted'}});
      await s.Lead.updateOne({_id:'l1'},{$set:{status:'Converted',quotationId:'q1',quotationStatus:'Accepted'}});
    }
    return atomic(filter,patch,options);
  };
  await s.pipeline.ensureProject('p1'); const lead=await s.Lead.findById('l1');
  assert.equal(lead.status,'Converted'); assert.equal(lead.quotationStatus,'Accepted'); assert.equal(lead.depositAmount,0);
});
test('standalone acceptance retries concurrent enquiry status changes',async()=>{
  const s=setup({projects:[],leads:[{_id:'standalone',email:'maya@example.test',status:'New',paymentStatus:'Unpaid'}]});
  const atomic=s.Lead.findOneAndUpdate.bind(s.Lead); let intercepted=false;
  s.Lead.findOneAndUpdate=async(filter,patch,options)=>{
    if(!intercepted && filter.status==='New') {intercepted=true; await s.Lead.updateOne({_id:'standalone'},{$set:{status:'Follow-up'}});}
    return atomic(filter,patch,options);
  };
  await s.pipeline.syncQuote(quote('q1','Accepted',{studioProjectId:null,lead:'standalone'}));
  assert.equal((await s.Lead.findById('standalone')).status,'Converted');
});
test('completed projects stay completed when enquiry details are edited',async()=>{
  const lead={_id:'l1',studioProjectId:'p1',name:'Maya Rao',email:'maya@example.test',status:'Converted',eventLocation:'New venue'};
  const s=setup({projects:[{_id:'p1',contactId:'c1',name:'Finished wedding',status:'Completed'}],leads:[lead]});
  await s.pipeline.syncFromEnquiry(lead,{status:'Converted',eventLocation:'New venue'});
  assert.equal((await s.Project.findById('p1')).status,'Completed');
});
test('CRM linking fields have server-owned uniqueness indexes',()=>{
  const indexes=require('../models/Lead').schema.indexes();
  for(const field of ['studioProjectId']) {
    const index=indexes.find(([keys])=>keys[field]===1);
    assert.equal(index[1].unique,true); assert.deepEqual(index[1].partialFilterExpression[field],{$type:'objectId'});
  }
});
