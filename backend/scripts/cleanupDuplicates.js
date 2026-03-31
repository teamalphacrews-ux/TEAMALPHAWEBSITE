const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Event = require('../models/Event');
const connectDB = require('../config/db');

async function cleanup() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI not found in environment. Check .env file path.");
        }
        await connectDB();
        console.log("📂 Connected for cleanup...");

        // Find all synced events (or all events in general to be safe)
        const events = await Event.find({});
        console.log(`🔍 Total events analyzed: ${events.length}`);

        const groups = {};
        events.forEach(e => {
            // Group by Title + Start Date + UserID to catch clones with different IDs
            const key = `${e.title}_${new Date(e.start).getTime()}_${e.userId}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(e);
        });

        let deletedCount = 0;
        for (const key in groups) {
            const list = groups[key];
            if (list.length > 1) {
                // Keep the one with the latest updatedAt or the one that's synced
                list.sort((a, b) => {
                    // Prioritize synced events over local ones if titles match
                    if (a.googleEventId && !b.googleEventId) return -1;
                    if (!a.googleEventId && b.googleEventId) return 1;
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                });
                const keep = list[0];
                const toDelete = list.slice(1);

                for (const item of toDelete) {
                    await Event.findByIdAndDelete(item._id);
                    deletedCount++;
                }
                console.log(`✅ Purged ${toDelete.length} clones of: ${keep.title} (${new Date(keep.start).toDateString()})`);
            }
        }

        console.log(`\n✨ Cleanup Complete!`);
        console.log(`🧹 Total duplicates purged: ${deletedCount}`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Cleanup failed:", err.message);
        process.exit(1);
    }
}

cleanup();
