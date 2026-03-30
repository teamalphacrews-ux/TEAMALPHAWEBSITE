const express = require('express');
const router = express.Router();
const GoogleSheetsService = require('../services/GoogleSheetsService');

// Middleware to extract sheet ID and Name from headers
const getSheetContext = (req) => ({
    spreadsheetId: (req.headers['x-sheet-id'] || process.env.GOOGLE_SHEET_ID || '').trim(),
    preferredSheetName: req.headers['x-sheet-name'] || null
});

router.get('/', async (req, res) => {
    try {
        const { spreadsheetId } = getSheetContext(req);
        const data = await GoogleSheetsService.getTasks(spreadsheetId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/cell', async (req, res) => {
    const { rowId, colIndex, value } = req.body;
    const { spreadsheetId, preferredSheetName } = getSheetContext(req);
    try {
        const result = await GoogleSheetsService.updateCell(spreadsheetId, rowId, colIndex, value, preferredSheetName);
        
        if (req.io) {
            req.io.emit('sheet_cell_updated', { rowId, colIndex, value });
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/row', async (req, res) => {
    const { values } = req.body;
    const { spreadsheetId, preferredSheetName } = getSheetContext(req);
    try {
        const result = await GoogleSheetsService.addRow(spreadsheetId, values, preferredSheetName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/column', async (req, res) => {
    const { headerName } = req.body;
    const { spreadsheetId, preferredSheetName } = getSheetContext(req);
    try {
        const result = await GoogleSheetsService.addColumn(spreadsheetId, headerName, preferredSheetName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/row/:rowId', async (req, res) => {
    const { rowId } = req.params;
    const { spreadsheetId, preferredSheetName } = getSheetContext(req);
    try {
        const result = await GoogleSheetsService.deleteRow(spreadsheetId, parseInt(rowId), preferredSheetName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
