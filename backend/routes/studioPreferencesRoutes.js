const router = require('express').Router();
const User = require('../models/User');
const { defaults, parsePreferences } = require('../utils/studioPreferences');
router.use(require('../middleware/auth'), require('../middleware/requireAdmin'));
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/preferences', async (req, res) => {
  try { const user = await User.findById(req.user.id).select('studioPreferences'); if (!user) return res.sendStatus(404); res.json({ preferences: { ...defaults(), ...(user.studioPreferences?.toObject?.() || user.studioPreferences || {}) } }); }
  catch { res.status(503).json({ error: 'Your preferences could not be loaded.' }); }
});
router.patch('/preferences', async (req, res) => {
  try {
    const values = parsePreferences(req.body);
    const user = await User.findOneAndUpdate({ _id: req.user.id, role: 'admin' }, { $set: Object.fromEntries(Object.entries(values).map(([key, value]) => ['studioPreferences.' + key, value])) }, { new: true, runValidators: true }).select('studioPreferences');
    if (!user) return res.sendStatus(404);
    res.json({ preferences: { ...defaults(), ...(user.studioPreferences?.toObject?.() || user.studioPreferences || {}) } });
  } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Your preferences could not be saved.' }); }
});
module.exports = router;
