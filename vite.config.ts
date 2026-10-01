import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg'],
    manifest: {
      name: 'PrepTrack', short_name: 'PrepTrack', description: 'A calm, focused space to track your preparation.',
      theme_color: '#f7f8fc', background_color: '#f7f8fc', display: 'standalone', start_url: base,
      icons: [
        { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
  })],
});
