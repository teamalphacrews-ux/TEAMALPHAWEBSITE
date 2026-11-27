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
function savedTemplate(config, templateId) {
  const id = templateId || config?.productionDefaults?.defaultTemplateId;
  if (!id) return undefined;
  const template = config?.productionDefaults?.templates?.find(item => item.id === id);
  if (!template) throw fail('Production template not found.', 404);
  return template;
}

async function writeTemplateTasks(leadId, template, session, options = {}) {
  const Task = options.Task || require('../models/Task'), Lead = options.Lead || require('../models/Lead');
  // Serialize template writers on their shared enquiry before upserting stages.
  const lead = await Lead.findOneAndUpdate({ _id: leadId }, { $currentDate: { updatedAt: true } }, { new: true, session, timestamps: false });
  if (!lead) throw fail('Project enquiry not found.', 404);
  const ids = [];
  for (const values of buildTemplateTasks(template, lead, options.now)) {
    const task = await Task.findOneAndUpdate(
      { lead: lead._id, templateKey: values.templateKey },
      { $setOnInsert: values }, { new: true, upsert: true, runValidators: true, session },
    );
    ids.push(task._id);
  }
  await Lead.updateOne({ _id: lead._id }, { $addToSet: { tasks: { $each: ids } } }, { session });
  return { applied: true, count: ids.length, template: template.name };
}

async function applyProductionTemplate(leadId, templateId, options = {}) {
  const Task = options.Task || require('../models/Task'), Lead = options.Lead || require('../models/Lead'), Config = options.Config || require('../models/StudioConfig');
  const config = await Config.findOne({ key: 'studio' }, null, { session: options.session });
  const template = savedTemplate(config, templateId);
  if (!template) {
    if (!await Lead.exists({ _id: leadId }).session(options.session || null)) throw fail('Project enquiry not found.', 404);
    return { applied: false, count: 0 };
  }
  const apply = session => writeTemplateTasks(leadId, template, session, options);
  return options.session ? apply(options.session) : Task.db.transaction(apply);
}

async function finishAcceptedProduction(quoteId, leadId) {
  const Quote = require('../models/Quotation');
  await Quote.db.transaction(async session => {
    const quote = await Quote.findOneAndUpdate(
      { _id: quoteId, status: 'Accepted', pendingProductionTemplate: { $exists: true } },
      { $unset: { pendingProductionTemplate: 1 } }, { new: false, session },
    );
    // The snapshot is consumed in the same commit as the production tasks.
    if (quote) await writeTemplateTasks(leadId, quote.pendingProductionTemplate, session, { now: quote.acceptedAt });
  });
}

const applyDefaultProduction = (leadId, session) => applyProductionTemplate(leadId, undefined, { session });
module.exports = { buildTemplateTasks, savedTemplate, applyProductionTemplate, applyDefaultProduction, finishAcceptedProduction };
