const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Event = require('../models/Event');
const { currentWorkspace } = require('../saas/tenantContext');
const { activeCalendarOwner, snapshotFilter, withCalendarLease } = require('../saas/calendarConnection');
const { configuration } = require('../utils/oauthState');
const { calendarCredential } = require('../utils/calendarCredentials');
const { googleDateRange, googleEventTimes } = require('../utils/calendarDateRange');

// Concurrent sync lock - prevents race conditions
const syncingUsers = new Set();

// A second Google account can use the same event ID. Keep disconnected
// records intact and only reconcile the currently authorized primary calendar.
function eventKeyPrefix(user) {
    if (!currentWorkspace()) return '';
    if (!user.googleCalendarSource) throw new Error('Reconnect Google Calendar to confirm the account.');
    return user.googleCalendarSource + ':';
}

/**
 * Gets an authenticated Google Calendar API client for a user.
 */
async function getCalendarClient(user) {
    if (process.env.SAAS_ENABLED === 'true' && !currentWorkspace()) throw new Error('A studio workspace is required.');
    if (!user.googleAccessToken || !user.googleRefreshToken) {
        throw new Error('User not connected to Google Calendar');
    }

    const config = currentWorkspace() ? configuration(process.env) : {
        clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: process.env.GOOGLE_REDIRECT_URI
    };
    const oAuth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    const oldRefresh = user.googleRefreshToken;
    oAuth2Client.setCredentials({
        access_token: calendarCredential(user.googleAccessToken, user._id, 'access', 'open'),
        refresh_token: calendarCredential(oldRefresh, user._id, 'refresh', 'open'),
        expiry_date: user.googleTokenExpiry ? new Date(user.googleTokenExpiry).getTime() : null
    });

    oAuth2Client.on('tokens', tokens => {
        if (!tokens.access_token) return;
        const update = {
            googleAccessToken: calendarCredential(tokens.access_token, user._id, 'access', 'seal'),
            googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
        };
        if (tokens.refresh_token) update.googleRefreshToken = calendarCredential(tokens.refresh_token, user._id, 'refresh', 'seal');
        // A disconnect or newer consent can win while Google refreshes the access token.
        User.updateOne({ _id: user._id, googleRefreshToken: oldRefresh, ...(currentWorkspace() ? { googleConnectionId: user.googleConnectionId } : {}) }, { $set: update })
            .catch(() => console.error('Could not persist refreshed calendar credentials.'));
    });

    return google.calendar({ version: 'v3', auth: oAuth2Client });
}

/**
 * Registers a webhook (watch channel) for a user's calendar.
 */
async function setupGoogleWebhook(user) {
    try {
        const calendar = await getCalendarClient(user);
        const calendarId = currentWorkspace() ? 'primary' : user.googleCalendarId || 'primary';
        const webhookUrl = process.env.WEBHOOK_URL;

        if (!webhookUrl) {
            console.warn("⚠️ WEBHOOK_URL not set in .env. Skipping webhook registration.");
            return;
        }

        const channelId = uuidv4();
        const response = await calendar.events.watch({
            calendarId,
            requestBody: {
                id: channelId,
                type: 'web_hook',
                address: webhookUrl
            }
        });

        user.googleWebhookId = channelId;
        user.googleResourceId = response.data.resourceId;
        await user.save();

        console.log("Google Calendar webhook registered.");
    } catch (error) {
        console.error("Google Calendar webhook registration failed.");
    }
}

/**
 * Syncs a local event to Google Calendar.
 */
