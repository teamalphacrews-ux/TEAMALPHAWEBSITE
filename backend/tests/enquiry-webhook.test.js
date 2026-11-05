const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEnquiry, validWebhookToken, isWebhookConfigured, createEnquiryWebhookHandler } = require('../utils/enquiryWebhook');

const secret = 'test-only-enquiry-webhook-secret-32-characters';
const payload = { name: 'Ananya & Rohan', email: 'COUPLE@example.com', phone: '+91 98765 43210',
    eventType: 'Wedding', eventDate: '2027-02-18', eventLocation: 'Bengaluru', notes: 'Please share your availability.' };

async function invoke(handler, { body = payload, key = 'enquiry-001', authorization = `Bearer ${secret}` } = {}) {
    let output;
    const req = { body, header: field => ({ authorization, 'idempotency-key': key }[field.toLowerCase()]) };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
        json(body) { output = { status: this.statusCode, body }; return this; } };
    await handler(req, res);
    return output;
}

function memoryLeads() {
    const records = new Map();
    let initialized = 0;
    return {
        records,
        get initialized() { return initialized; },
        async init() { initialized++; },
        collection: { async createIndex(fields, options) {
            assert.deepEqual(fields, { webhookEventId: 1 });
            assert.deepEqual(options, { unique: true, sparse: true });
        } },
        async findOneAndUpdate(filter, update, options) {
            assert.equal(options.upsert, true);
            assert.equal(options.runValidators, true);
            assert.equal(options.includeResultMetadata, true);
            assert.equal(Object.keys(update).join(), '$setOnInsert');
            const existing = records.get(filter.webhookEventId);
            if (existing) return { value: existing, lastErrorObject: { updatedExisting: true } };
            const lead = { _id: `lead-${records.size + 1}`, ...update.$setOnInsert };
            records.set(filter.webhookEventId, lead);
            return { value: lead, lastErrorObject: { updatedExisting: false } };
        },
        findOne(filter) { return { select: async () => records.get(filter.webhookEventId) || null }; }
    };
}

test('webhook fails closed when unconfigured and authenticates before touching storage', async () => {
    const Lead = memoryLeads();
    assert.equal(isWebhookConfigured(undefined), false);
    assert.equal(isWebhookConfigured('short'), false);
    assert.equal(validWebhookToken(`Bearer ${secret}`, secret), true);
    assert.equal(validWebhookToken(`Bearer ${secret}x`, secret), false);
    assert.equal(validWebhookToken(`Bearer ${secret}`, `${secret} `), false);
    const disabled = createEnquiryWebhookHandler({ Lead, getSecret: () => '' });
    assert.equal((await invoke(disabled)).status, 503);
    const handler = createEnquiryWebhookHandler({ Lead, getSecret: () => secret });
    assert.equal((await invoke(handler, { authorization: null })).status, 401);
    assert.equal((await invoke(handler, { authorization: '' })).status, 401);
    assert.equal((await invoke(handler, { authorization: 'Bearer incorrect' })).status, 401);
    assert.equal(Lead.initialized, 0);
});

test('webhook secrets containing any whitespace are unconfigured and fail closed', async () => {
    const Lead = memoryLeads();
    for (const invalidSecret of [` ${secret}`, `${secret} `, `${secret.slice(0, 12)} ${secret.slice(12)}`,
        `${secret.slice(0, 12)}\t${secret.slice(12)}`, `${secret.slice(0, 12)}\n${secret.slice(12)}`,
        `${secret.slice(0, 12)}\u00a0${secret.slice(12)}`]) {
        assert.equal(isWebhookConfigured(invalidSecret), false);
        assert.equal(validWebhookToken(`Bearer ${invalidSecret}`, invalidSecret), false);
        const handler = createEnquiryWebhookHandler({ Lead, getSecret: () => invalidSecret });
        assert.equal((await invoke(handler)).status, 503);
    }
    assert.equal(Lead.initialized, 0);
});

test('webhook validates dates/contact fields and rejects account/payment/status injection', () => {
    const good = validateEnquiry(payload, 'booking-1');
    assert.equal(good.lead.email, 'couple@example.com');
    assert.equal(good.lead.status, 'New');
    assert.equal(validateEnquiry({ name: 'Couple', email: 'a@b.in', event_id: 'source-event-1' }).key, 'source-event-1');
    for (const body of [null, [], { ...payload, name: '' }, { ...payload, email: 'bad' },
        { ...payload, phone: 'phone' }, { ...payload, eventDate: '2027-02-30' },
        { ...payload, eventDate: '2027-02-18T12:00:00Z' }, { ...payload, notes: 'x'.repeat(4001) },
        { ...payload, role: 'admin' }, { ...payload, createAccount: true }, { ...payload, totalAmount: 100 },
        { ...payload, status: 'Converted' }, { ...payload, webhookEventId: 'manual' }]) {
        assert.throws(() => validateEnquiry(body, 'booking-1'), { status: 400 });
    }
    for (const key of [undefined, '', 'a b', 'x'.repeat(201)]) {
        assert.throws(() => validateEnquiry(payload, key), { status: 400 });
    }
    assert.equal(validateEnquiry({ ...payload, eventDate: '2028-02-29' }, 'leap').lead.eventDate, '2028-02-29');
});

