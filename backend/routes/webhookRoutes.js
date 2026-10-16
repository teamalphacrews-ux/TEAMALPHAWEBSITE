const express = require('express');
const Lead = require('../models/Lead');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { isWebhookConfigured, createEnquiryWebhookHandler } = require('../utils/enquiryWebhook');

const router = express.Router();

router.get('/enquiries/status', auth, requireAdmin, (req, res) => res.json({
    configured: isWebhookConfigured(process.env.ENQUIRY_WEBHOOK_SECRET),
    method: 'POST', path: '/api/webhooks/enquiries', authentication: 'Bearer', idempotencyHeader: 'Idempotency-Key'
}));
router.post('/enquiries', createEnquiryWebhookHandler({ Lead }));

module.exports = router;
