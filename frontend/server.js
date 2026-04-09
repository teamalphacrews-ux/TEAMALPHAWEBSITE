import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files from the 'dist' directory
// (Make sure to run 'npm run build' first)
app.use(express.static(path.join(__dirname, 'dist')));

// IMPORTANT: Handle React's client-side routing (SPA)
// This ensures that refreshing the page on mobile doesn't cause a 404
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('--------------------------------------------------');
    console.log(`🚀 Frontend Web Service live on port ${PORT}`);
    console.log(`📡 Serving artifacts from: ${path.join(__dirname, 'dist')}`);
    console.log('--------------------------------------------------');
});
