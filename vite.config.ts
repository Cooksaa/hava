import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  /*
   * Putanja pod kojom app živi. Lokalno je "/", a na GitHub Pages je "/ime-repoa/".
   * Postavlja je workflow za objavu (varijabla BASE); ovdje se ime repoa ne pominje.
   */
  const putanja = loadEnv(mode, '.', '').BASE || '/';
  const baza = putanja.endsWith('/') ? putanja : `${putanja}/`;

  /*
   * "vite build --mode android": isti kod, ali za aplikaciju. Bez service workera:
   * u aplikaciji su fajlovi već na mobitelu, a stari keš bi samo smetao novoj verziji.
   */
  const android = mode === 'android';
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

  return {
    base: baza,
    define: {
      __VERSIJA__: JSON.stringify(version),
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    plugins: [
      !android &&
      VitePWA({
        // Nova verzija se preuzme u pozadini i važi od sljedećeg otvaranja. Bez pitanja i pop-upova.
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'ikona.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Hava',
          short_name: 'Hava',
          description: 'Prognoza za BiH koja odgovara na pitanje: mogu li ovo danas?',
          lang: 'bs',
          start_url: baza,
          scope: baza,
          display: 'standalone',
          orientation: 'portrait',
          // Boja dok se app otvara: noćno nebo, isto kao prvi kadar u index.html.
          background_color: '#0a1322',
          theme_color: '#0a1322',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Service worker čuva samo samu aplikaciju (kod, stilove, font, ikone).
          // Prognozu čuva api/cache.ts u localStorage, uz vrijeme kad je dohvaćena:
          // da je čuva i service worker, imali bismo dvije stare kopije koje se ne slažu.
          globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
