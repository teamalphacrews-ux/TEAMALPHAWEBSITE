const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Event = require('../models/Event');
const connectDB = require('../config/db');

async function inspect() {
    try {
        await connectDB();
        const events = await Event.find({}).sort({ start: 1 });
        console.log("--- START DATABASE DUMP ---");
        events.forEach(e => {
            console.log(`[${e._id}] Title: "${e.title}" | Start: ${e.start.toISOString()} | User: ${e.userId} | SyncID: ${e.googleEventId || 'None'}`);
        });
        console.log("--- END DATABASE DUMP ---");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
