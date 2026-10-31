const router = require('express').Router();
const mailer = require('../services/studioMailer');
router.use(require('../middleware/auth'), require('../middleware/requireAdmin'));
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/email/status', (_req, res) => {
  const candidate = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || '';
  const address = /<([^<>]+)>/.exec(candidate)?.[1] || candidate;
  res.json({ configured: mailer.mailerReady(), sender: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : '' });
});
router.post('/email/test', async (req, res) => {
  try {
    if (Object.keys(req.body || {}).length) return res.status(400).json({ error: 'Test emails are sent only to your own account.' });
    if (!mailer.mailerReady()) return res.status(503).json({ error: 'Studio email delivery is not configured.' });
    const user = await require('../models/User').findById(req.user.id).select('email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user?.email || '')) return res.status(400).json({ error: 'Your account needs a valid email address.' });
    const now = new Date();
    try { await require('../models/StudioOperationLease').findOneAndUpdate({ _id: 'mail-test:' + req.user.id, until: { $lte: now } }, { $set: { until: new Date(now.getTime() + 60000), expiresAt: new Date(now.getTime() + 300000) } }, { upsert: true, new: true }); }
    catch (error) { if (error.code === 11000) return res.status(429).json({ error: 'Wait one minute before sending another test.' }); throw error; }
    await mailer.sendStudioMail({ to: user.email, subject: 'Team Alpha · Studio email test', text: 'Your Studio OS email delivery connection is working. This test was requested from your studio settings.', html: '<p>Your Studio OS email delivery connection is working.</p><p>This test was requested from your studio settings.</p>' });
    res.json({ message: 'Test email sent to your account.' });
  } catch { res.status(503).json({ error: 'The test email could not be delivered. Check your studio mail configuration.' }); }
});
module.exports = router;
