import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // Recharts + d3 sub-dependencies (only loaded with AdminStats)
          if (/[/\\](recharts|d3-|victory-vendor|react-countup|countup\.js|internmap)[/\\]/.test(id)) {
            return 'vendor-recharts';
          }
          // Tiptap + ProseMirror (only loaded with ReportEditor)
          if (/[/\\](@tiptap|prosemirror)[/\\]/.test(id)) {
            return 'vendor-tiptap';
          }
          // Core React vendor (shared, always loaded)
          if (/[/\\](react-dom|react-router-dom|react-router|scheduler)[/\\]/.test(id)) {
            return 'vendor-react';
          }
        },
      },
    },
  },
})
