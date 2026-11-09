import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const name = env.VITE_BRAND_NAME || 'compandra.';
  return {
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    plugins: [
      { name: 'brand-html', transformIndexHtml: { order: 'pre', handler: (h: string) => h.replaceAll('%VITE_BRAND_NAME%', name).replaceAll('%VITE_BRAND_THEME_COLOR%', env.VITE_BRAND_THEME_COLOR || '#FBFAF6') } },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
        manifest: {
          name,
          short_name: name,
          description: 'Plan family events together, then use them while they happen.',
          theme_color: env.VITE_BRAND_THEME_COLOR || '#FBFAF6',
          background_color: '#FBFAF6',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // App shell only. API and storage responses are never put in the service-worker cache:
          // private data lives solely in the encrypted store (src/offline).
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/auth\/callback/],
          runtimeCaching: [],
        },
      }),
    ],
    test: { environment: 'node', testTimeout: 15000, exclude: ['node_modules', 'dist', 'tests/e2e/**'] },
  } as any;
});
