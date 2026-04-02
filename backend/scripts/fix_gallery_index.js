const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function fixIndex() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test');
        console.log('Connected to MongoDB');
        
        const collection = mongoose.connection.db.collection('drivegalleries');
        
        // List existing indexes
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));
        
        // Try to drop the problematic index
        try {
            await collection.dropIndex('driveFolderId_1');
            console.log('Successfully dropped driveFolderId_1 index');
        } catch (e) {
            console.log('Index driveFolderId_1 does not exist or already dropped');
        }
        
        console.log('Index cleanup complete. Mongoose will recreate it with sparse:true next time the app starts.');
        process.exit(0);
    } catch (err) {
        console.error('Error fixing index:', err);
        process.exit(1);
    }
}

fixIndex();
