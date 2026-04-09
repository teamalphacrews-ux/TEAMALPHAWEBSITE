import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Safety check: ensure 'dist' exists
const distPath = path.join(__dirname, 'dist');
import fs from 'fs';

if (!fs.existsSync(distPath)) {
    console.error(`❌ ERROR: 'dist' folder not found at ${distPath}`);
    console.error("👉 Make sure to run 'npm run build' before starting the server.");
    // In production, we want to stay alive to show logs, but we can't serve anything
}

// Serve static files from the 'dist' directory
app.use(express.static(distPath));

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
