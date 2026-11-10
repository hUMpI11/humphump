import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// base './' => die App läuft unter jedem Pfad (z. B. GitHub Pages /repo-name/).
export default defineConfig({
  base: './',
  // Unit-Tests liegen neben dem Code; e2e/ gehört Playwright.
  test: { include: ['src/**/*.test.ts'] },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Baustellenbuch',
        short_name: 'Baustelle',
        description: 'Baustellenerfassung für Handwerker: Stunden, Material, Notizen, Fotos, Skizzen.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f2f2f7',
        theme_color: '#1f3a5f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
