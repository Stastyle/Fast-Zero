/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Fast-Zero/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt': the new service worker waits until the user opts in via the
      // update toast (registerSW's onNeedRefresh + updateSW(true)). With
      // 'autoUpdate' the plugin injects skipWaiting/clientsClaim, so
      // onNeedRefresh never fires and builds swap with no user signal.
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,woff2}'],
      },
      includeAssets: ['schematic-target.svg', 'icons/*.png', 'sights/*.jpg'],
      manifest: {
        id: '/Fast-Zero/',
        name: 'איפוס מהיר',
        short_name: 'איפוס',
        description: 'עוזר איפוס נשק על איפוסון 25 מטר',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#111111',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Relative to the manifest URL (/Fast-Zero/manifest.webmanifest), so this
        // resolves to /Fast-Zero/#/profiles — inside the app scope (hash router).
        shortcuts: [
          {
            name: 'איפוס חדש',
            url: './#/profiles',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
