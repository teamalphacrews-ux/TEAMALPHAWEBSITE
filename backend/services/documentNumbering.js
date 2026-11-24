const crypto = require('crypto');
const Counter = require('../models/DocumentCounter');
const Invoice = require('../models/Invoice');
const { billingDefaults, dateOnly } = require('../utils/documentDefaults');
function financialYear(date) {
  const [year, month] = dateOnly(date).split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}
function documentNumberScope(kind, studio, date) {
  if (!['quotation', 'invoice'].includes(kind)) throw new Error('Unknown document kind');
  const defaults = billingDefaults(studio);
  const prefix = defaults[kind === 'quotation' ? 'quotationPrefix' : 'invoicePrefix'];
  const year = defaults.includeFinancialYear ? financialYear(date) : '';
  const stem = [prefix, year].filter(Boolean).join('-');
  if (stem.length > 29) throw Object.assign(new Error('Shorten the document prefix to leave room for its unique number.'), { status: 400 });
  return { stem, mode: defaults.numberingMode };
}

const withSuffix = (stem, value) => `${stem}-${String(value).padStart(6, '0')}`;
const retryNumbering = () => Object.assign(new Error('Could not reserve a document number. Please retry.'), { status: 409 });

async function nextDocumentNumber(kind, studio = {}, date = new Date(), Model) {
  const scope = documentNumberScope(kind, studio, date);
  return nextInScope(kind, scope, Model);
}

async function nextInScope(kind, { stem, mode }, Model) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let documentNumber;
    if (mode === 'sequence') {
      let counter;
      try {
        counter = await Counter.findOneAndUpdate({ _id: `${kind}:${stem}` }, { $inc: { value: 1 } }, { upsert: true, new: true });
      } catch (error) {
        if (error.code === 11000) continue;
        throw error;
      }
      if (!Number.isSafeInteger(counter.value) || counter.value < 1) throw new Error('Document sequence is unavailable');
      documentNumber = withSuffix(stem, counter.value);
    } else documentNumber = `${stem}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    if (!Model || !(await Model.exists({ documentNumber }))) return documentNumber;
  }
  throw retryNumbering();
}

const scopeClaimId = invoiceId => `invoice-reservation:${invoiceId}`;

async function claimScope(invoiceId, scope) {
  const _id = scopeClaimId(invoiceId);
  try {
    const claim = await Counter.findOneAndUpdate(
      { _id }, { $setOnInsert: { invoiceNumbering: scope } }, { upsert: true, new: true },
    );
    return claim.invoiceNumbering;
  } catch (error) {
    if (error.code === 11000) {
      const claim = await Counter.findById(_id);
      if (claim) return claim.invoiceNumbering;
    }
    throw error;
  }
}

async function reserveInvoiceSequence(invoiceId, stem) {
  const counterId = `invoice:${stem}`;
  const key = String(invoiceId);
  const pending = `pendingInvoices.${key}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    const observed = await Counter.findById(counterId);
    // Read the counter before the invoice. If another request completes and
    // removes its reservation between these reads, the invoice is visible or
    // the counter's value has advanced and this compare-and-set cannot win.
    const invoice = await Invoice.findById(invoiceId);
    if (invoice) return { invoice };
    const reserved = observed?.pendingInvoices?.get(key);
    if (reserved) return { documentNumber: withSuffix(stem, reserved) };
    const current = observed?.value ?? 0;
    const next = current + 1;
    if (!Number.isSafeInteger(next) || next < 1) throw new Error('Document sequence is unavailable');
    const documentNumber = withSuffix(stem, next);
    const occupied = await Invoice.exists({ documentNumber });
    const update = { $inc: { value: 1 } };
    if (!occupied) update.$set = { [pending]: next };
    try {
      const claimed = await Counter.findOneAndUpdate(
        { _id: counterId, value: observed ? current : { $exists: false } },
        update, { upsert: !observed, new: true },
      );
      if (claimed && !occupied) return { documentNumber };
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  throw retryNumbering();
}

async function finishClaim(invoiceId, scope) {
  if (scope.mode === 'sequence') {
    const pending = `pendingInvoices.${String(invoiceId)}`;
    await Counter.updateOne({ _id: `invoice:${scope.stem}`, [pending]: { $exists: true } }, { $unset: { [pending]: 1 } });
  }
  await Counter.deleteOne({ _id: scopeClaimId(invoiceId), 'invoiceNumbering.stem': scope.stem, 'invoiceNumbering.mode': scope.mode });
}

// The claim pins numbering settings across retries. A sequence increment and
// its reservation are one write, so standalone MongoDB can safely resume after
// interruption. The caller must insert against the same unique invoice ID.
async function persistNumberedInvoice({ invoiceId, studio, date, persist }) {
  if (!/^[0-9a-f]{24}$/.test(String(invoiceId))) throw new Error('Invalid invoice identity');
  const existing = await Invoice.findById(invoiceId);
  const previous = (await Counter.findById(scopeClaimId(invoiceId)))?.invoiceNumbering;
  if (existing) {
    if (previous) await finishClaim(invoiceId, previous);
    return existing;
  }
  const scope = previous || await claimScope(invoiceId, documentNumberScope('invoice', studio, date));
  const reservation = scope.mode === 'sequence'
    ? await reserveInvoiceSequence(invoiceId, scope.stem)
    : { documentNumber: await nextInScope('invoice', scope, Invoice) };
  const invoice = reservation.invoice || await persist(reservation.documentNumber);
  if (!invoice) throw retryNumbering();
  await finishClaim(invoiceId, scope);
  return invoice;
}

module.exports = { financialYear, nextDocumentNumber, persistNumberedInvoice };
