import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Force cache invalidation with new version
        cacheId: 'playlist-party-v2',
        
        // Exclude auth and API routes from service worker interception
        navigateFallbackDenylist: [
          /^\/api\/.*/,      // Don't intercept /api/* routes
        ],
        
        // Force network-only for API and auth routes
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/xn--iguagu-vebd\.lv\/api\/.*/,
            handler: 'NetworkOnly', // Always go to network, never cache
          }
        ],
      },
      manifest: {
        name: 'Playlist Party',
        short_name: 'PlaylistParty',
        description: 'Get to know your friends better throughmusic.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b1120',
        theme_color: '#0ea5e9',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: '127.0.0.1',
    port: 5173
  }
})