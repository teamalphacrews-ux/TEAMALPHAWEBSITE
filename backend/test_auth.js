const { google } = require('googleapis');
require('dotenv').config();

async function checkAuth() {
    console.log("Checking Auth...");
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    console.log("Email:", clientEmail);
    console.log("Key format correct?", privateKey && privateKey.includes('BEGIN PRIVATE KEY'));

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        console.log("Client acquired!", client != null);

        const token = await client.getAccessToken();
        console.log("Token acquired!", !!token);

    } catch (err) {
        console.error("Auth error:", err);
    }
    console.log("Check complete.");
    process.exit(0);
}

checkAuth();
