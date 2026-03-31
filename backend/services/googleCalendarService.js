const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Event = require('../models/Event');

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
 */
async function pollGoogleCalendar(user, io) {
    try {
        const calendar = await getCalendarClient(user);
        const calendarId = user.googleCalendarId || 'primary';

        const response = await calendar.events.list({
            calendarId,
            timeMin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Past 24 hours
            singleEvents: true,
            orderBy: 'startTime',
            showDeleted: true // Important: include deleted events to sync deletes
        });

        const googleEvents = response.data.items;
        const googleEventIds = googleEvents.map(e => e.id);
        let hasChanges = false;

        if (googleEvents.length > 0) {
            console.log(`🔍 Fetched Google Events for ${user.googleEmail || user.email}:`, googleEvents.length);
        }

        // 1. Update/Create Local Events from Google
        for (const gEvent of googleEvents) {
            const localEvent = await Event.findOne({ googleEventId: gEvent.id });

            if (gEvent.status === 'cancelled') {
                if (localEvent) {
                    await Event.findByIdAndDelete(localEvent._id);
                    console.log(`❌ Deleted local event ${localEvent.title} (Reason: Google-sync status: cancelled)`);
                    hasChanges = true;
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
                lastUpdatedFrom: 'google'
            };

            if (localEvent) {
                // Update local event if Google version is newer
                const gUpdated = new Date(gEvent.updated);
                if (localEvent.updatedAt < gUpdated) {
                    await Event.findByIdAndUpdate(localEvent._id, eventData);
                    console.log(`📝 Updated local event: ${eventData.title} (Reason: Google-sync)`);
                    hasChanges = true;
                }
            } else {
                // Create local event since it does not exist
                const newEvent = new Event(eventData);
                await newEvent.save();
                console.log(`➕ Created local event: ${eventData.title} (Reason: Google-sync)`);
                hasChanges = true;
            }
        }

        // 2. Cleanup Orphaned Local Events (Orphans: local exists with googleEventId but NOT in gEvents list)
        // This is a fallback for showDeleted: true
        const localSyncedEvents = await Event.find({ userId: user._id, googleEventId: { $ne: null } });
        for (const lEvent of localSyncedEvents) {
            if (!googleEventIds.includes(lEvent.googleEventId)) {
                await Event.findByIdAndDelete(lEvent._id);
                console.log(`🗑️ Cleanup: Deleted orphaned local event ${lEvent.title} (Not found in Google)`);
                hasChanges = true;
            }
        }

        if (hasChanges && io) {
            io.emit('calendar_update', { action: 'SYNC', email: user.googleEmail || user.email });
        }
    } catch (error) {
        console.error(`❌ Error polling Google Calendar for user ${user.googleEmail || user.email}:`, error.message);
    }
}

module.exports = {
    syncToGoogle,
    pollGoogleCalendar,
    getCalendarClient,
    setupGoogleWebhook
};
