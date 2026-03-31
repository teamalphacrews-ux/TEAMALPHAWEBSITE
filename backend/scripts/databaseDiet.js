const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Event = require('../models/Event');
const connectDB = require('../config/db');

async function diet() {
    try {
        await connectDB();
        
        // Define a cutoff: anything more than 2 years from today
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() + 2);
        
        console.log(`🧼 Purging events beyond ${cutoff.toDateString()} (Database Diet)...`);
        
        // Remove only "isReadOnly" (Google System) events that are way in the future
        const result = await Event.deleteMany({
            start: { $gt: cutoff },
            isReadOnly: true
        });
        
        console.log(`✨ Success! Deleted ${result.deletedCount} future-echo birthdays.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

diet();
