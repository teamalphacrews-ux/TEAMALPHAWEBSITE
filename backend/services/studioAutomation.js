const crypto = require('node:crypto');
const { DEFAULTS } = require('../utils/studioSettings');
function indiaClock(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const part = key => parts.find(row => row.type === key).value;
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  const start = new Date(day + 'T00:00:00+05:30');
  return { day, hour: Number(part('hour')), start, end: new Date(start.getTime() + 86400000) };
}
function createAutomationRunner({ Config, Notification, Quotation, Invoice, Task, Event, Lead, now = () => new Date() }) {
  const notify = async (key, values) => {
    try { await Notification.findOneAndUpdate({ eventKey: key }, { $setOnInsert: { ...values, eventKey: key, createdAt: now() } }, { upsert: true, new: true }); }
    catch (error) { if (error.code !== 11000) throw error; }
  };
  return async () => {
    const studio = await Config.findOne({ key: 'studio' });
    const settings = { ...DEFAULTS.automation, ...(studio?.automation?.toObject?.() || studio?.automation || {}) };
    const stamp = now(), clock = indiaClock(stamp);
    if (settings.notifyQuoteAccepted) {
      const rows = await Quotation.find({ status: 'Accepted', acceptedAt: { $gte: new Date(stamp.getTime() - 7 * 86400000) } }).select('_id clientName documentNumber').limit(100).lean();
      for (const row of rows) await notify('quote-accepted:' + row._id, { title: 'Quotation accepted', description: `${row.clientName} accepted quotation ${row.documentNumber || String(row._id).slice(-6)}.`, type: 'System', link: '/admin/quotations' });
    }
    if (settings.notifyPaymentOverdue) {
      const rows = await Invoice.find({ documentStatus: 'Sent', status: 'Pending', dueDate: { $lt: clock.start } }).select('_id clientName total advancePaid').limit(100).lean();
      for (const row of rows) if (Number(row.total) > Number(row.advancePaid || 0)) await notify(`payment-overdue:${row._id}:${clock.day}`, { title: 'Payment overdue', description: `${row.clientName} has an outstanding issued invoice.`, type: 'Invoice', link: '/admin/invoices/' + row._id });
    }
    if (settings.notifyDeliveryDue) {
      const rows = await Task.find({ status: 'pending', dueDate: { $lt: clock.end } }).select('_id title').limit(100).lean();
      for (const row of rows) await notify(`delivery-due:${row._id}:${clock.day}`, { title: 'Production task needs attention', description: row.title, type: 'Task', link: '/admin/post-production' });
    }
    if (settings.notifyAssignments) {
      const rows = await Event.find({ end: { $gte: stamp }, updatedAt: { $gte: new Date(stamp.getTime() - 7 * 86400000) }, 'teamMembers.0': { $exists: true } }).select('_id title teamMembers').limit(100).lean();
      for (const row of rows) {
        const members = [...new Set(row.teamMembers || [])].sort();
        const signature = crypto.createHash('sha256').update(members.join('\n')).digest('hex').slice(0, 20);
        await notify(`crew-assignment:${row._id}:${signature}`, { title: 'Crew assignment updated', description: `${row.title}: ${members.join(', ')}.`, type: 'Event', link: '/admin/calendar' });
      }
    }
    if (settings.dailyDigestEnabled && clock.hour >= settings.dailyDigestHour) {
      const [enquiries, events, tasks] = await Promise.all([Lead.countDocuments({ status: { $nin: ['Converted', 'Archived'] } }), Event.countDocuments({ end: { $gte: stamp }, start: { $lt: new Date(clock.end.getTime() + 7 * 86400000) } }), Task.countDocuments({ status: 'pending' })]);
      await notify('studio-briefing:' + clock.day, { title: 'Your daily studio briefing', description: `${enquiries} open enquiries · ${events} events in the coming week · ${tasks} pending production tasks.`, type: 'System', link: '/admin' });
    }
  };
}
let running = false;
async function runStudioAutomation() {
  if (running) return;
  running = true;
  try { const model = name => require('../models/' + name); await createAutomationRunner({ Config: model('StudioConfig'), Notification: model('Notification'), Quotation: model('Quotation'), Invoice: model('Invoice'), Task: model('Task'), Event: model('Event'), Lead: model('Lead') })(); }
  finally { running = false; }
}
module.exports = { indiaClock, createAutomationRunner, runStudioAutomation };
