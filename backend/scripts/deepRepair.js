const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Event = require('../models/Event');
const connectDB = require('../config/db');

async function repair() {
    try {
        await connectDB();
        console.log("📂 Connected for deep repair...");

        // 1. Tag all "Happy birthday!" events as Read-Only
        const tagResult = await Event.updateMany(
            { title: /Happy birthday/i },
            { isReadOnly: true, googleEventType: 'birthday' }
        );
        console.log(`🏷️ Tagged ${tagResult.modifiedCount} events as Protected/Read-Only.`);

        // 2. Deep Deduplication (By Title + Date-only)
        const events = await Event.find({});
        const groups = {};
        
        events.forEach(e => {
            const dateStr = new Date(e.start).toISOString().split('T')[0]; // YYYY-MM-DD
            const key = `${e.title.trim().toLowerCase()}_${dateStr}_${e.userId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(e);
        });

        let purgedCount = 0;
        for (const key in groups) {
            const list = groups[key];
            if (list.length > 1) {
                // Keep the one with the SyncID if available, else latest update
                list.sort((a, b) => {
                    if (a.googleEventId && !b.googleEventId) return -1;
                    if (!a.googleEventId && b.googleEventId) return 1;
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                });

                const keep = list[0];
                const toPurge = list.slice(1);

                for (const item of toPurge) {
                    await Event.findByIdAndDelete(item._id);
                    purgedCount++;
                }
                console.log(`✅ Purged ${toPurge.length} clones of: ${keep.title} on ${new Date(keep.start).toDateString()}`);
            }
        }

        console.log(`\n✨ Deep Repair Complete!`);
        console.log(`🧹 Total Clones Deleted: ${purgedCount}`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Repair failed:", err.message);
        process.exit(1);
    }
}

repair();
