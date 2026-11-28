const { workspaceToken: calendarWorkspaceToken } = require('./calendarConnection');
const { gmailWorkspaceToken } = require('../utils/gmailOAuth');

// Each flow accepts only its own state shape. The sign-in router receives
// unprefixed state and validates it against its separate sign-in flow store.
function createGoogleCallbackDispatcher({ gmail, calendar }) {
  return (req, res, next) => {
    const state = req.query?.state;
    if (typeof state === 'string') {
      if (gmailWorkspaceToken.test(state)) return gmail(req, res);
      if (calendarWorkspaceToken.test(state)) return calendar(req, res);
    }
    return next();
  };
}

module.exports = { createGoogleCallbackDispatcher };
