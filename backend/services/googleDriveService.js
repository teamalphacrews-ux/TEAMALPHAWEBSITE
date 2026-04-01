const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let driveClient = null;

const getDriveClient = () => {
    if (driveClient) return driveClient;

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
        console.warn('⚠️ Google Drive API credentials missing.');
        return null;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, '\n'),
            },
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/drive.metadata.readonly'
            ],
        });

        driveClient = google.drive({ version: 'v3', auth });
        return driveClient;
    } catch (err) {
        console.error('❌ Failed to initialize Google Drive Client:', err.message);
        return null;
    }
};

const GoogleDriveService = {
    /**
     * Uploads a file to Google Drive.
     * @param {Object} file - The file object from Multer.
     * @param {String} fileName - Desired file name.
     * @returns {Object} - Uploaded file metadata.
     */
    async uploadFile(file, fileName) {
        const drive = getDriveClient();
        if (!drive) throw new Error('Drive Client not initialized');

        try {
            const fileMetadata = {
                name: fileName || file.originalname,
            };

            const media = {
                mimeType: file.mimetype,
                body: fs.createReadStream(file.path),
            };

            const response = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, name, mimeType, createdTime, thumbnailLink, webViewLink, webContentLink',
            });

            // Make the file publicly accessible so thumbnails/previews work
            await drive.permissions.create({
                fileId: response.data.id,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });

            return response.data;
        } catch (error) {
            console.error('Google Drive Upload Error:', error.message);
            throw error;
        }
    },

    /**
     * Deletes a file from Google Drive.
     * @param {String} fileId - The ID of the file to delete.
     */
    async deleteFile(fileId) {
        const drive = getDriveClient();
        if (!drive) throw new Error('Drive Client not initialized');

        try {
            await drive.files.delete({ fileId });
        } catch (error) {
            console.error('Google Drive Delete Error:', error.message);
            throw error;
        }
    },

    /**
     * Extracts folder ID from a Drive link.
     */
    extractFolderId(link) {
        const regex = /[-\w]{25,}/;
        const match = link.match(regex);
        return match ? match[0] : null;
    },

    /**
     * Lists contents of a specific folder.
     */
    async getFolderContents(folderId) {
        const drive = getDriveClient();
        if (!drive) throw new Error('Drive Client not initialized');

        try {
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, mimeType, thumbnailLink, size, createdTime, webViewLink, webContentLink)',
                orderBy: 'folder,name'
            });

            return response.data.files;
        } catch (error) {
            console.error('Google Drive List Folder Error:', error.message);
            throw error;
        }
    },

    /**
     * Streams a file from Google Drive.
     */
    async getFileStream(fileId) {
        const drive = getDriveClient();
        if (!drive) throw new Error('Drive Client not initialized');

        try {
            const metadata = await drive.files.get({
                fileId: fileId,
                fields: 'id, name, mimeType, size'
            });

            const response = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            return {
                stream: response.data,
                mimeType: metadata.data.mimeType,
                size: metadata.data.size,
                name: metadata.data.name
            };
        } catch (error) {
            console.error('Google Drive Get File Stream Error:', error.message);
            throw error;
        }
    }
};

module.exports = GoogleDriveService;
