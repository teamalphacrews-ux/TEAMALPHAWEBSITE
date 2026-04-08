import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const getHeaders = (sheetName = '') => {
    const sheetId = localStorage.getItem('google_sheet_id');
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        'x-sheet-id': sheetId || '',
        'Authorization': `Bearer ${token}`
    };
    if (sheetName) {
        headers['x-sheet-name'] = sheetName;
    }
    return headers;
};

export const getSheetData = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/google-sheets`, {
            headers: getHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        return { headers: [], rows: [] };
    }
};

export const updateCell = async (rowId, colIndex, value, sheetName) => {
    try {
        const response = await axios.put(`${API_URL}/api/google-sheets/cell`, {
            rowId,
            colIndex,
            value
        }, {
            headers: getHeaders(sheetName)
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error updating cell:', error);
        return { success: false, error };
    }
};

export const batchUpdateCells = async (updates, sheetName) => {
    try {
        const response = await axios.put(`${API_URL}/api/google-sheets/batch-update`, {
            updates
        }, {
            headers: getHeaders(sheetName)
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error batch updating cells:', error);
        return { success: false, error };
    }
};

export const addRow = async (values, sheetName) => {
    try {
        const response = await axios.post(`${API_URL}/api/google-sheets/row`, {
            values
        }, {
            headers: getHeaders(sheetName)
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error adding row:', error);
        return { success: false, error };
    }
};

export const addColumn = async (headerName, sheetName) => {
    try {
        const response = await axios.post(`${API_URL}/api/google-sheets/column`, {
            headerName
        }, {
            headers: getHeaders(sheetName)
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error adding column:', error);
        return { success: false, error };
    }
};

export const deleteRow = async (rowId, sheetName) => {
    try {
        const response = await axios.delete(`${API_URL}/api/google-sheets/row/${rowId}`, {
            headers: getHeaders(sheetName)
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error deleting row:', error.message);
        return { success: false, error };
    }
};

export const deleteColumn = async (colIndex, sheetName) => {
    try {
        const response = await axios.delete(`${API_URL}/api/google-sheets/column/${colIndex}`, {
            headers: getHeaders(sheetName)
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error deleting column:', error.message);
        return { success: false, error };
    }
};

export const getDropdownConfig = async () => {
    try {
        const response = await axios.get(`${API_URL}/api/google-sheets/config/dropdowns`, {
            headers: getHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching dropdown config:', error.message);
        return [];
    }
};

export const updateDropdownConfig = async (type, options) => {
    try {
        const response = await axios.post(`${API_URL}/api/google-sheets/config/dropdowns`, {
            type, options
        }, {
            headers: getHeaders()
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error updating dropdown config:', error.message);
        return { success: false, error };
    }
};
