const { google } = require('googleapis');
require('dotenv').config();

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
}).then(res => {
    console.log(res.data.sheets.map(s => s.properties.title));
}).catch(console.error);
