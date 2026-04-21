import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    allowedHosts: ['*', 'mastrogiovanni.ddns.net'],
    proxy: {
      '/api': { target: 'http://localhost:8090', changeOrigin: true },
      '/health': { target: 'http://localhost:8090', changeOrigin: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Nuoto - Risultati Nuotatori',
        short_name: 'Nuoto',
        description: 'Visualizza i tuoi tempi, record e confrontati con altri nuotatori',
        theme_color: '#0077b6',
        background_color: '#03045e',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Never route auth/API navigations to index.html.
        // OAuth endpoints must always reach the backend.
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
      },
    }),
  ],
})
