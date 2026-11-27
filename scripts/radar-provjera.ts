// Koliko radar "minut po minut" pogađa: provjera unazad na zadnja 2 sata snimaka.
//
// RainViewer čuva 13 snimaka (2 sata, svakih 10 min). Za svaki snimak T od 30 min
// nadalje uzmemo T−30 i T (kao aplikacija), predvidimo kišu za 108 tačaka po BiH
// i uporedimo sa snimkom u T+10…T+80. Ispiše jedan JSON red sa zbirom pogodaka,
// promašaja, lažnih uzbuna i tačnih "suho" po vremenu unaprijed, za nowcast i za
// "kiša stoji" (poređenje). Workflow radar-provjera.yml ga dopisuje u granu podaci.
//
// Pokreće se bundlovano (rolldown), jer uvozi logiku aplikacije iz src/logic.

import { createRequire } from 'node:module';
import { kretanje, prognozaTacke, PRAG_MMH } from '../src/logic/nowcast';
import { KISA } from '../src/logic/kisaSad';
import { prazno, upisi, type Polje } from '../src/logic/radar';

const require = createRequire(`${process.cwd()}/package.json`);
const sharp = require('sharp') as (b: Buffer) => { ensureAlpha(): { raw(): { toBuffer(o: { resolveWithObject: true }): Promise<{ data: Buffer }> } } };

const Z = 6;
const W = 256 * 2 ** Z;
const TX = [34, 35];
const TY = [22, 23, 24];
const R = 96;
const KM = 1.76;
const LEADS = [10, 20, 30, 40, 60, 80];

async function json(url: string): Promise<unknown> {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`Ne odgovara: ${url}`);
}

const mapa = (await json('https://api.rainviewer.com/public/weather-maps.json')) as {
  host: string;
  radar: { past: { time: number; path: string }[] };
};
const okviri = mapa.radar.past;

const x0 = TX[0]! * 256;
const y0 = TY[0]! * 256;
const velika: Polje[] = [];
for (const o of okviri) {
  const p = prazno(TX.length * 256, TY.length * 256);
  for (const x of TX)
    for (const y of TY) {
      // Polako: RainViewer dozvoljava ~100 upita u minuti.
      await new Promise((res) => setTimeout(res, 400));
      const b = Buffer.from(await (await fetch(`${mapa.host}${o.path}/256/${Z}/${x}/${y}/2/0_1.png`)).arrayBuffer());
      const { data } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      upisi(p, data, 256, (x - TX[0]!) * 256, (y - TY[0]!) * 256);
    }
  velika.push(p);
}

function isjecak(p: Polje, cx: number, cy: number): Polje {
  const q = prazno(2 * R, 2 * R);
  for (let y = 0; y < 2 * R; y++)
    for (let x = 0; x < 2 * R; x++) {
      const sx = cx - R + x;
      const sy = cy - R + y;
      if (sx < 0 || sy < 0 || sx >= p.sirina || sy >= p.visina) continue;
      q.kisa[y * q.sirina + x] = p.kisa[sy * p.sirina + sx]!;
      q.snijeg[y * q.sirina + x] = p.snijeg[sy * p.sirina + sx]!;
    }
  return q;
}
const mx = (lon: number): number => ((lon + 180) / 360) * W;
const my = (lat: number): number =>
  ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * W;
const tacke: [number, number][] = [];
for (let lat = 42.8; lat <= 45.01; lat += 0.25) for (let lon = 16.0; lon <= 19.31; lon += 0.3) tacke.push([lat, lon]);

type Sk = { h: number; m: number; f: number; c: number };
const rez: Record<'nowcast' | 'stoji', Record<number, Sk>> = { nowcast: {}, stoji: {} };
for (const k of ['nowcast', 'stoji'] as const) for (const l of LEADS) rez[k][l] = { h: 0, m: 0, f: 0, c: 0 };

for (let t = 3; t < okviri.length - 1; t++) {
  for (const [lat, lon] of tacke) {
    const cx = Math.round(mx(lon) - x0);
    const cy = Math.round(my(lat) - y0);
    const novo = isjecak(velika[t]!, cx, cy);
    const staro = isjecak(velika[t - 3]!, cx, cy);
    const k = kretanje(staro, novo, 30, 1.2);
    for (const [ime, kk] of [
      ['nowcast', k],
      ['stoji', null],
    ] as const) {
      const kor = prognozaTacke(novo, kk, R, R, { kasnjenje: 0, kmPoPikselu: KM, korak: 10, trajanje: 80 });
      for (const l of LEADS) {
        const ti = t + l / 10;
        if (ti >= okviri.length) continue;
        const sad = isjecak(velika[ti]!, cx, cy);
        let n = 0;
        let d = 0;
        for (let y = -1; y <= 1; y++)
          for (let x = -1; x <= 1; x++) {
            n++;
            if (sad.kisa[(R + y) * sad.sirina + R + x]! >= PRAG_MMH) d++;
          }
        const obs = d / n > 0.5;
        const pred = kor.find((q) => q.min === l)!.vjer >= KISA;
        const s = rez[ime][l]!;
        if (obs && pred) s.h++;
        else if (obs) s.m++;
        else if (pred) s.f++;
        else s.c++;
      }
    }
  }
}

console.log(JSON.stringify({ vrijeme: new Date(okviri[okviri.length - 1]!.time * 1000).toISOString(), okvira: okviri.length, rez }));
