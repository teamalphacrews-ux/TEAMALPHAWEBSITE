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

async function check() {
    try {
        const res2025 = await sheets.spreadsheets.values.get({ spreadsheetId, range: '2025!A:L' });
        console.log('2025 rows:', res2025.data.values ? res2025.data.values.length : 0);
        
        const resJan = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'JAN!A:L' });
        console.log('JAN rows:', resJan.data.values ? resJan.data.values.length : 0);
    } catch (e) { console.error(e) }
}
check();
