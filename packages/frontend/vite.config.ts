import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [react(), tailwindcss(), cesium()],
  server: {
    // strictPort makes a busy 5173 a loud failure instead of a silent move to
    // 5174 — which would break CORS, since ALLOWED_ORIGINS and FRONTEND_URL in
    // both Go services name port 5173 explicitly.
    port: Number(process.env.VITE_DEV_PORT ?? 5173),
    strictPort: true,
    host: process.env.VITE_DEV_HOST ?? 'localhost',
    // Docker Desktop's bind mounts don't forward inotify events on Windows or
    // macOS, so file edits are never noticed without polling. Polling costs CPU,
    // so only turn it on inside a container.
    watch: process.env.VITE_IN_DOCKER ? { usePolling: true, interval: 300 } : undefined,
  },
  // Vite's startup banner emits a clear-screen escape, which wipes the api and
  // auth logs out of the scrollback when all three run in one terminal.
  clearScreen: false,
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
})
