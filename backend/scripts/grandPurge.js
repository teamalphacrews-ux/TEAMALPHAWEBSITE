const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Event = require('../models/Event');
const connectDB = require('../config/db');

async function grandPurge() {
    try {
        await connectDB();
        console.log("📂 Connected for Grand Purge...");

        const result = await Event.deleteMany({
            $or: [
                { title: /birthday/i },
                { googleEventType: 'birthday' }
            ]
        });

        console.log(`✨ Grand Purge Complete!`);
        console.log(`🧹 Deleted ${result.deletedCount} birthday entries across all years.`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Grand Purge failed:", err.message);
        process.exit(1);
    }
}

grandPurge();
