const { CloudinaryStorage } = require('./storage/cloudinaryStorage');
const cloudinary = require('cloudinary').v2;

console.log('CloudinaryStorage Type:', typeof CloudinaryStorage);
try {
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'test',
        }
    });
    console.log('Storage created successfully');
} catch (err) {
    console.error('Error creating storage:', err);
}
