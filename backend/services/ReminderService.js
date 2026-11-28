const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Event = require('../models/Event');
const Photographer = require('../models/Photographer');
const StudioOperationLease = require('../models/StudioOperationLease');
const { DEFAULT_STUDIO_TIMEZONE, studioDayStart } = require('../utils/studioDay');
const { escapeHtml } = require('./studioMailer');

const formatTime = value => new Date(value).toLocaleString('en-IN', {
    timeZone: DEFAULT_STUDIO_TIMEZONE, timeZoneName: 'short',
});

async function assignmentRecipients(names) {
    // Calendar assignments store display names. A duplicate name does not
    // identify which of the two people should receive private event details.
    const lookup = new Map([...new Set(names)].map(name => [name, []]));
    const matches = await Photographer.find({ name: { $in: [...lookup.keys()] } });
    for (const person of matches) lookup.get(person.name)?.push(person);
    const recipients = [];
    for (const people of lookup.values()) {
        if (people.length === 1 && people[0].status !== 'Inactive' && people[0].email) recipients.push(people[0]);
    }
    return { recipients, unresolved: recipients.length !== lookup.size };
}

async function claimDailyReminder(event, photographer, tomorrow, expiresAt) {
    const id = `crew-reminder:${event._id}:${photographer._id}:${tomorrow.toISOString()}`;
    try {
        const result = await StudioOperationLease.updateOne(
            { _id: id },
            { $setOnInsert: { until: expiresAt, expiresAt } },
            { upsert: true, writeConcern: { w: 'majority' } },
        );
        return result.upsertedCount === 1;
    } catch (error) {
        if (error.code === 11000 && error.keyValue?._id === id) return false;
        throw error;
    }
}

let transporter = null;

const initCronJobs = () => {
    // Determine user and pass for nodemailer
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
        console.warn("EMAIL_USER or EMAIL_PASS not found in .env. Reminder Service will not be initialized.");
        return;
    }

    transporter = nodemailer.createTransport({
        service: 'gmail', // Assuming gmail
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });

    // Run at 08:00 on the legacy studio calendar.
    cron.schedule('0 8 * * *', async () => {
      await require('../saas/workers').forEachWorkspace(() => require('./studioArchiveGate').withShared(async () => {
        // Tenant mail needs its own approved sender; never reuse Team Alpha SMTP.
        if (require('../saas/tenantContext').currentWorkspace()) return;
        console.log("Running Daily Photographer Reminder Cron Job");
        // The legacy studio calendar uses India time, independent of server TZ.
        const today = studioDayStart();
        const tomorrow = new Date(today.getTime() + 86400000);
        const dayAfterTomorrow = new Date(tomorrow.getTime() + 86400000);

        // Find events starting tomorrow
        const events = await Event.find({
            start: {
                $gte: tomorrow,
                $lt: dayAfterTomorrow
            }
        });

        if (events.length === 0) {
            console.log("No events tomorrow to send reminders for.");
            return;
        }

        let failed = false;
        for (const event of events) {
            if (!event.teamMembers || event.teamMembers.length === 0) continue;

            const { recipients, unresolved } = await assignmentRecipients(event.teamMembers);
            if (unresolved) failed = true;
            for (const photographer of recipients) {
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: photographer.email,
                    subject: `Reminder: Upcoming Event "${event.title}" Tomorrow`,
                    html: `
                        <h2>Event Reminder</h2>
                        <p>Hi ${escapeHtml(photographer.name)},</p>
                        <p>This is a reminder that you are assigned to an event tomorrow.</p>
                        <ul>
                            <li><strong>Event:</strong> ${escapeHtml(event.title)}</li>
                            <li><strong>Start Time:</strong> ${formatTime(event.start)}</li>
                            <li><strong>End Time:</strong> ${formatTime(event.end)}</li>
                            <li><strong>Location:</strong> ${escapeHtml(event.location || 'TBD')}</li>
                            <li><strong>Type:</strong> ${escapeHtml(event.type)}</li>
                        </ul>
                        <p>Please ensure you arrive on time and are fully prepared.</p>
                        <br/>
                        <p>Best regards,<br/>Team Alpha Admin</p>
                    `
                };

                try {
                    // SMTP may accept a message before the connection fails. Keep
                    // the durable claim on failure and never replay that recipient.
                    if (!await claimDailyReminder(event, photographer, tomorrow, dayAfterTomorrow)) continue;
                    await transporter.sendMail(mailOptions);
                } catch {
                    failed = true;
                }
            }
        }
        if (failed) throw new Error('One or more crew reminder emails could not be sent.');
      }, { integrations: true }));
    }, { timezone: DEFAULT_STUDIO_TIMEZONE });

    console.log("Photographer Reminder Cron Job Initialized to run daily at 8:00 AM India time.");
};

const sendEventNotificationUnlocked = async (event, photographerNames) => {
    if (require('../saas/tenantContext').currentWorkspace()) return;
    if (!transporter) {
        console.warn("Transporter not initialized, skipping event notification emails.");
        return;
    }
    if (!photographerNames || photographerNames.length === 0) return;

    try {
        const { recipients, unresolved } = await assignmentRecipients(photographerNames);
        if (unresolved) console.warn('An assignment email could not be addressed to a unique active crew member.');
        for (const photographer of recipients) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: photographer.email,
                subject: `New Assignment: "${event.title}"`,
                html: `
                    <h2>You have a new assignment!</h2>
                    <p>Hi ${escapeHtml(photographer.name)},</p>
                    <p>You have been assigned to the following event:</p>
                    <ul>
                        <li><strong>Event:</strong> ${escapeHtml(event.title)}</li>
                        <li><strong>Start Time:</strong> ${formatTime(event.start)}</li>
                        <li><strong>End Time:</strong> ${formatTime(event.end)}</li>
                        <li><strong>Location:</strong> ${escapeHtml(event.location || 'TBD')}</li>
                        <li><strong>Type:</strong> ${escapeHtml(event.type)}</li>
                    </ul>
                    <p>Please check your admin dashboard for more details.</p>
                    <br/>
                    <p>Best regards,<br/>Team Alpha Admin</p>
                `
            };

            try {
                await transporter.sendMail(mailOptions);
            } catch {
                console.error('A crew assignment email could not be sent.');
            }
        }
    } catch {
        console.error("Crew assignment notification failed.");
    }
};

const sendEventNotification = (event, photographerNames) => {
    if (!transporter || require('../saas/tenantContext').currentWorkspace()) return Promise.resolve();
    return require('./studioArchiveGate').withShared(() => sendEventNotificationUnlocked(event, photographerNames), { integrations: true });
};
module.exports = { initCronJobs, sendEventNotification };
