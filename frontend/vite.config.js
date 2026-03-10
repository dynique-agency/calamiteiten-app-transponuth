import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import { VitePWA }      from 'vite-plugin-pwa';

// Basis-URL van de backend API.
// Lokaal: dev-proxy op localhost:3001. Render-build: productie-URL via env-var.
const BACKEND_URL = process.env.VITE_API_URL
  || (process.env.NODE_ENV === 'production'
    ? 'https://calamiteiten-backend.onrender.com'
    : 'http://localhost:3001');

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // 'autoUpdate': automatisch bijwerken zodra er een nieuwe service worker is
      registerType: 'autoUpdate',

      // Workbox-instellingen voor offline caching
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // Runtime-caching: API-aanvragen → NetworkFirst strategie
        // (probeert netwerk, valt terug op cache indien offline)
        runtimeCaching: [
          {
            urlPattern: new RegExp(`^${BACKEND_URL}/api/`),
            handler:    'NetworkFirst',
            options: {
              cacheName:        'api-cache',
              expiration:       { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Statische uploads (foto's) altijd cachen
            urlPattern: new RegExp(`^${BACKEND_URL}/uploads/`),
            handler:    'CacheFirst',
            options: {
              cacheName:  'uploads-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },

      // Web App Manifest — zorgt voor "Voeg toe aan beginscherm" op Android
      manifest: {
        name:             'Calamiteiten App — Transpo-Nuth',
        short_name:       'CalamApp',
        description:      'Calamiteiten registratie voor de buitendienst van Transpo-Nuth',
        theme_color:      '#0A0F1E',
        background_color: '#0A0F1E',
        display:          'standalone',
        orientation:      'portrait',
        start_url:        '/',
        lang:             'nl',
        categories:       ['business', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png',  sizes: '192x192',  type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png',  sizes: '512x512',  type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name:      'Nieuwe Calamiteit',
            short_name:'Nieuw',
            url:       '/wizard',
            icons:     [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },

      // Bestanden die altijd vooraf gecached worden (app-shell)
      includeAssets: ['icons/*.png', 'fonts/*.woff2'],
    }),
  ],

  // Dev-server proxy: doorsturen van /api-verzoeken naar de Express-backend
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:      BACKEND_URL,
        changeOrigin: true,
        secure:       false,
      },
      '/uploads': {
        target:      BACKEND_URL,
        changeOrigin: true,
      },
    },
  },

  // Aliassen voor schone imports
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
