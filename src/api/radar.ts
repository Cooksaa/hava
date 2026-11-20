import { kisaUKrugu, kretanje, prognozaTacke, type Korak } from '../logic/nowcast';
import { prazno, upisi, type Polje } from '../logic/radar';
import type { Mjesto } from '../tipovi';

/*
 * Radar padavina: RainViewer (rainviewer.com), besplatno za ličnu i obrazovnu upotrebu,
 * uz navođenje izvora. Za Google Play ide EUMETNET OPERA preko našeg servera; zato
 * je sve što zavisi od izvora ovdje, a račun u logic/nowcast.ts.
 *
 * Snimak je svakih 10 minuta. Uzimamo dva (zadnji i ~30 min stariji), svaki kao
 * 2×2 slike oko mjesta na zoomu 6 (~1,8 km po pikselu), i sve računamo na telefonu.
 */

const MAPE = 'https://api.rainviewer.com/public/weather-maps.json';
const Z = 6;
const SLIKA = 256;
/** Pola stranice prozora oko mjesta, pikseli (~170 km): dovoljno za kišu koja ide 80 km/h 2 sata. */
const R = 96;
/** Najveća brzina koja se traži, piksela po minuti (~125 km/h). */
const NAJVISE = 1.2;
/** Stariji snimak od ovoga (minuta) je prestar za "minut po minut". */
const NAJSTARIJI = 40;

export interface Radar {
  koraci: Korak[];
  /** Kad je snimljen zadnji snimak, ms. */
  snimak: number;
  /** Ima li kiše na radaru u krugu od 100 km. */
  blizu: boolean;
  /** Kad je izračunato, ms (koraci počinju tada). */
  izracunato: number;
}

/** Radar pokriva Evropu, ali račun i provjeru smo radili za naš kraj. */
export const imaRadar = (m: Pick<Mjesto, 'lat' | 'lon'>): boolean =>
  m.lat > 41 && m.lat < 47.5 && m.lon > 13 && m.lon < 23.5;

interface Okvir {
  time: number;
  path: string;
}

let mape: { host: string; okviri: Okvir[]; kad: number } | null = null;

async function dajMape(signal?: AbortSignal): Promise<{ host: string; okviri: Okvir[] }> {
  if (mape && Date.now() - mape.kad < 4 * 60_000) return mape;
  const o = await fetch(MAPE, { signal });
  if (!o.ok) throw new Error(`radar ${o.status}`);
  const j = (await o.json()) as { host: string; radar?: { past?: Okvir[] } };
  mape = { host: j.host, okviri: j.radar?.past ?? [], kad: Date.now() };
  return mape;
}

/** Slike se ne mijenjaju (svaki snimak ima svoju adresu), pa se pamte dok traje aplikacija. */
const slike = new Map<string, Promise<Uint8ClampedArray>>();

async function rgba(url: string, signal?: AbortSignal): Promise<Uint8ClampedArray> {
  const o = await fetch(url, { signal });
  if (!o.ok) throw new Error(`radar ${o.status}`);
  const bmp = await createImageBitmap(await o.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const platno =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bmp.width, bmp.height)
      : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = platno.getContext('2d', { willReadFrequently: true }) as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('radar: nema platna');
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return ctx.getImageData(0, 0, platno.width, platno.height).data;
}

function slika(url: string, signal?: AbortSignal): Promise<Uint8ClampedArray> {
  let p = slike.get(url);
  if (!p) {
    p = rgba(url, signal);
    p.catch(() => slike.delete(url));
    slike.set(url, p);
    // Dovoljno za par mjesta i par osvježavanja.
    if (slike.size > 40) slike.delete(slike.keys().next().value!);
  }
  return p;
}

/** Mjesto u pikselima svijeta (Web Mercator) na zoomu Z. */
function piksel(lat: number, lon: number): { x: number; y: number } {
  const n = SLIKA * 2 ** Z;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
}

async function polje(host: string, o: Okvir, x0: number, y0: number, signal?: AbortSignal): Promise<Polje> {
  const p = prazno(2 * R, 2 * R);
  const t0x = Math.floor(x0 / SLIKA);
  const t0y = Math.floor(y0 / SLIKA);
  const t1x = Math.floor((x0 + 2 * R - 1) / SLIKA);
  const t1y = Math.floor((y0 + 2 * R - 1) / SLIKA);
  const posao: Promise<void>[] = [];
  for (let ty = t0y; ty <= t1y; ty++) {
    for (let tx = t0x; tx <= t1x; tx++) {
      // 0_1: bez zaglađivanja (tačne boje), snijeg svojim bojama.
      const url = `${host}${o.path}/${SLIKA}/${Z}/${tx}/${ty}/2/0_1.png`;
      posao.push(slika(url, signal).then((d) => upisi(p, d, SLIKA, tx * SLIKA - x0, ty * SLIKA - y0)));
    }
  }
  await Promise.all(posao);
  return p;
}

/** Kiša u naredna 2 sata za mjesto, ili null (nema radara, prestar, greška). */
export async function dohvatiRadar(m: Mjesto, signal?: AbortSignal): Promise<Radar | null> {
  if (!imaRadar(m)) return null;
  try {
    const { host, okviri } = await dajMape(signal);
    const zadnji = okviri[okviri.length - 1];
    if (!zadnji) return null;
    const kasnjenje = (Date.now() - zadnji.time * 1000) / 60_000;
    if (kasnjenje > NAJSTARIJI) return null;
    // Stariji snimak što bliže 30 min prije, a bar 20.
    const stari = okviri
      .filter((o) => zadnji.time - o.time >= 20 * 60)
      .sort((a, b) => Math.abs(zadnji.time - a.time - 1800) - Math.abs(zadnji.time - b.time - 1800))[0];

    const c = piksel(m.lat, m.lon);
    const x0 = Math.round(c.x) - R;
    const y0 = Math.round(c.y) - R;
    const [novo, staro] = await Promise.all([
      polje(host, zadnji, x0, y0, signal),
      stari ? polje(host, stari, x0, y0, signal) : Promise.resolve(null),
    ]);
    const k = staro && stari ? kretanje(staro, novo, (zadnji.time - stari.time) / 60, NAJVISE) : null;
    const kmPoPikselu = (40_075.017 / (SLIKA * 2 ** Z)) * Math.cos((m.lat * Math.PI) / 180);
    return {
      koraci: prognozaTacke(novo, k, R, R, { kasnjenje, kmPoPikselu }),
      snimak: zadnji.time * 1000,
      blizu: kisaUKrugu(novo, R, R, 100, kmPoPikselu),
      izracunato: Date.now(),
    };
  } catch {
    return null;
  }
}
