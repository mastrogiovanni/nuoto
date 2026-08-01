import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    allowedHosts: ['*', 'mastrogiovanni.ddns.net'],
    proxy: {
      '/api': { target: 'http://localhost:8090', changeOrigin: true },
      '/health': { target: 'http://localhost:8090', changeOrigin: true },
    },
  },
  plugins: [react()],
})
