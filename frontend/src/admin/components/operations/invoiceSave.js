const editableFields = [
  "clientName", "clientEmail", "clientPhone", "clientAddress", "title",
  "leadId", "contactId", "studioProjectId", "documentNumber", "invoiceDate",
  "dueDate", "items", "discountType", "discountValue", "taxRateBps",
  "extraCharges", "advancePaid", "notes", "terms", "status", "issuer",
  "paymentScheduleEnabled", "paymentSchedule", "acceptedPaymentMethods",
  "paymentReminders", "reminderOffsets", "allowTip", "design",
];

const fieldValue = value => JSON.stringify(value, (key, item) => key === "_id" ? undefined : item);

export function invoiceEdits(draft, base) {
  return Object.fromEntries(editableFields
    .filter(key => fieldValue(draft[key]) !== fieldValue(base[key]))
    .map(key => [key, draft[key]]));
}

export function rebaseInvoiceEdits(draft, base, latest) {
  const local = invoiceEdits(draft, base);
  const remote = invoiceEdits(latest, base);
  const conflicts = Object.keys(local).filter(key =>
    Object.hasOwn(remote, key) && fieldValue(local[key]) !== fieldValue(remote[key]));
  return { local, conflicts };
}

export function newInvoiceCreationKey(crypto = globalThis.crypto) {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, "0")).join("");
}

// A browser history entry identifies one new draft across refreshes. A
// deliberate new invoice gets a new entry and therefore a different key.
export function invoiceCreationKey(scope, history = globalThis.history) {
  const state = history.state || {};
  const previous = state.studioInvoiceCreation;
  if (previous?.scope === scope && /^[a-f0-9]{32}$/.test(previous.key)) {
    return { key: previous.key, restored: true };
  }
  const key = newInvoiceCreationKey();
  history.replaceState({ ...state, studioInvoiceCreation: { scope, key } }, "");
  return { key, restored: false };
}
