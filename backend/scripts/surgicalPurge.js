const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Event = require('../models/Event');
const connectDB = require('../config/db');

async function surgicalPurge() {
    try {
        await connectDB();
        const result = await Event.deleteMany({ title: /Happy birthday!/i });
        console.log(`🧹 Successfully purged ${result.deletedCount} 'Happy birthday!' duplicates.`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Purge Failed:", err.message);
        process.exit(1);
    }
}

surgicalPurge();
