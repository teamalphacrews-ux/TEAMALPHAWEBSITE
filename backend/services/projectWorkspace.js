const Lead = require('../models/Lead');
const Task = require('../models/Task');
const Photographer = require('../models/Photographer');
const { identifier, projectLead, projectCrew } = require('../utils/projectWorkspace');
async function productionFor(project) {
  const clauses = [{studioProjectId:project._id}];
  if (project.leadId) clauses.push({_id:project.leadId});
  const candidates = await Lead.find({$or:clauses}).select('name contactId studioProjectId people eventDate eventLocation eventType paymentStatus totalAmount depositAmount quotationId').lean();
  const lead = projectLead(project, candidates);
  if (!lead) return {lead:null,tasks:[],crew:[],roster:[],warning:candidates.length ? 'The project and enquiry links need review before crew and delivery can be shown.' : 'This project has no linked enquiry yet. Review its enquiry connection in the studio.'};
  const [tasks, roster] = await Promise.all([
    Task.find({lead:lead._id}).populate('assignee','name specialty email phone').sort({dueDate:1,createdAt:1}).lean(),
    Photographer.find().select('name specialty email phone status').sort({name:1}).lean(),
  ]);
  return {lead:{...lead,_id:identifier(lead._id)},tasks,crew:projectCrew(lead.people,roster),roster,warning:''};
}
module.exports = {productionFor};
