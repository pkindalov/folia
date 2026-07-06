/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on all interfaces so phones on the LAN can open the app
    host: true,
    // Forward same-origin /api calls to the backend, so devices on the
    // LAN never need to reach the backend (or fight CORS) directly
    proxy: {
      '/api': 'http://localhost:1337',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: false,
  },
})
