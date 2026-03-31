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
 */
async function pollGoogleCalendar(user, io) {
    if (!user || syncingUsers.has(user._id.toString())) {
        console.log(`⏳ Sync already in progress for ${user.googleEmail || user.email}. Skipping redundant request.`);
        return;
    }

    try {
        syncingUsers.add(user._id.toString());
        const calendar = await getCalendarClient(user);
        const calendarId = user.googleCalendarId || 'primary';

        const response = await calendar.events.list({
            calendarId,
            timeMin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Past 24 hours
            timeMax: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Next 365 days
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
            let localEvent = await Event.findOne({ googleEventId: gEvent.id });

            // Deduplication Fallback: Search by title and start time if the Google ID link is missing
            if (!localEvent && gEvent.status !== 'cancelled') {
                const gStart = new Date(gEvent.start.dateTime || gEvent.start.date);
                localEvent = await Event.findOne({
                    title: gEvent.summary || 'Untitled Event',
                    start: gStart,
                    userId: user._id
                });

                if (localEvent) {
                    console.log(`🔗 Deduplication: Linking existing website event "${localEvent.title}" to Google ID: ${gEvent.id}`);
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
                        console.log(`❌ Deleted local event ${localEvent.title} (Reason: Google-sync status: cancelled)`);
                        hasChanges = true;
                    } else {
                        // For website-first events, just break the link instead of deleting
                        localEvent.googleEventId = null;
                        localEvent.lastUpdatedFrom = 'local';
                        await localEvent.save();
                        console.log(`📡 Persist: Website event ${localEvent.title} kept as local-only (Cancelled in Google)`);
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
            
            // Note: We intentionally DO NOT include 'origin' in eventData for updates
            // so that we don't accidentally claim a website-born event as Google-born.

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
                const newEvent = new Event({
                    ...eventData,
                    origin: 'google' // Created from Google sync
                });
                await newEvent.save();
                console.log(`➕ Created local event: ${eventData.title} (Reason: Google-sync)`);
                hasChanges = true;
            }
        }

        // 2. Cleanup Orphaned Local Events (Orphans: local exists with googleEventId but NOT in gEvents list)
        // SAFETY: Only delete if the orphan falls within the time range we just polled!
        // This prevents the deletion of 2027+ events that aren't in the current 365-day window.
        const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        const localSyncedEvents = await Event.find({ 
            userId: user._id, 
            googleEventId: { $ne: null },
            start: { $gte: timeMin, $lte: timeMax } // CRITICAL: Only cleanup within the polled window
        });

        for (const lEvent of localSyncedEvents) {
            if (!googleEventIds.includes(lEvent.googleEventId)) {
                if (lEvent.origin === 'google') {
                    await Event.findByIdAndDelete(lEvent._id);
                    console.log(`🗑️ Cleanup: Deleted orphaned local event ${lEvent.title} (Originally from Google)`);
                    hasChanges = true;
                } else {
                    // Website-first event: just disconnect from Google instead of deleting
                    lEvent.googleEventId = null;
                    lEvent.lastUpdatedFrom = 'local';
                    await lEvent.save();
                    console.log(`📡 Persist: Orphaned website event ${lEvent.title} kept as local-only`);
                    hasChanges = true;
                }
            }
        }

        if (hasChanges && io) {
            io.emit('calendar_update', { action: 'SYNC', email: user.googleEmail || user.email });
        }
    } catch (error) {
        console.error(`❌ Error polling Google Calendar for user ${user.googleEmail || user.email}:`, error.message);
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
