const { createHash, createHmac } = require('node:crypto');
const Receipt = require('../models/ManualCreationReceipt');

const initialized = new WeakMap();

function prepareManualCreation() {
  const connection = Receipt.db;
  if (!initialized.has(connection)) {
    const ready = Receipt.createCollection().catch(exception => {
      initialized.delete(connection);
      throw exception;
    });
    initialized.set(connection, ready);
  }
  return initialized.get(connection);
}

function error(status, text) {
  return Object.assign(new Error(text), { status });
}

function ordered(_key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
  }
  return value;
}

async function manualCreation(req, Model, create) {
  const key = req.body?.creationKey;
  if (key === undefined) return { record: await create(), replayed: false };
  if (typeof key !== 'string' || !/^[a-f0-9]{32}$/.test(key)) {
    throw error(400, 'Invalid creation key.');
  }
  const receiptId = createHash('sha256').update(JSON.stringify([req.user.id, key])).digest('hex');
  // A random submission key protects even credential-containing requests from offline guessing.
  // Store only its derived receipt ID and a digest, never the body or raw key.
  const fingerprint = createHmac('sha256', key).update(JSON.stringify(
    [Model.modelName, req.params?.id || '', req.body], ordered,
  )).digest('hex');

  // Personal reset/replacement increments the generation while individual Recovery restores keep it.
  const dataVersion = req.studioDataVersion ?? 0;
  async function replay(receipt, session) {
    if (receipt.dataVersion !== dataVersion) throw error(410, 'Workspace data was replaced. Start a new submission.');
    if (receipt.fingerprint !== fingerprint) throw error(409, 'This submission already created a different record. Refresh to review it before starting another.');
    const record = await Model.findById(receipt.recordId, null, { session });
    if (!record) throw error(410, 'The previously created record was removed.');
    return { record, replayed: true };
  }
  // Wait for the receipt collection on the active tenant connection before starting a transaction.
  await prepareManualCreation();
  try {
    return await Model.db.transaction(async session => {
      const previous = await Receipt.findById(receiptId, null, { session });
      if (previous) return replay(previous, session);
      const record = await create(session);
      await Receipt.create([{ _id: receiptId, fingerprint, dataVersion, recordId: record._id }], { session });
      return { record, replayed: false };
    });
  } catch (exception) {
    if (exception.code === 11000) {
      // A parallel submission may have won since the transaction's snapshot was taken.
      const winner = await Receipt.findById(receiptId);
      if (winner) return replay(winner);
    }
    throw exception;
  }
}

module.exports = { manualCreation, prepareManualCreation };
