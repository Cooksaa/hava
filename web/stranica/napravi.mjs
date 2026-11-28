// Hava stranice za alemcoksa.com: izvor.html (aplikacije/hava) i privatnost.html (aplikacije/hava/privatnost)
// → pregled*.html (lokalno) i *-widget.html (sadržaj Elementor HTML widgeta: jedan red, bez dvostrukih
// navodnika i backslasha, slike iz WP medija).
//   node web/stranica/napravi.mjs [mjesec uploada, npr. 2026/11]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const D = dirname(fileURLToPath(import.meta.url));
const mjesec = process.argv[2] ?? '2026/11';
const mediji = `https://alemcoksa.com/wp-content/uploads/${mjesec}/`;

const zajedno = {
  '{{STRANICA}}': 'https://alemcoksa.com/aplikacije/hava/',
  '{{PRIVATNOST}}': 'https://alemcoksa.com/aplikacije/hava/privatnost/',
  // Od sljedećeg izdanja: https://github.com/Cooksaa/hava/releases/latest/download/Hava.apk
  '{{APK}}': 'https://github.com/Cooksaa/hava/releases/latest',
};
// Imena kakva je WordPress dao pri uploadu (ime iz naslova, veliko početno slovo): ID 204–209.
const WP_IMENA = {
  'hava-dron.webp': 'Hava-dron.webp',
  'hava-put.webp': 'Hava-put.webp',
  'hava-karta.webp': 'Hava-karta.webp',
  'hava-aktivnosti.webp': 'Hava-aktivnosti.webp',
  'Hava-promo-720.mp4': 'Hava-promo-video.mp4',
  'Hava-promo-poster.jpg': 'Hava-promo-poster.jpg',
};
const zamijeni = (s, m) => Object.entries(m).reduce((a, [k, v]) => a.split(k).join(v), s);

function napravi(izvorIme, pregledIme, widgetIme, naslov) {
  const izvor = readFileSync(join(D, izvorIme), 'utf8');
  const pregled = zamijeni(izvor, { ...zajedno, '{{IMG}}': 'slike/', '{{VIDEO}}': '../video/' });
  writeFileSync(
    join(D, pregledIme),
    `<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${naslov}</title><style>body{margin:0;background:#0a1322}</style></head><body>${pregled}</body></html>`,
  );
  let wp = zamijeni(izvor, { ...zajedno, '{{IMG}}': mediji, '{{VIDEO}}': mediji });
  wp = zamijeni(wp, Object.fromEntries(Object.entries(WP_IMENA).map(([a, b]) => [mediji + a, mediji + b])));
  wp = wp
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\r?\n\s*/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const lose = [...wp.matchAll(/["\\]/g)].map((m) => wp.slice(Math.max(0, m.index - 30), m.index + 10));
  if (lose.length) {
    console.error(`${widgetIme}: ne smije imati dvostruke navodnike ni backslash:`, lose.slice(0, 5));
    process.exit(1);
  }
  writeFileSync(join(D, widgetIme), wp);
  console.log(`${pregledIme} i ${widgetIme} (${wp.length} znakova)`);
}

napravi('izvor.html', 'pregled.html', 'wordpress-widget.html', 'Hava');
napravi('privatnost.html', 'pregled-privatnost.html', 'privatnost-widget.html', 'Hava: privatnost');
