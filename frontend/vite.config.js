import { defineConfig, loadEnv } from "vite";
import express from "express";
import process from "node:process";
import { hostname } from "node:os";
import { createWebsiteRouter } from "./website-server.mjs";
import react from "@vitejs/plugin-react";
import { transformDeploymentHtml } from "./src/saas/releaseConfig.js";

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
    {
      name: "studio-deployment-identity",
      transformIndexHtml: html => transformDeploymentHtml(html, { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env }),
    },
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
        // Keep shared React helpers out of an optional animation vendor chunk.
        // Otherwise Rollup's automatic dependency merging can preload motion
        // even when the commercial route never imports it.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          // Match package files, not just entry points: the production JSX
          // runtime is a React submodule and must never live inside motion.
          if (/\/node_modules\/(?:react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "vendor-react";
          if (/\/node_modules\/(?:framer-motion|motion-dom|motion-utils)\//.test(id)) return "vendor-motion";
          if (id.includes("/node_modules/lucide-react/")) return "vendor-icons";
          if (id.includes("/node_modules/axios/")) return "vendor-http";
          if (id.includes("/node_modules/date-fns/")) return "vendor-dates";
          if (id.includes("/node_modules/socket.io-client/")) return "vendor-realtime";
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
