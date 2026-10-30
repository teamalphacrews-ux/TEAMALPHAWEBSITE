import {eventOnStudioDay} from './studioTime.js';
export const recordId = value => String(value?._id || value || '');
export function projectLeadRecord(project, leads) {
  if (!project) return null;
  const projectId=recordId(project), explicit=recordId(project.leadId), contact=recordId(project.contactId);
  const linked=leads.filter(lead => (!recordId(lead.studioProjectId) || recordId(lead.studioProjectId)===projectId) && (!recordId(lead.contactId) || recordId(lead.contactId)===contact) && (recordId(lead.studioProjectId)===projectId || (explicit && recordId(lead)===explicit)));
  return linked.length===1 && (!explicit || recordId(linked[0])===explicit) ? linked[0] : null;
}
export function eventProjectContext(event, projects, leads) {
  const eventProjectId=recordId(event.studioProjectId), eventLeadId=recordId(event.lead);
  let project=eventProjectId ? projects.find(row=>recordId(row)===eventProjectId) : null;
  const eventLead=eventLeadId ? leads.find(row=>recordId(row)===eventLeadId) : null;
  if (!project && !eventProjectId && eventLead) {
    const matches=projects.filter(row=>recordId(row)===recordId(eventLead.studioProjectId) || recordId(row.leadId)===eventLeadId);
    if(matches.length===1) project=matches[0];
  }
  const linked=project ? projectLeadRecord(project,leads) : eventLead;
  const conflict=Boolean((eventProjectId && !project) || (project && eventLeadId && (!linked || recordId(linked)!==eventLeadId)) || (eventProjectId && eventLead?.studioProjectId && recordId(eventLead.studioProjectId)!==eventProjectId));
  return {project:project||null,lead:conflict?null:linked||null,conflict};
}
export function crewContact(name, roster) {
  const matches=roster.filter(person=>person.name===name);
  return matches.length===1 ? matches[0] : null;
}
export const phoneHref = value => {const number=String(value||'').replace(/[^+\d]/g,'');return /^\+?\d{6,16}$/.test(number)?'tel:'+number:null;};
export const emailHref = value => typeof value==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'mailto:'+encodeURIComponent(value) : null;
export const directionsHref = value => typeof value==='string' && value.trim() ? 'https://maps.apple.com/?q='+encodeURIComponent(value.trim().slice(0,500)) : null;
export function deliveryHref(value) {try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
export function validDay(value) {return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function shootEvents(events, day, timezone) {return events.filter(event=>eventOnStudioDay(event,day,timezone)).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));}
