const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Event = require('../models/Event');

// Concurrent sync lock - prevents race conditions
const syncingUsers = new Set();

/**
 * Gets an authenticated Google Calendar API client for a user.
 */
async function getCalendarClient(user) {
    if (!user.googleAccessToken || !user.googleRefreshToken) {
        throw new Error('User not connected to Google Calendar');
    }

    const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    oAuth2Client.setCredentials({
        access_token: user.googleAccessToken,
        refresh_token: user.googleRefreshToken,
        expiry_date: user.googleTokenExpiry ? new Date(user.googleTokenExpiry).getTime() : null
    });

    // Handle token refresh
    oAuth2Client.on('tokens', async (tokens) => {
        console.log("♻️ Refreshing Google Tokens for user:", user.googleEmail || user.email);
        if (tokens.refresh_token) {
            user.googleRefreshToken = tokens.refresh_token;
        }
        if (tokens.access_token) {
            user.googleAccessToken = tokens.access_token;
            user.googleTokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
            await user.save();
            console.log("✅ Tokens saved to DB.");
        }
    });

    return google.calendar({ version: 'v3', auth: oAuth2Client });
}

/**
 * Registers a webhook (watch channel) for a user's calendar.
 */
async function setupGoogleWebhook(user) {
    try {
        const calendar = await getCalendarClient(user);
        const calendarId = user.googleCalendarId || 'primary';
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

        console.log(`📡 Google Webhook Registered for ${user.googleEmail || user.email} [Channel: ${channelId}]`);
    } catch (error) {
        console.error(`❌ Webhook Registration Failed for ${user.googleEmail || user.email}:`, error.message);
    }
}

/**
 * Syncs a local event to Google Calendar.
 */
async function syncToGoogle(event, action, userId) {
    try {
        console.log(`🚀 Triggering Sync Website -> Google [Action: ${action}] [Event: ${event.title}]`);
        const user = await User.findById(userId);
        if (!user || !user.googleAccessToken) {
            console.log("⚠️ Sync skipped: User not connected to Google.");
            return;
        }

        // Abort if event is read-only (e.g. Google Birthday)
        if (event.isReadOnly) {
            console.log(`🛡️ Sync aborted: [Event: ${event.title}] is Google-managed and Read-Only.`);
            return;
        }

        const calendar = await getCalendarClient(user);
        const calendarId = user.googleCalendarId || 'primary';

        const googleEventResource = {
            summary: event.title,
            description: event.description || '',
            location: event.location || '',
            start: { 
                dateTime: new Date(event.start).toISOString(),
                timeZone: 'UTC'
            },
            end: { 
                dateTime: new Date(event.end).toISOString(),
                timeZone: 'UTC'
            },
        };

        console.log("📤 Creating Google Event Payload:", JSON.stringify(googleEventResource, null, 2));

        if (action === 'CREATE') {
            const response = await calendar.events.insert({
                calendarId,
                resource: googleEventResource
            });
            console.log("✅ Google Event Inserted:", response.data.id);
            event.googleEventId = response.data.id;
            event.lastUpdatedFrom = 'local';
            await event.save();
        } else if (action === 'UPDATE' && event.googleEventId) {
            const response = await calendar.events.update({
                calendarId,
                eventId: event.googleEventId,
                resource: googleEventResource
            });
            console.log("✅ Google Event Updated:", response.data.id);
            event.lastUpdatedFrom = 'local';
            await event.save();
        } else if (action === 'DELETE' && event.googleEventId) {
            await calendar.events.delete({
                calendarId,
                eventId: event.googleEventId
            });
            console.log("🗑️ Google Event Deleted:", event.googleEventId);
        }
    } catch (error) {
        console.error("❌ Google Calendar Sync Error:", error.response?.data || error.message);
        throw error; // Rethrow to catch in routes
    }
}

/**
 * Polls Google Calendar for updates and syncs them locally.
 * @param {Object} user - The user document
 * @param {Object} io - Socket.io instance
 * @param {Boolean} isFullSync - If true, fetches a much larger timeframe (e.g. for initial connection)
 */
