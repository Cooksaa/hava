// Hava stranica: izvor.html → pregled.html (lokalno, slike iz slike/) i wordpress-widget.html
// (sadržaj Elementor HTML widgeta: jedan red, bez dvostrukih navodnika i backslasha, slike iz WP medija).
//   node web/stranica/napravi.mjs [mjesec uploada, npr. 2026/11]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const D = dirname(fileURLToPath(import.meta.url));
const mjesec = process.argv[2] ?? '2026/11';
const izvor = readFileSync(join(D, 'izvor.html'), 'utf8');

const zajedno = {
  '{{STRANICA}}': 'https://alemcoksa.com/aplikacije/hava/',
  '{{PRIVATNOST}}': 'https://alemcoksa.com/aplikacije/hava/privatnost/',
  // Od sljedećeg izdanja: https://github.com/Cooksaa/hava/releases/latest/download/Hava.apk
  '{{APK}}': 'https://github.com/Cooksaa/hava/releases/latest',
};
const zamijeni = (s, m) => Object.entries(m).reduce((a, [k, v]) => a.split(k).join(v), s);

const pregled = zamijeni(izvor, { ...zajedno, '{{IMG}}': 'slike/' });
writeFileSync(
  join(D, 'pregled.html'),
  `<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Hava</title><style>body{margin:0;background:#0a1322}</style></head><body>${pregled}</body></html>`,
);

let wp = zamijeni(izvor, { ...zajedno, '{{IMG}}': `https://alemcoksa.com/wp-content/uploads/${mjesec}/` });
wp = wp
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\r?\n\s*/g, ' ')
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')
  .trim();
const lose = [...wp.matchAll(/["\\]/g)].map((m) => wp.slice(Math.max(0, m.index - 30), m.index + 10));
if (lose.length) {
  console.error('Widget ne smije imati dvostruke navodnike ni backslash:', lose.slice(0, 5));
  process.exit(1);
}
writeFileSync(join(D, 'wordpress-widget.html'), wp);
console.log(`pregled.html i wordpress-widget.html (${wp.length} znakova, slike: uploads/${mjesec}/)`);
