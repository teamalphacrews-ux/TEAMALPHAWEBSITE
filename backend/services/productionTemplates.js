const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function buildTemplateTasks(template, lead, now = new Date()) {
  if (!template?.id || !Array.isArray(template.stages) || !template.stages.length) throw fail('Choose a saved production template.');
  const date = lead.eventDate ? new Date(lead.eventDate) : new Date(now);
  if (!Number.isFinite(date.getTime())) throw fail('The project event date is invalid.');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = key => parts.find(value => value.type === key).value;
  const base = Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  return template.stages.map((stage, index) => ({
    title: stage.title, status: 'pending', lead: lead._id,
    dueDate: new Date(new Date(base + stage.dueDays * 86400000).toISOString().slice(0, 10) + 'T18:29:59.999Z'),
    clientVisible: stage.clientVisible === true, clientTitle: stage.clientVisible ? stage.title : '',
    deliveryType: stage.category, productionStage: 'Not started',
    templateKey: `${template.id}:${index}`,
  }));
}
async function applyProductionTemplate(leadId, templateId, options = {}) {
  const Task = options.Task || require('../models/Task'), Lead = options.Lead || require('../models/Lead'), Config = options.Config || require('../models/StudioConfig');
  const [lead, config] = await Promise.all([Lead.findById(leadId), Config.findOne({ key: 'studio' })]);
  if (!lead) throw fail('Project enquiry not found.', 404);
  const id = templateId || config?.productionDefaults?.defaultTemplateId;
  if (!id) return { applied: false, count: 0 };
  const template = config?.productionDefaults?.templates?.find(item => item.id === id);
  if (!template) throw fail('Production template not found.', 404);
  const rows = buildTemplateTasks(template, lead, options.now);
  const tasks = [];
  for (const values of rows) {
    let task;
    try { task = await Task.findOneAndUpdate({ lead: lead._id, templateKey: values.templateKey }, { $setOnInsert: values }, { new: true, upsert: true, runValidators: true }); }
    catch (error) { if (error.code !== 11000) throw error; task = await Task.findOne({ lead: lead._id, templateKey: values.templateKey }); if (!task) throw error; }
    tasks.push(task);
  }
  await Lead.updateOne({ _id: lead._id }, { $addToSet: { tasks: { $each: tasks.map(task => task._id) } } });
  return { applied: true, count: tasks.length, template: template.name };
}
const applyDefaultProduction = leadId => applyProductionTemplate(leadId);
module.exports = { buildTemplateTasks, applyProductionTemplate, applyDefaultProduction };
