import { defineConfig, loadEnv } from "vite";
import express from "express";
import process from "node:process";
import { hostname } from "node:os";
import { createWebsiteRouter } from "./website-server.mjs";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
function websiteGateway(env) {
  const mount = (server) => {
    const gateway = express();
    gateway.use("/api/website", createWebsiteRouter({ env }));
    server.middlewares.use(gateway);
  };
  return {
    name: "team-alpha-website-gateway",
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

export default defineConfig(({ mode }) => ({
  // Unprefixed environment values stay in the Node server and are never defined in client code.
  plugins: [
    react(),
    websiteGateway({ ...loadEnv(mode, process.cwd(), ""), ...process.env }),
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5000",
      "/socket.io": { target: "http://127.0.0.1:5000", ws: true },
    },
    allowedHosts: ["team-alpha-d64k.onrender.com", hostname().toLowerCase()],
    watch: {
      usePolling: true,
    },
  },
  preview: {
    allowedHosts: ["team-alpha-d64k.onrender.com"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-icons": ["lucide-react"],
          "vendor-http": ["axios"],
          "vendor-dates": ["date-fns"],
          "vendor-realtime": ["socket.io-client"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
