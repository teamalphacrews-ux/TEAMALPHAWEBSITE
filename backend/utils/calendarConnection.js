const { configuration } = require("./oauthState");

function calendarConnection(user = {}, env = process.env) {
  let configured = false;
  try { configuration(env); configured = true; } catch { /* Report readiness without exposing credentials. */ }
  const reconnectRequired = Boolean(user.googleAccessToken && !user.googleRefreshToken);
  const isSynced = configured && Boolean(user.googleAccessToken && user.googleRefreshToken);
  return {
    configured,
    isSynced,
    reconnectRequired,
    email: isSynced ? user.googleEmail : user.email,
    lastSyncAt: user.googleLastSyncAt || null,
    syncError: user.googleSyncError || null,
    setupMessage: !configured
      ? "Google Calendar setup is incomplete. Your studio administrator needs to finish the Google connection settings."
      : reconnectRequired ? "Reconnect Google Calendar to restore permission for ongoing synchronization." : "",
  };
}

function createCalendarSyncHandler({ User, pollGoogleCalendar, env = process.env }) {
  return async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: "Studio account not found." });
      const status = calendarConnection(user, env);
      if (!status.configured) return res.status(503).json({ message: status.setupMessage });
      if (!status.isSynced) return res.status(400).json({ message: status.setupMessage || "Connect Google Calendar before synchronizing." });
      const result = await pollGoogleCalendar(user, req.io);
      if (result?.inProgress) return res.status(409).json({ message: "Calendar synchronization is already running. Please wait and try again." });
      if (result?.success !== true) return res.status(502).json({ message: "Google Calendar could not be synchronized. Please try again or reconnect." });
      return res.json({ success: true, message: "Calendar synchronized." });
    } catch {
      return res.status(502).json({ message: "Google Calendar could not be synchronized. Please try again or reconnect." });
    }
  };
}

module.exports = { calendarConnection, createCalendarSyncHandler };
