const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Event = require('../models/Event');
const Photographer = require('../models/Photographer');

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

    // Schedule task to run everyday at 8:00 AM server time
    cron.schedule('0 8 * * *', async () => {
        try {
            console.log("Running Daily Photographer Reminder Cron Job");
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

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

            for (const event of events) {
                if (!event.teamMembers || event.teamMembers.length === 0) continue;

                // Find photographers matching assigned team members
                const photographers = await Photographer.find({
                    name: { $in: event.teamMembers }
                });

                for (const photographer of photographers) {
                    if (photographer.email) {
                        const mailOptions = {
                            from: process.env.EMAIL_USER,
                            to: photographer.email,
                            subject: `Reminder: Upcoming Event "${event.title}" Tomorrow`,
                            html: `
                                <h2>Event Reminder</h2>
                                <p>Hi ${photographer.name},</p>
                                <p>This is a reminder that you are assigned to an event tomorrow.</p>
                                <ul>
                                    <li><strong>Event:</strong> ${event.title}</li>
                                    <li><strong>Start Time:</strong> ${new Date(event.start).toLocaleString()}</li>
                                    <li><strong>End Time:</strong> ${new Date(event.end).toLocaleString()}</li>
                                    <li><strong>Location:</strong> ${event.location || 'TBD'}</li>
                                    <li><strong>Type:</strong> ${event.type}</li>
                                </ul>
                                <p>Please ensure you arrive on time and are fully prepared.</p>
                                <br/>
                                <p>Best regards,<br/>Team Alpha Admin</p>
                            `
                        };

                        try {
                            await transporter.sendMail(mailOptions);
                            console.log(`Reminder email sent successfully to ${photographer.email} for event ${event.title}`);
                        } catch (mailError) {
                            console.error(`Failed to send email to ${photographer.email}:`, mailError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error running photographer reminder cron job:", error);
        }
    });

    console.log("Photographer Reminder Cron Job Initialized to run daily at 8:00 AM.");
};

const sendEventNotification = async (event, photographerNames) => {
    if (!transporter) {
        console.warn("Transporter not initialized, skipping event notification emails.");
        return;
    }
    if (!photographerNames || photographerNames.length === 0) return;

    try {
        const photographers = await Photographer.find({
            name: { $in: photographerNames }
        });

        for (const photographer of photographers) {
            if (photographer.email) {
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: photographer.email,
                    subject: `New Assignment: "${event.title}"`,
                    html: `
                        <h2>You have a new assignment!</h2>
                        <p>Hi ${photographer.name},</p>
                        <p>You have been assigned to the following event:</p>
                        <ul>
                            <li><strong>Event:</strong> ${event.title}</li>
                            <li><strong>Start Time:</strong> ${new Date(event.start).toLocaleString()}</li>
                            <li><strong>End Time:</strong> ${new Date(event.end).toLocaleString()}</li>
                            <li><strong>Location:</strong> ${event.location || 'TBD'}</li>
                            <li><strong>Type:</strong> ${event.type}</li>
                        </ul>
                        <p>Please check your admin dashboard for more details.</p>
                        <br/>
                        <p>Best regards,<br/>Team Alpha Admin</p>
                    `
                };

                try {
                    await transporter.sendMail(mailOptions);
                    console.log(`Real-time assignment email sent to ${photographer.email} for event ${event.title}`);
                } catch (err) {
                    console.error(`Failed to send real-time email to ${photographer.email}:`, err);
                }
            }
        }
    } catch (error) {
        console.error("Error sending real time notification:", error);
    }
};

module.exports = { initCronJobs, sendEventNotification };
