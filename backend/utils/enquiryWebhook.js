const { createHash, timingSafeEqual } = require('node:crypto');

const ALLOWED_FIELDS = new Set(['name', 'email', 'phone', 'eventType', 'eventDate', 'eventLocation', 'notes', 'event_id']);

function isWebhookConfigured(secret) {
    return typeof secret === 'string' && secret.length >= 32 && !/\s/.test(secret);
}

function validWebhookToken(header, secret) {
    if (!isWebhookConfigured(secret) || typeof header !== 'string') return false;
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match) return false;
    const hash = value => createHash('sha256').update(value).digest();
    return timingSafeEqual(hash(match[1]), hash(secret));
}

function validationError(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function validateEnquiry(body, headerKey) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw validationError('A JSON enquiry object is required');
    if (Object.keys(body).some(field => !ALLOWED_FIELDS.has(field))) throw validationError('Payload contains unsupported fields');
    const text = (field, maximum, required = false) => {
        const value = body[field];
        if (value === undefined || value === null || value === '') {
            if (required) throw validationError(`${field} is required`);
            return undefined;
        }
        if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
            throw validationError(`${field} must be valid text of at most ${maximum} characters`);
        }
        return value.trim();
    };
    const name = text('name', 120, true);
    const email = text('email', 254, true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw validationError('email must be a valid email address');
    const phone = text('phone', 30);
    if (phone && (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) {
        throw validationError('phone must contain between 7 and 15 digits');
    }
    const eventDate = text('eventDate', 10);
    if (eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(eventDate)) || new Date(eventDate).toISOString().slice(0, 10) !== eventDate)) {
        throw validationError('eventDate must be a real date in YYYY-MM-DD format');
    }
    const key = headerKey === undefined ? text('event_id', 200) : headerKey;
    if (typeof key !== 'string' || !key.trim() || key.length > 200 || /[\s\u0000-\u001f]/.test(key)) {
        throw validationError('A non-empty Idempotency-Key header or event_id is required (maximum 200 characters, no whitespace)');
    }
    const lead = { name, email, status: 'New' };
    for (const [field, value] of Object.entries({ phone, eventDate,
        eventType: text('eventType', 80), eventLocation: text('eventLocation', 240), notes: text('notes', 4000) })) {
        if (value !== undefined) lead[field] = value;
    }
    return { key, lead };
}

function createEnquiryWebhookHandler({ Lead, getSecret = () => process.env.ENQUIRY_WEBHOOK_SECRET }) {
    let indexReady;
    const ensureReceiptIndex = async () => {
        if (!indexReady) {
            indexReady = (async () => {
                await Lead.init();
                // Explicitly ensure uniqueness even when autoIndex is disabled.
                await Lead.collection.createIndex({ webhookEventId: 1 }, { unique: true, sparse: true });
            })().catch(error => { indexReady = undefined; throw error; });
        }
        return indexReady;
    };
    return async (req, res) => {
        const secret = getSecret();
        if (!isWebhookConfigured(secret)) return res.status(503).json({ error: 'Enquiry webhook is not configured' });
        if (!validWebhookToken(req.header('authorization'), secret)) return res.status(401).json({ error: 'Webhook authentication failed' });
        let validated;
        try {
            validated = validateEnquiry(req.body, req.header('idempotency-key'));
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
        try {
            // Wait for the unique index before accepting deliveries. A retry
            // cannot insert a second lead even when two requests arrive together.
            await ensureReceiptIndex();
            const receivedAt = new Date();
            const result = await Lead.findOneAndUpdate(
                { webhookEventId: validated.key },
                { $setOnInsert: { ...validated.lead, webhookEventId: validated.key, createdAt: receivedAt, updatedAt: receivedAt } },
                { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, includeResultMetadata: true, timestamps: false }
            );
            const duplicate = !!result.lastErrorObject?.updatedExisting;
            return res.status(duplicate ? 200 : 201).json({ success: true, leadId: String(result.value._id), duplicate });
        } catch (error) {
            // A concurrent insert can win between matching and upserting.
            // The winner remains the durable receipt; do not create another lead.
            if (error.code === 11000) {
                try {
                    const existing = await Lead.findOne({ webhookEventId: validated.key }).select('_id');
                    if (existing) return res.status(200).json({ success: true, leadId: String(existing._id), duplicate: true });
                } catch { /* Fall through to a retryable response. */ }
            }
            console.error('Enquiry webhook storage failed:', error.name || 'DatabaseError');
            return res.status(503).json({ error: 'Unable to save enquiry; retry with the same idempotency key' });
        }
    };
}

module.exports = { isWebhookConfigured, validWebhookToken, validateEnquiry, createEnquiryWebhookHandler };
