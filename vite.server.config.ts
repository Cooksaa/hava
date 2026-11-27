import { mkdirSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/*
 * Hava server (server/pitaj.ts) za Vercel, kao gotov izlaz (Build Output API v3):
 * jedan spakovan fajl, pa Vercel ne prevodi naše TS importe bez ekstenzija.
 *   npm run server  →  .vercel/output/
 */
const IZLAZ = '.vercel/output';
const FUNKCIJA = `${IZLAZ}/functions/api/pitaj.func`;

function vercelIzlaz(): Plugin {
  return {
    name: 'hava-vercel-izlaz',
    closeBundle() {
      writeFileSync(
        `${FUNKCIJA}/.vc-config.json`,
        JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 15, regions: ['fra1'] }, null, 2),
      );
      writeFileSync(`${FUNKCIJA}/package.json`, '{ "type": "module" }\n');
      mkdirSync(`${IZLAZ}/static`, { recursive: true });
      writeFileSync(`${IZLAZ}/static/robots.txt`, 'User-agent: *\nDisallow: /\n');
      writeFileSync(
        `${IZLAZ}/config.json`,
        JSON.stringify(
          {
            version: 3,
            routes: [
              { src: '^/$', status: 307, headers: { Location: 'https://alemcoksa.com/aplikacije/' } },
              { handle: 'filesystem' },
            ],
          },
          null,
          2,
        ),
      );
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [vercelIzlaz()],
  build: {
    ssr: 'server/pitaj.ts',
    outDir: FUNKCIJA,
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: { output: { format: 'es', entryFileNames: 'index.mjs' } },
  },
  ssr: { noExternal: true, target: 'node' },
});
