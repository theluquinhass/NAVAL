import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // No Docker, API_PROXY_TARGET aponta para o container da API (http://api:3000).
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Playwright specs run with `npm run test:e2e`, not Vitest.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
