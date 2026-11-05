import express from "express";
import process from "node:process";
import { createWebsiteRouter } from "./website-server.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Safety check: ensure 'dist' exists
const distPath = path.join(__dirname, "dist");
import fs from "fs";

if (!fs.existsSync(distPath)) {
  console.error(`❌ ERROR: 'dist' folder not found at ${distPath}`);
  console.error(
    "👉 Make sure to run 'npm run build' before starting the server.",
  );
  // In production, we want to stay alive to show logs, but we can't serve anything
}

// Visitor requests use the existing CRM webhook through this server boundary.
app.use("/api/website", createWebsiteRouter());

// Serve static files from the 'dist' directory
app.use(
  express.static(distPath, {
    setHeaders(res, file) {
      const name = path.basename(file);
      if (/\.(js|css)$/.test(name) && /-[\w-]{8,}\./.test(name))
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      else if (/\.(webp|avif|jpe?g|png|svg|woff2?)$/i.test(name))
        res.setHeader(
          "Cache-Control",
          "public, max-age=3600, stale-while-revalidate=86400",
        );
    },
  }),
);

// IMPORTANT: Handle React's client-side routing (SPA)
// This ensures that refreshing the page on mobile doesn't cause a 404
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("--------------------------------------------------");
  console.log(`🚀 Frontend Web Service live on port ${PORT}`);
  console.log(`📡 Serving artifacts from: ${path.join(__dirname, "dist")}`);
  console.log("--------------------------------------------------");
});