async function syncToGoogle(event, action, userId) {
    try {
        const workspace = currentWorkspace();
        if (process.env.SAAS_ENABLED === 'true' && !workspace) return;
        const projection = '+googleAccessToken +googleRefreshToken';
        const user = workspace ? await User.findOne({ studioOwner: true, accountDisabled: { $ne: true } }, projection) : await User.findById(userId, projection);
        if (!user || !user.googleAccessToken) {
            console.log("⚠️ Sync skipped: User not connected to Google.");
            return;
        }

        if (workspace && !await activeCalendarOwner(workspace, user._id)) return;
        // Abort if event is read-only (e.g. Google Birthday)
        if (event.isReadOnly) {
            return;
        }

        const calendar = await getCalendarClient(user);
        const calendarId = currentWorkspace() ? 'primary' : user.googleCalendarId || 'primary';

        const prefix = eventKeyPrefix(user);
        if (event.googleEventId && !event.googleEventId.startsWith(prefix)) return;
        const externalId = event.googleEventId?.slice(prefix.length);
        const googleEventResource = {
            summary: event.title,
            description: event.description || '',
            location: event.location || '',
            ...googleEventTimes(event),
            ...(workspace ? { extendedProperties: { private: { studioXWorkspace: workspace._id } } } : {}),
        };

        return await withCalendarLease(user, async () => {
            if (action === 'CREATE') {
                const response = await calendar.events.insert({
                    calendarId,
                    resource: googleEventResource
                }, { timeout: 15000, retry: false });
                event.googleEventId = prefix + response.data.id;
                event.lastUpdatedFrom = 'local';
                await event.save();
            } else if (action === 'UPDATE' && event.googleEventId) {
                const method = workspace ? 'patch' : 'update';
                await calendar.events[method]({
                    calendarId,
                    eventId: externalId,
                    resource: googleEventResource
                }, { timeout: 15000, retry: false });
                event.lastUpdatedFrom = 'local';
                await event.save();
            } else if (action === 'DELETE' && event.googleEventId) {
                await calendar.events.delete({
                    calendarId,
                    eventId: externalId
                }, { timeout: 15000, retry: false });
            }
        });
    } catch (error) {
        console.error("Google Calendar could not update the remote event.");
        throw error; // Rethrow to catch in routes
    }
}

async function storeSyncStatus(user, update) {
    if (!currentWorkspace()) {
        await User.findByIdAndUpdate(user._id, update);
        return true;
    }
    if (!user.googleConnectionId) return false;
    const result = await User.updateOne({ _id: user._id, googleConnectionId: user.googleConnectionId }, { $set: update });
    return result.matchedCount > 0;
}

/**
 * Polls Google Calendar for updates and syncs them locally.
 * @param {Object} user - The user document
 * @param {Object} io - Socket.io instance
 * @param {Boolean} isFullSync - If true, fetches a much larger timeframe (e.g. for initial connection)
 */