test('same idempotency key returns the first lead without modifying it; distinct keys create new leads', async () => {
    const Lead = memoryLeads();
    const handler = createEnquiryWebhookHandler({ Lead, getSecret: () => secret });
    const first = await invoke(handler);
    const repeat = await invoke(handler, { body: { ...payload, name: 'Changed name' } });
    assert.equal(first.status, 201);
    assert.equal(first.body.duplicate, false);
    assert.equal(repeat.status, 200);
    assert.equal(repeat.body.duplicate, true);
    assert.equal(repeat.body.leadId, first.body.leadId);
    assert.equal(Lead.records.get('enquiry-001').name, payload.name);
    assert.equal(Lead.records.size, 1);
    assert.equal((await invoke(handler, { key: 'enquiry-002' })).status, 201);
    assert.equal(Lead.records.size, 2);
});

test('concurrent duplicate-key winner returns a successful durable receipt', async () => {
    const Lead = memoryLeads();
    Lead.records.set('enquiry-001', { _id: 'winning-lead' });
    Lead.findOneAndUpdate = async () => { throw Object.assign(new Error('duplicate key'), { code: 11000 }); };
    const response = await invoke(createEnquiryWebhookHandler({ Lead, getSecret: () => secret }));
    assert.deepEqual(response, { status: 200, body: { success: true, leadId: 'winning-lead', duplicate: true } });
});

test('retry after ambiguous database acknowledgement does not duplicate the saved enquiry', async () => {
    const Lead = memoryLeads();
    const upsert = Lead.findOneAndUpdate.bind(Lead);
    let interrupted = true;
    Lead.findOneAndUpdate = async (...args) => {
        const result = await upsert(...args);
        if (interrupted) { interrupted = false; throw new Error('connection interrupted after insert'); }
        return result;
    };
    const handler = createEnquiryWebhookHandler({ Lead, getSecret: () => secret });
    assert.equal((await invoke(handler)).status, 503);
    const retry = await invoke(handler);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.duplicate, true);
    assert.equal(Lead.records.size, 1);
});

test('invalid webhook input never initializes or writes the lead collection', async () => {
    const Lead = memoryLeads();
    const response = await invoke(createEnquiryWebhookHandler({ Lead, getSecret: () => secret }), { body: { ...payload, role: 'admin' } });
    assert.equal(response.status, 400);
    assert.equal(Lead.initialized, 0);
    assert.equal(Lead.records.size, 0);
});

test('Mongoose preserves immutable receipt on insert and strips later receipt changes', async () => {
    const mongoose = require('mongoose');
    const Lead = require('../models/Lead');
    const index = Lead.schema.indexes().find(([fields]) => fields.webhookEventId === 1);
    assert.equal(index[1].unique, true);
    assert.equal(index[1].sparse, true);
    const isolated = new mongoose.Mongoose();
    const connection = isolated.createConnection();
    connection.readyState = 1;
    let captured;
    connection.db = { collection: () => ({ findOneAndUpdate: async (filter, update, options) => {
        captured = { filter, update, options };
        return { value: { _id: new mongoose.Types.ObjectId(), name: 'Couple', email: 'a@b.in' },
            lastErrorObject: { updatedExisting: false } };
    } }) };
    const Model = connection.model('WebhookReceiptTest', Lead.schema.clone(), 'webhook_receipt_test');
    await Model.findOneAndUpdate({ webhookEventId: 'durable-key' },
        { $setOnInsert: { name: 'Couple', email: 'a@b.in', status: 'New', webhookEventId: 'durable-key' } },
        { upsert: true, new: true, runValidators: true, includeResultMetadata: true, timestamps: false });
    assert.equal(captured.update.$setOnInsert.webhookEventId, 'durable-key');
    await Model.findOneAndUpdate({ webhookEventId: 'durable-key' },
        { $set: { name: 'Updated couple', webhookEventId: 'changed-key' } }, { new: true });
    assert.equal(captured.update.$set.webhookEventId, undefined);
});
