const express = require('express');
const { createSocialAuth, frontendOrigin } = require('./socialAuth');

function createSocialRouter({ authLimit, social = createSocialAuth(), env = process.env } = {}) {
  const router = express.Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });
  const limited = authLimit || ((_req, _res, next) => next());
  const respond = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (error) { res.status(error.status || 503).json({ msg: error.status ? error.message : 'Sign-in is temporarily unavailable. Please retry.' }); }
  };
  router.post('/:provider/start', limited, respond(req => social.start(req.params.provider, req.body?.purpose)));
  router.post('/complete', limited, respond(req => social.complete(req.body, req)));
  const callback = provider => async (req, res) => {
    const body = provider === 'apple' ? req.body : req.query;
    try {
      const result = await social.callback(provider, body);
      res.redirect(303, result.redirect);
    } catch (error) {
      const code = error.message === 'Sign-in was cancelled.' ? 'cancelled' : error.message === 'The sign-in request has expired.' ? 'expired' : error.status === 503 ? 'unavailable' : 'verification_failed';
      // Only server-configured destinations and fixed error codes; never return provider errors/tokens.
      try { res.redirect(303, frontendOrigin(env) + '/studio-os/auth/callback#error=' + code); }
      catch { res.status(503).json({ msg: 'Sign-in is not configured. Please return to Studio OS.' }); }
    }
  };
  router.get('/google/callback', callback('google'));
  router.post('/apple/callback', express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 10 }), callback('apple'));
  return router;
}
module.exports = { createSocialRouter };
