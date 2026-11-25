import { lokalno } from './sarajevo';

/*
 * Putujem: vrijeme duž puta, za čas kad ćeš tu stvarno biti.
 *
 * Ruta (OSRM) je niz tačaka s trajanjem svakog komada. Na svakih ~25 km uzmemo
 * tačku, znamo kad si tu (polazak + vožnja), i za taj sat pitamo prognozu.
 * Imena tačaka su iz ugrađene liste mjesta (najbliže do 25 km), u genitivu:
 * "kiša od Jablanice do Konjica oko 15h".
 */

export interface TackaRute {
  lat: number;
  lon: number;
  /** od polaska */
  km: number;
  /** minuta vožnje od polaska */
  min: number;
}

const R = 6371;
const rad = Math.PI / 180;

export function km(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Tačke na ruti: početak, svakih `razmak` km, i kraj.
 * @param koord [lon, lat] kao u GeoJSON-u
 * @param trajanja sekunde za svaki komad između susjednih tačaka (OSRM annotation.duration)
 */
export function tackeNaRuti(koord: [number, number][], trajanja: number[], razmak = 25): TackaRute[] {
  if (koord.length < 2) return [];
  const out: TackaRute[] = [];
  let d = 0;
  let t = 0;
  let sljedeci = 0;
  for (let i = 0; i < koord.length; i++) {
    if (i > 0) {
      const [lo1, la1] = koord[i - 1]!;
      const [lo2, la2] = koord[i]!;
      d += km(la1, lo1, la2, lo2);
      t += (trajanja[i - 1] ?? 0) / 60;
    }
    if (d >= sljedeci) {
      const [lon, lat] = koord[i]!;
      out.push({ lat, lon, km: d, min: t });
      sljedeci = d + razmak;
    }
  }
  const [lon, lat] = koord[koord.length - 1]!;
  const zadnja = out[out.length - 1]!;
  // Kraj uvijek, osim ako je zadnja uzeta tačka već skoro na kraju.
  if (d - zadnja.km > razmak / 3) out.push({ lat, lon, km: d, min: t });
  else Object.assign(zadnja, { lat, lon, km: d, min: t });
  return out;
}

/** Najbliže poznato mjesto do `doKm`, ili null. */
export function najblize<T extends { lat: number; lon: number }>(
  lat: number,
  lon: number,
  mjesta: T[],
  doKm = 25
): T | null {
  let naj: T | null = null;
  let min = doKm;
  for (const m of mjesta) {
    const d = km(lat, lon, m.lat, m.lon);
    if (d <= min) {
      min = d;
      naj = m;
    }
  }
  return naj;
}

export interface VrijemeTacke {
  temp: number;
  /** mm u tom satu */
  kisa: number;
  kod: number;
  udari: number;
}

export type Uslov = 'suho' | 'kisa' | 'jaka-kisa' | 'magla' | 'vjetar' | 'snijeg' | 'poledica';

/** Od najblažeg do najgoreg: za grupu tačaka važi najgori. */
export const TEZINA: Record<Uslov, number> = {
  suho: 0,
  kisa: 1,
  magla: 2,
  vjetar: 3,
  'jaka-kisa': 4,
  snijeg: 5,
  poledica: 6,
};

const SNIJEG = (k: number): boolean => (k >= 71 && k <= 77) || k === 85 || k === 86;
const LEDENA = (k: number): boolean => k === 56 || k === 57 || k === 66 || k === 67;
const PADA = (k: number): boolean => (k >= 51 && k <= 67) || (k >= 80 && k <= 82) || k >= 95;

export function uslov(v: VrijemeTacke): Uslov {
  const pada = v.kisa >= 0.2 || PADA(v.kod) || SNIJEG(v.kod);
  // Ledena kiša, ili kiša/snijeg na temperaturi oko nule: cesta se ledi.
  if (LEDENA(v.kod) || (pada && v.temp <= 1 && !SNIJEG(v.kod))) return 'poledica';
  if (SNIJEG(v.kod) || (pada && v.temp <= 1.5)) return 'snijeg';
  if (v.kisa >= 4 || v.kod === 65 || v.kod === 82 || v.kod >= 95) return 'jaka-kisa';
  if (v.udari >= 60) return 'vjetar';
  if (v.kod === 45 || v.kod === 48) return 'magla';
  if (pada) return 'kisa';
  return 'suho';
}

const OPIS: Record<Exclude<Uslov, 'suho'>, string> = {
  kisa: 'kiša',
  'jaka-kisa': 'jaka kiša',
  magla: 'magla',
  vjetar: 'jak vjetar',
  snijeg: 'snijeg',
  poledica: 'moguća poledica',
};
export const opisUslova = (u: Uslov): string => (u === 'suho' ? 'suho' : OPIS[u]);

export interface TackaPuta extends TackaRute {
  /** Ime mjesta u genitivu ("Jablanice"), ili null kad nema poznatog blizu. */
  genitiv: string | null;
  ime: string | null;
  /** ms, kad si tu */
  kad: number;
  v: VrijemeTacke;
  uslov: Uslov;
}

/** "od Jablanice do Konjica", "kod Konjica", "na putu". */
function gdje(grupa: TackaPuta[]): string {
  const imena = grupa.map((t) => t.genitiv).filter((x): x is string => !!x);
  const prvo = imena[0];
  const zadnje = imena[imena.length - 1];
  if (!prvo) return 'na putu';
  if (prvo === zadnje) return `kod ${prvo}`;
  return `od ${prvo} do ${zadnje}`;
}

/**
 * "Do Sarajeva: kiša od Jablanice do Konjica oko 15h, na odredištu suho."
 * @param odrediste genitiv odredišta ("Sarajeva") ili ime ako genitiv ne znamo
 */
export function putRecenica(tacke: TackaPuta[], odrediste: { ime: string; genitiv: string | null }): string {
  const naslov = odrediste.genitiv ? `Do ${odrediste.genitiv}` : odrediste.ime;
  if (!tacke.length) return `${naslov}: nema prognoze za put.`;
  if (tacke.every((t) => t.uslov === 'suho')) return `${naslov} suho cijelim putem.`;

  // Uzastopne tačke s lošim vremenom su jedna dionica; važi najgore na njoj.
  const dionice: TackaPuta[][] = [];
  let tekuca: TackaPuta[] = [];
  for (const t of tacke) {
    if (t.uslov === 'suho') {
      if (tekuca.length) dionice.push(tekuca);
      tekuca = [];
    } else tekuca.push(t);
  }
  if (tekuca.length) dionice.push(tekuca);

  const zadnja = tacke[tacke.length - 1]!;
  const dijelovi = dionice.slice(0, 2).map((d) => {
    const najgore = d.reduce((a, b) => (TEZINA[b.uslov] > TEZINA[a.uslov] ? b : a));
    const naKraju = d.includes(zadnja) && d.length === 1;
    const mjesto = naKraju ? 'na odredištu' : gdje(d);
    return `${opisUslova(najgore.uslov)} ${mjesto} oko ${lokalno(d[0]!.kad).sat}h`;
  });
  if (dionice.length > 2) dijelovi.push('i dalje mjestimično');
  if (zadnja.uslov === 'suho') dijelovi.push('na odredištu suho');
  return `${naslov}: ${dijelovi.join(', ')}.`;
}

export type Polazak = 'sad' | 'za-sat' | 'sutra';

/** Kad se kreće, ms. "Sutra" = sutra u 7h po našem vremenu. */
export function vrijemePolaska(p: Polazak, sad: number): number {
  if (p === 'sad') return sad;
  if (p === 'za-sat') return sad + 3600e3;
  const l = lokalno(sad);
  // Sutra 7h lokalno: ponoć danas (UTC) + 1 dan + 7h − pomak.
  const ponocUtc = Date.UTC(l.godina, l.mjesec - 1, l.dan);
  const sutra7 = ponocUtc + 864e5 + 7 * 3600e3;
  return sutra7 - (lokalno(sutra7).sat - 7) * 3600e3;
}
