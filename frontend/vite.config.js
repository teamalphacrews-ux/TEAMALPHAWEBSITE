import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/socket.io': { target: 'http://127.0.0.1:5000', ws: true },
    },
    allowedHosts: ["team-alpha-d64k.onrender.com"],
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
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['axios', 'date-fns', 'socket.io-client'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
})
