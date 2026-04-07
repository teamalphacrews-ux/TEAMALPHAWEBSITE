const { google } = require('googleapis');
require('dotenv').config();

// DNS fix for Node >= 17 on some systems where IPv6 hangs
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

let sheetsClient = null;

const getSheetsClient = () => {
    if (sheetsClient) return sheetsClient;

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
        console.warn('⚠️ Google Sheets API credentials missing.');
        return null;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        sheetsClient = google.sheets({ version: 'v4', auth });
        return sheetsClient;
    } catch (err) {
        console.error('❌ Failed to initialize Google Sheets Client:', err.message);
        return null;
    }
};

const GoogleSheetsService = {
    getColLetter(index) {
        let letter = "";
        while (index >= 0) {
            letter = String.fromCharCode((index % 26) + 65) + letter;
            index = Math.floor(index / 26) - 1;
        }
        return letter;
    },

    async getTargetSheetName(spreadsheetId) {
        const sheets = getSheetsClient();
        if (!sheets) throw new Error('Sheets Client not initialized');

        try {
            const cleanId = typeof spreadsheetId === 'string' ? spreadsheetId.trim() : spreadsheetId;
            if (!cleanId) throw new Error('Spreadsheet ID is missing');
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: cleanId });
            const sheetsList = spreadsheet.data.sheets;
            if (!sheetsList || sheetsList.length === 0) return 'Sheet1';
            
            const target = sheetsList.find(s => s.properties.title === '2025') || sheetsList[0];
            return target.properties.title;
        } catch (error) {
            // Silently handle sheet metadata fetch error
            return 'Sheet1'; 
        }
    },

    async getTasks(spreadsheetId) {
        const sheets = getSheetsClient();
        if (!sheets) {
            console.error("Sheets client not initialized");
            return { headers: [], rows: [] };
        }
        
        const finalId = (spreadsheetId || process.env.GOOGLE_SHEET_ID || '').trim();
        if (!finalId) {
            console.error("❌ No Spreadsheet ID provided (header or .env)");
            return { headers: [], rows: [], error: 'Spreadsheet ID missing' };
        }

        try {
            const sheetName = await this.getTargetSheetName(finalId);
            
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: finalId,
                range: `${sheetName}!A:ZZ`,
            });
            
            const rows = response.data.values;
            if (!rows || rows.length === 0) return { headers: [], rows: [] };

            const headers = rows[0] || [];
            const dataRows = rows.slice(1).map((row, index) => ({
                rowId: index + 2, 
                values: headers.map((_, colIdx) => row[colIdx] || '')
            }));

            return { headers, rows: dataRows, sheetName };
        } catch (error) {
            console.error('Google Sheets Fetch Error:', error.message);
            throw error;
        }
    },

    async updateCell(spreadsheetId, rowId, colIndex, value, preferredSheetName) {
        const sheets = getSheetsClient();
        if (!sheets) return { success: false };

        const finalId = (spreadsheetId || process.env.GOOGLE_SHEET_ID || '').trim();
        const sheetName = preferredSheetName || await this.getTargetSheetName(finalId);
        const colLetter = this.getColLetter(colIndex);
        const range = `${sheetName}!${colLetter}${rowId}`;

        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId: finalId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[value]] },
            });
            return { success: true, sheetName };
        } catch (error) {
            console.error('Google Sheets Update Cell Error:', error.message);
            throw error;
        }
    },

    async updateCellsBatch(spreadsheetId, updates = [], preferredSheetName) {
        const sheets = getSheetsClient();
        if (!sheets) return { success: false };

        const finalId = (spreadsheetId || process.env.GOOGLE_SHEET_ID || '').trim();
        const sheetName = preferredSheetName || await this.getTargetSheetName(finalId);

        const data = updates.map(u => ({
            range: `${sheetName}!${this.getColLetter(u.colIndex)}${u.rowId}`,
            values: [[u.value]]
        }));

        try {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: finalId,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data
                }
            });
            return { success: true, sheetName };
        } catch (error) {
            console.error('Google Sheets Batch Update Error:', error.message);
            throw error;
        }
    },

    async addRow(spreadsheetId, values = [], preferredSheetName) {
        const sheets = getSheetsClient();
        if (!sheets) return { success: false };

        const finalId = (spreadsheetId || process.env.GOOGLE_SHEET_ID || '').trim();
        const sheetName = preferredSheetName || await this.getTargetSheetName(finalId);

        try {
            // Force spaces instead of empty strings so Google Sheets doesn't ignore the empty append
            const safeValues = values.map(v => v === "" ? " " : v);

            await sheets.spreadsheets.values.append({
                spreadsheetId: finalId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                requestBody: { values: [safeValues] },
            });
            return { success: true, sheetName };
        } catch (error) {
            console.error('Google Sheets Add Row Error:', error.message);
            throw error;
        }
    },

    async addColumn(spreadsheetId, headerName, preferredSheetName) {
        const sheets = getSheetsClient();
        if (!sheets) return { success: false };

        const finalId = (spreadsheetId || process.env.GOOGLE_SHEET_ID || '').trim();
        try {
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: finalId });
            const sheetName = preferredSheetName || await this.getTargetSheetName(finalId);
            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
            const sheetId = sheet.properties.sheetId;

            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: finalId,
                range: `${sheetName}!1:1`,
            });
            const headers = res.data.values?.[0] || [];
            const nextColIndex = headers.length;

            // 1. Insert a new column dimension to inherit formatting (bold, background color) from the left
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: finalId,
                requestBody: {
                    requests: [
                        {
                            insertDimension: {
                                range: {
                                    sheetId: sheetId,
                                    dimension: 'COLUMNS',
                                    startIndex: nextColIndex,
                                    endIndex: nextColIndex + 1
                                },
                                inheritFromBefore: true
                            }
                        }
                    ]
                }
            });

            // 2. Set the header text
            const colLetter = this.getColLetter(nextColIndex);
            await sheets.spreadsheets.values.update({
                spreadsheetId: finalId,
                range: `${sheetName}!${colLetter}1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[headerName]] },
            });
            return { success: true, sheetName };
        } catch (error) {
            console.error('Google Sheets Add Column Error:', error.message);
            throw error;
        }
    },

    async deleteRow(spreadsheetId, rowId, preferredSheetName) {
        const sheets = getSheetsClient();
        if (!sheets) return { success: false };

        const finalId = (spreadsheetId || process.env.GOOGLE_SHEET_ID || '').trim();
        
        try {
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: finalId });
            const sheetName = preferredSheetName || await this.getTargetSheetName(finalId);
            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
            const sheetId = sheet.properties.sheetId;

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: finalId,
                requestBody: {
                    requests: [
                        {
                            deleteDimension: {
                                range: {
                                    sheetId,
                                    dimension: 'ROWS',
                                    startIndex: rowId - 1,
                                    endIndex: rowId
                                }
                            }
                        }
                    ]
                }
            });
            return { success: true, sheetName };
        } catch (error) {
            console.error('Google Sheets Delete Row Error:', error.message);
            throw error;
        }
    },

    async deleteColumn(spreadsheetId, colIndex, preferredSheetName) {
        const sheets = getSheetsClient();
        if (!sheets) return { success: false };

        const finalId = (spreadsheetId || process.env.GOOGLE_SHEET_ID || '').trim();
        
        try {
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: finalId });
            const sheetName = preferredSheetName || await this.getTargetSheetName(finalId);
            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
            const sheetId = sheet.properties.sheetId;

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: finalId,
                requestBody: {
                    requests: [
                        {
                            deleteDimension: {
                                range: {
                                    sheetId,
                                    dimension: 'COLUMNS',
                                    startIndex: colIndex,
                                    endIndex: colIndex + 1
                                }
                            }
                        }
                    ]
                }
            });
            return { success: true, sheetName };
        } catch (error) {
            console.error('Google Sheets Delete Column Error:', error.message);
            throw error;
        }
    }
};

module.exports = GoogleSheetsService;