async function pollGoogleCalendar(user, io, isFullSync = false) {
    if (!user) return { success: false };
    const workspace = currentWorkspace();
    if (process.env.SAAS_ENABLED === 'true' && !workspace) return { success: false };
    const lockId = (workspace?._id || 'personal') + ':' + user._id;
    if (syncingUsers.has(lockId)) {
        console.log("Calendar sync already in progress.");
        return { success: false, inProgress: true };
    }

    try {
        syncingUsers.add(lockId);
        const calendar = await getCalendarClient(user);
        const calendarId = currentWorkspace() ? 'primary' : user.googleCalendarId || 'primary';

        // 1. Define sync window
        // For full sync: 1 year back to 2 years ahead
        // For polling: 2 days back to 1 year ahead
        // Google ignores fractional seconds in both bounds. Use the identical
        // window when deciding which local records were absent from its list.
        const now = Math.floor(Date.now() / 1000) * 1000;
        const timeMin = new Date(now - (isFullSync ? 365 : 2) * 86400000).toISOString();
        const timeMax = new Date(now + 2 * 365 * 86400000).toISOString();

        let googleEvents = [];
        let calendarTimezone = 'Asia/Kolkata';
        let pageToken = null;
        const seenPageTokens = new Set();
        let hasChanges = false;

        console.log(isFullSync ? "Starting full calendar sync." : "Starting calendar poll.");

        if (workspace && (!user.googleConnectionId || !user.googleCalendarSource || !await User.exists(snapshotFilter(user)))) return { success: false };

        // 2. Fetch all pages of events
        do {
            const response = await calendar.events.list({
                calendarId,
                timeMin,
                timeMax,
                singleEvents: true,
                orderBy: 'startTime',
                showDeleted: true,
                pageToken: pageToken || undefined,
                maxResults: 250
            }, { timeout: 15000 });

            if (!Array.isArray(response.data?.items) || response.data.items.some(item => !item || typeof item.id !== 'string' || !item.id)) {
                throw new Error('Google returned an incomplete calendar page.');
            }
            if (response.data.timeZone) calendarTimezone = response.data.timeZone;
            const visible = workspace ? response.data.items.filter(item => {
                const owner = item.extendedProperties?.private?.studioXWorkspace;
                return !owner || owner === workspace._id;
            }) : response.data.items;
            googleEvents = googleEvents.concat(visible);
            pageToken = response.data.nextPageToken;
            if (pageToken) {
                if (typeof pageToken !== 'string' || seenPageTokens.has(pageToken)) {
                    throw new Error('Google returned an invalid calendar page token.');
                }
                seenPageTokens.add(pageToken);
            }
        } while (pageToken);

        return await withCalendarLease(user, async renew => {
            const prefix = eventKeyPrefix(user);
            const googleEventIds = new Set(googleEvents.map(e => prefix + e.id));

            if (googleEvents.length > 0) {
                console.log(`🔍 Fetched ${googleEvents.length} events from Google.`);
            }

            // 3. Update/Create Local Events from Google
            for (const gEvent of googleEvents) {
                await renew();
                let localEvent = await Event.findOne({ googleEventId: prefix + gEvent.id });

                // Deduplication Fallback
                if (!workspace && !localEvent && gEvent.status !== 'cancelled') {
                    const gStart = googleDateRange(gEvent, calendarTimezone).start;
                    localEvent = await Event.findOne({
                        title: gEvent.summary || 'Untitled Event',
                        start: gStart,
                        userId: user._id
                    });

                    if (localEvent) {
                        localEvent.googleEventId = gEvent.id;
                        localEvent.lastUpdatedFrom = 'google';
                        await localEvent.save();
                        hasChanges = true;
                    }
                }

                if (gEvent.status === 'cancelled') {
                    if (localEvent) {
                        if (localEvent.origin === 'google') {
                            await Event.findByIdAndDelete(localEvent._id);
                            hasChanges = true;
                        } else {
                            localEvent.googleEventId = undefined;
                            localEvent.lastUpdatedFrom = 'local';
                            await localEvent.save();
                            hasChanges = true;
                        }
                    }
                    continue;
                }

                const eventData = {
                    title: gEvent.summary || 'Untitled Event',
                    description: gEvent.description || '',
                    ...googleDateRange(gEvent, calendarTimezone),
                    location: gEvent.location || '',
                    userId: localEvent?.userId || user._id,
                    googleEventId: prefix + gEvent.id,
                    googleEventType: gEvent.eventType || 'default',
                    type: gEvent.eventType === 'birthday' ? 'Birthday' : localEvent?.type || 'Other',
                    isReadOnly: Boolean(gEvent.eventType && gEvent.eventType !== 'default'),
                    lastUpdatedFrom: 'google'
                };

                if (localEvent) {
                    const gUpdated = new Date(gEvent.updated);
                    const missingDateMetadata = !Object.hasOwn(localEvent.toObject(), 'allDay')
                        || (Boolean(gEvent.start?.date) && (!localEvent.allDay || !localEvent.startDate || !localEvent.endDateExclusive));
                    if (localEvent.updatedAt < gUpdated) {
                        await Event.findByIdAndUpdate(localEvent._id, eventData);
                        hasChanges = true;
                    } else if (missingDateMetadata && localEvent.lastUpdatedFrom === 'google' && gEvent.start?.date) {
                        // Backfill date-only semantics without overwriting newer local titles or crew.
                        await Event.findByIdAndUpdate(localEvent._id, googleDateRange(gEvent, calendarTimezone));
                        hasChanges = true;
                    }
                } else {
                    const newEvent = new Event({ ...eventData, origin: 'google' });
                    await newEvent.save();
                    hasChanges = true;
                }
            }

            // 4. Cleanup Orphaned Local Events (within the polled window)
            const windowStart = new Date(timeMin);
            const windowEnd = new Date(timeMax);
            const localSyncedEvents = await Event.find({
                ...(workspace ? {} : { userId: user._id }),
                googleEventId: workspace ? { $regex: '^' + prefix } : { $ne: null },
                // Google lists events that end after timeMin and start before timeMax.
                start: { $lt: windowEnd },
                end: { $gt: windowStart }
            });

            for (const lEvent of localSyncedEvents) {
                await renew();
                if (!googleEventIds.has(lEvent.googleEventId)) {
                    if (lEvent.origin === 'google') {
                        await Event.findByIdAndDelete(lEvent._id);
                        hasChanges = true;
                    } else {
                        lEvent.googleEventId = undefined;
                        lEvent.lastUpdatedFrom = 'local';
                        await lEvent.save();
                        hasChanges = true;
                    }
                }
            }

            // 5. Update User sync metadata
            await storeSyncStatus(user, { googleLastSyncAt: new Date(), googleSyncError: null });

            if (hasChanges && io) {
                io.to('admin').emit('calendar_update', {
                    action: 'SYNC',
                    email: user.googleEmail || user.email,
                    lastSyncAt: new Date()
                });
            }
            console.log("Calendar sync completed.");
            return { success: true };
        }, true);
    } catch (error) {
        if (['calendar_busy', 'calendar_changed'].includes(error.code))
            return { success: false, inProgress: error.code === 'calendar_busy' };
        let errorMessage = 'Google Calendar sync could not finish. Try again or reconnect your account.';
        if (workspace) {
            const reason = error.response?.data?.error?.errors?.[0]?.reason;
            if (reason === 'accessNotConfigured' || error.response?.data?.error?.details?.some?.(detail => detail.reason === 'SERVICE_DISABLED'))
                errorMessage = 'The Google Calendar API is disabled in the Studio X OS Google Cloud project. Ask Studio X OS support to enable it, then sync again.';
            else if (error.response?.data?.error === 'invalid_grant') errorMessage = 'Calendar permission has expired. Reconnect your Google account.';
        }
        if (error.response?.data?.error === 'insufficient_scope' || error.message?.includes('insufficient authentication scopes')) {
            errorMessage = "INSUFFICIENT_SCOPES: Please disconnect and reconnect your Google Calendar to grant required permissions.";
            console.error("Google Calendar permissions are insufficient.");
        } else {
            console.error("Google Calendar polling failed.");
        }

        // Persist error to user model for UI to show
        if (!await storeSyncStatus(user, { googleSyncError: errorMessage })) return { success: false };
        
        if (io) {
            io.to('admin').emit('calendar_update', {
                action: 'SYNC_ERROR', 
                email: user.googleEmail || user.email,
                error: errorMessage 
            });
        }
        return { success: false };
    } finally {
        syncingUsers.delete(lockId);
    }
}

module.exports = {
    syncToGoogle: (...args) => require('./studioArchiveGate').withShared(() => syncToGoogle(...args), { integrations: true, rejectPaused: true }),
    pollGoogleCalendar: (...args) => require('./studioArchiveGate').withShared(() => pollGoogleCalendar(...args), { integrations: true, rejectPaused: true }),
    getCalendarClient: (...args) => require('./studioArchiveGate').withShared(() => getCalendarClient(...args), { integrations: true, rejectPaused: true }),
    setupGoogleWebhook: (...args) => require('./studioArchiveGate').withShared(() => setupGoogleWebhook(...args), { integrations: true, rejectPaused: true })
};
