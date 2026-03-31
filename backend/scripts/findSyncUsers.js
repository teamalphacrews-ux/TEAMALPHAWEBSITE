const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');
const connectDB = require('../config/db');

async function findSyncUsers() {
    try {
        await connectDB();
        const users = await User.find({ googleRefreshToken: { $exists: true } });
        console.log("--- SYNC USERS FOUND ---");
        users.forEach(u => {
            console.log(`ID: ${u._id} | Email: ${u.email} | GoogleEmail: ${u.googleEmail || 'None'}`);
        });
        console.log("--- END ---");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findSyncUsers();
