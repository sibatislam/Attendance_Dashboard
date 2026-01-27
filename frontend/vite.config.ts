import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Listen on all addresses (required for Docker)
    strictPort: false, // Allow port fallback if 5173 is taken
    // Completely disable file watching and HMR
    watch: null,
    hmr: false, // Disable Hot Module Replacement completely
    fs: {
      strict: false,
    },
  },
  optimizeDeps: {
    exclude: [],
  },
  clearScreen: false,
  // Disable all automatic reloading
  build: {
    watch: null,
  },
})


