const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected Successfully: ${conn.connection.host}`);
    } catch (err) {
        console.error("MongoDB Connection Failed:", err.message);
        console.log("Tip: If you see ECONNREFUSED with srv, try using the standard 'mongodb://' connection string or check your local DNS/Firewall settings.");
        
        // Don't exit process in dev if we want the bypass to work
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

module.exports = connectDB;