async function pollGoogleCalendar(user, io, isFullSync = false) {
    if (!user || syncingUsers.has(user._id.toString())) {
        console.log(`⏳ Sync already in progress for ${user.googleEmail || user.email}. Skipping redundant request.`);
        return;
    }

    try {
        syncingUsers.add(user._id.toString());
        const calendar = await getCalendarClient(user);
        const calendarId = user.googleCalendarId || 'primary';

        // 1. Define sync window
        // For full sync: 1 year back to 2 years ahead
        // For polling: 2 days back to 1 year ahead
        const timeMin = isFullSync 
            ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();

        let googleEvents = [];
        let pageToken = null;
        let hasChanges = false;

        console.log(`📡 Starting ${isFullSync ? 'FULL' : 'DELTA'} Sync for ${user.googleEmail || user.email}...`);

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
            });

            if (response.data.items) {
                googleEvents = googleEvents.concat(response.data.items);
            }
            pageToken = response.data.nextPageToken;
        } while (pageToken);

        const googleEventIds = googleEvents.map(e => e.id);

        if (googleEvents.length > 0) {
            console.log(`🔍 Fetched ${googleEvents.length} events from Google.`);
        }

        // 3. Update/Create Local Events from Google
        for (const gEvent of googleEvents) {
            let localEvent = await Event.findOne({ googleEventId: gEvent.id });

            // Deduplication Fallback
            if (!localEvent && gEvent.status !== 'cancelled') {
                const gStart = new Date(gEvent.start.dateTime || gEvent.start.date);
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
                        localEvent.googleEventId = null;
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
                start: new Date(gEvent.start.dateTime || gEvent.start.date),
                end: new Date(gEvent.end.dateTime || gEvent.end.date),
                location: gEvent.location || '',
                userId: user._id,
                googleEventId: gEvent.id,
                googleEventType: gEvent.eventType || 'default',
                type: gEvent.eventType === 'birthday' ? 'Birthday' : 'Other',
                isReadOnly: gEvent.eventType !== 'default',
                lastUpdatedFrom: 'google'
            };

            if (localEvent) {
                const gUpdated = new Date(gEvent.updated);
                if (localEvent.updatedAt < gUpdated) {
                    await Event.findByIdAndUpdate(localEvent._id, eventData);
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
            userId: user._id, 
            googleEventId: { $ne: null },
            start: { $gte: windowStart, $lte: windowEnd }
        });

        for (const lEvent of localSyncedEvents) {
            if (!googleEventIds.includes(lEvent.googleEventId)) {
                if (lEvent.origin === 'google') {
                    await Event.findByIdAndDelete(lEvent._id);
                    hasChanges = true;
                } else {
                    lEvent.googleEventId = null;
                    lEvent.lastUpdatedFrom = 'local';
                    await lEvent.save();
                    hasChanges = true;
                }
            }
        }

        // 5. Update User sync metadata
        await User.findByIdAndUpdate(user._id, {
            googleLastSyncAt: new Date(),
            googleSyncError: null
        });

        if (hasChanges && io) {
            io.emit('calendar_update', { 
                action: 'SYNC', 
                email: user.googleEmail || user.email,
                lastSyncAt: new Date()
            });
        }
        console.log(`✅ Sync Completed for ${user.googleEmail || user.email}.`);

    } catch (error) {
        let errorMessage = error.message;
        if (error.response?.data?.error === 'insufficient_scope' || error.message.includes('insufficient authentication scopes')) {
            errorMessage = "INSUFFICIENT_SCOPES: Please disconnect and reconnect your Google Calendar to grant required permissions.";
            console.error(`❌ Scope Error for ${user.googleEmail || user.email}: ${errorMessage}`);
        } else {
            console.error(`❌ Error polling Google Calendar for ${user.googleEmail || user.email}:`, error.message);
        }

        // Persist error to user model for UI to show
        await User.findByIdAndUpdate(user._id, { googleSyncError: errorMessage });
        
        if (io) {
            io.emit('calendar_update', { 
                action: 'SYNC_ERROR', 
                email: user.googleEmail || user.email,
                error: errorMessage 
            });
        }
    } finally {
        syncingUsers.delete(user._id.toString());
    }
}

module.exports = {
    syncToGoogle,
    pollGoogleCalendar,
    getCalendarClient,
    setupGoogleWebhook
};
