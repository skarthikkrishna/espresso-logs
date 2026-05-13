import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { randomBytes } from 'node:crypto'

export default defineConfig({
  plugins: [react()],
  base: '/static/spa/',
  define: {
    __BUILD_HASH__: JSON.stringify(randomBytes(4).toString('hex')),
  },
  build: {
    outDir: '../app/static/spa',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  // Vite 8 inherits server.proxy in preview mode, which would forward
  // /static/spa/* to uvicorn — breaking E2E tests. Explicit preview config
  // keeps /api and /auth proxied (for seed.ts) but lets Vite serve its own
  // built assets directly.
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
