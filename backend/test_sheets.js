const GoogleSheetsService = require('./services/GoogleSheetsService');

async function test() {
    console.log("Starting Google Sheets Test...");
    try {
        const data = await GoogleSheetsService.getTasks();
        console.log("Success! Headers length:", data.headers.length);
        console.log("Success! Rows length:", data.rows.length);
    } catch (err) {
        console.error("Error connecting to Google Sheets:", err.message);
    }
    console.log("Test Completed.");
    process.exit(0);
}

test();
