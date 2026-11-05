// New enquiry links commit atomically. Contact/project snapshots never replace
// the source enquiry's identity, schedule, notes, crew or recorded payments.
const {authoritativeQuote,stageFor}=require('./enquiryPipeline');
const same=(a,b)=>String(a?._id||a||'')===String(b?._id||b||'');
const failure=(message,status=409)=>Object.assign(new Error(message),{status});
const normalized=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
const phoneKey=value=>String(value||'').replace(/[^\d]/g,'');
const escaped=value=>value.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
const stableId=(kind,id)=>require('node:crypto').createHash('sha256').update('studio-enquiry-'+kind+':'+String(id)).digest('hex').slice(0,24);
const inSession=(query,session)=>session?query.session(session):query;
const matchesIdentity=(contact,lead)=>contact&&!contact.archived&&normalized(contact.email)===normalized(lead.email)
  &&normalized([contact.firstName,contact.lastName].filter(Boolean).join(' '))===normalized(lead.name)
  &&phoneKey(contact.phone)===phoneKey(lead.phone);
async function withProjectTransaction(Project,work){
  const session=await Project.startSession();
  try{
    let result;
    // MongoDB retries write conflicts from a simultaneous source edit using a
    // fresh snapshot. A standalone database never falls back to partial writes.
    await session.withTransaction(async()=>{result=await work(session);},{
      readConcern:{level:'snapshot'},writeConcern:{w:'majority'},
    });
    return result;
  }catch(error){
    if(error.code===20||/Transaction numbers are only allowed|does not support (?:retryable writes|transactions)/i.test(error.message||''))
      throw failure('Preparing an enquiry project requires a transactional MongoDB connection. Ask your studio administrator to review the database setup.',503);
    throw error;
  }finally{await session.endSession();}
}
function createEnquiryProject({Lead,Project,Contact,Quotation,Event,transaction=work=>withProjectTransaction(Project,work)}){
  async function linkedProject(lead,session){
    const project=await inSession(Project.findById(lead.studioProjectId),session);
    if(!project)throw failure('The linked project could not be found. Review the enquiry connection.');
    if(project.status==='Archived')throw failure('Restore the linked project before continuing.');
    if(lead.contactId&&!same(lead.contactId,project.contactId))throw failure('The enquiry and project refer to different contacts. Review their connection.');
    const owner=await inSession(Lead.findOne({studioProjectId:project._id}),session);
    if((project.leadId&&!same(project.leadId,lead._id))||(owner&&!same(owner._id,lead._id)))
      throw failure('This project is linked to a different enquiry.');
    // Opening an existing connection, including a retry, is read-only.
    return{project,lead};
  }
  return async function projectForEnquiry(leadId){
    const initial=await Lead.findById(leadId);
    if(!initial)throw failure('This enquiry could not be found.',404);
    if(initial.status==='Archived')throw failure('Restore this enquiry before creating a project.');
    if(initial.studioProjectId)return linkedProject(initial);
    return transaction(async session=>{
      // Re-read within every attempt, rather than reuse an external snapshot.
      const lead=await inSession(Lead.findById(leadId),session);
      if(!lead)throw failure('This enquiry could not be found.',404);
      if(lead.status==='Archived')throw failure('Restore this enquiry before creating a project.');
      if(lead.studioProjectId)return linkedProject(lead,session);
      const interrupted=await inSession(Project.findOne({leadId:lead._id}),session);
      if(interrupted?.status==='Archived')throw failure('Restore the linked project before continuing.');
      if(interrupted&&lead.contactId&&!same(interrupted.contactId,lead.contactId))
        throw failure('The enquiry and project refer to different contacts. Review their connection.');
      if(interrupted){
        const conflicts=[['type','eventType'],['location','eventLocation'],['description','remarks']]
          .some(([projectKey,leadKey])=>normalized(interrupted[projectKey])&&normalized(interrupted[projectKey])!==normalized(lead[leadKey]));
        const oldDay=interrupted.startDate?new Date(interrupted.startDate).toISOString().slice(0,10):'';
        const sourceDay=lead.eventDate?new Date(lead.eventDate).toISOString().slice(0,10):'';
        if(conflicts||(oldDay&&oldDay!==sourceDay))throw failure('The incomplete project has different event details. Review it before linking this enquiry.');
      }
      const email=normalized(lead.email);
      if(!email||!lead.name?.trim())throw failure('Add the client name and email to this enquiry first.',400);
      const quotes=await inSession(Quotation.find({lead:lead._id}),session);
      if(quotes.some(q=>q.studioProjectId&&(!interrupted||!same(q.studioProjectId,interrupted._id))))
        throw failure('A quotation already refers to another project. Review its enquiry connection.');
      const explicitContact=lead.contactId||interrupted?.contactId;
      let contact=explicitContact?await inSession(Contact.findById(explicitContact),session):null;
      if(explicitContact&&!matchesIdentity(contact,lead))throw failure('Review the enquiry’s linked contact before creating a project.');
      if(!contact){
        const candidates=(await inSession(Contact.find({email:new RegExp('^'+escaped(email)+'$','i'),archived:{$ne:true}}),session))
          .filter(item=>matchesIdentity(item,lead));
        if(candidates.length>1)throw failure('Several matching contacts exist. Review duplicate contacts before creating this project.');
        contact=candidates[0];
      }
      if(quotes.some(q=>q.contactId&&(!contact||!same(q.contactId,contact._id))))
        throw failure('A quotation has a different linked contact. Review it before creating this project.');
      if(!contact){
        const[firstName,...last]=lead.name.trim().split(/\s+/);
        contact=await inSession(Contact.findOneAndUpdate({_id:stableId('contact',lead._id)},{$setOnInsert:{
          firstName,lastName:last.join(' '),email,phone:lead.phone||'',contactType:'Lead',
        }},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true}),session);
        if(!matchesIdentity(contact,lead))throw failure('The client connection changed. Refresh the enquiry and try again.');
      }
      const quote=authoritativeQuote(quotes);
      const nextStage=stageFor({status:interrupted?.status||(lead.status==='Converted'?'Booked':'Inquiry')},quote,lead.status);
      const projectValues={
        leadId:lead._id,contactId:contact._id,name:lead.projectName||interrupted?.name||(lead.name.trim()+' · '+(lead.eventType||'Project')),
        type:lead.eventType||'Wedding',status:interrupted?.status==='Completed'?'Completed':nextStage==='Converted'?'Booked':'Inquiry',
        startDate:lead.eventDate||null,location:lead.eventLocation||'',description:lead.remarks||'',
      };
      const project=await inSession(Project.findOneAndUpdate({_id:interrupted?._id||stableId('project',lead._id),leadId:lead._id},{$set:projectValues},{
        upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true,
      }),session);
      if(!project||!same(project.leadId,lead._id)||!same(project.contactId,contact._id))
        throw failure('The project connection changed. Refresh and try again.');
      const links={studioProjectId:project._id,contactId:contact._id,projectName:project.name,status:nextStage};
      if(quote&&(lead.status!=='Converted'||quote.status==='Accepted'))Object.assign(links,{
        quotationId:quote._id,quotationStatus:quote.status,quotationNumber:quote.documentNumber||'',totalAmount:quote.totalPaise/100,
      });
      const updatedLead=await inSession(Lead.findOneAndUpdate({_id:lead._id,studioProjectId:null,
        ...(lead.updatedAt?{updatedAt:lead.updatedAt}:{}),
      },{$set:links},{new:true,runValidators:true}),session);
      if(!updatedLead)throw failure('The enquiry changed while preparing the project. Refresh and retry.');
      await inSession(Quotation.updateMany({lead:lead._id,studioProjectId:null,$or:[{contactId:null},{contactId:contact._id}]},{
        $set:{studioProjectId:project._id,contactId:contact._id},
      }),session);
      if(Event)await inSession(Event.updateMany({lead:lead._id,studioProjectId:null,$or:[{contactId:null},{contactId:contact._id}]},{
        $set:{studioProjectId:project._id,contactId:contact._id},
      }),session);
      return{project,lead:updatedLead};
    }).catch(async error=>{
      // Concurrent upserts can surface a duplicate-key error instead of a
      // transient transaction label. Read the committed winner; do not replay
      // any writes outside a transaction or create another project.
      if(error.code!==11000)throw error;
      const latest=await Lead.findById(leadId);
      if(latest?.studioProjectId&&latest.status!=='Archived')return linkedProject(latest);
      throw failure('This enquiry project is being prepared. Refresh and retry safely.');
    });
  };
}
module.exports={createEnquiryProject,withProjectTransaction,projectForEnquiry:createEnquiryProject({
  Lead:require('../models/Lead'),Project:require('../models/StudioProject'),Contact:require('../models/StudioContact'),
  Quotation:require('../models/Quotation'),Event:require('../models/Event'),
})};
