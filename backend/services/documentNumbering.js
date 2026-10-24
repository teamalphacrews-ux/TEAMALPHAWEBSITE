const crypto = require('crypto');
const Counter = require('../models/DocumentCounter');
const { billingDefaults, dateOnly } = require('../utils/documentDefaults');
function financialYear(date) {
  const [year, month] = dateOnly(date).split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}
async function nextDocumentNumber(kind, studio = {}, date = new Date(), Model) {
  if (!['quotation', 'invoice'].includes(kind)) throw new Error('Unknown document kind');
  const defaults = billingDefaults(studio);
  const prefix = defaults[kind === 'quotation' ? 'quotationPrefix' : 'invoicePrefix'];
  const year = defaults.includeFinancialYear ? financialYear(date) : '';
  const stem = [prefix, year].filter(Boolean).join('-');
  if (stem.length > 29) throw Object.assign(new Error('Shorten the document prefix to leave room for its unique number.'), { status: 400 });
  for (let attempt = 0; attempt < 100; attempt++) {
    let suffix;
    if (defaults.numberingMode === 'sequence') {
      let counter;
      try {
        counter = await Counter.findOneAndUpdate({ _id: `${kind}:${stem}` }, { $inc: { value: 1 } }, { upsert: true, new: true });
      } catch (error) {
        if (error.code === 11000) continue;
        throw error;
      }
      if (!Number.isSafeInteger(counter.value) || counter.value < 1) throw new Error('Document sequence is unavailable');
      suffix = String(counter.value).padStart(6, '0');
    } else suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    const documentNumber = `${stem}-${suffix}`;
    if (!Model || !(await Model.exists({ documentNumber }))) return documentNumber;
  }
  throw Object.assign(new Error('Could not reserve a document number. Please retry.'), { status: 409 });
}
module.exports = { financialYear, nextDocumentNumber };
