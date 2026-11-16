import type { Doba, Nebo, VrstaNeba } from '../logic/nebo';

/*
 * Boje neba i stakla za svako stanje. Ovo je jedini izvor: pozadina.ts ih
 * postavlja kao CSS varijable, a palete.test.ts provjerava da bijeli tekst
 * prolazi WCAG AA u svakom stanju.
 *
 * Pravilo: gornja dva tona neba su dovoljno tamna za tekst direktno na nebu.
 * Donji ton smije biti svijetao, ali tu tekst stoji samo na staklu.
 */

export interface Paleta {
  /** Vrh, sredina (na 55% visine), dno. */
  nebo: [string, string, string];
  /** Boja kojom je staklo zatamnjeno (danju) ili posvijetljeno (noću). */
  staklo: string;
  stakloA: number;
  /** Odsjaj sunca ili mjeseca. */
  sjaj: string;
  sjajA: number;
  /** Visina odsjaja, % visine ekrana. Suton ga spušta prema horizontu. */
  sjajY: number;
}

/** Prozirnost sporednog teksta. I on mora proći AA na staklu. */
export const TIHI_A = 0.88;

/** Najjači odsjaj na vrhu stakla (staklo.css). Ulazi u račun kontrasta. */
export const ODSJAJ_A = 0.08;

type Kljuc = `dan-${VrstaNeba}` | `noc-${VrstaNeba}` | 'suton';

export const PALETE: Record<Kljuc, Paleta> = {
  'dan-vedro': {
    nebo: ['#1f5aa6', '#3774bd', '#5a95d6'],
    staklo: '#0a2748',
    stakloA: 0.38,
    sjaj: '#ffffff',
    sjajA: 0.2,
    sjajY: 6,
  },
  'dan-oblacno': {
    nebo: ['#4c5d6e', '#627384', '#8493a0'],
    staklo: '#17222d',
    stakloA: 0.36,
    sjaj: '#ffffff',
    sjajA: 0.07,
    sjajY: 6,
  },
  'dan-kisa': {
    nebo: ['#2c3945', '#3f4e5b', '#5c6b78'],
    staklo: '#10181f',
    stakloA: 0.24,
    sjaj: '#ffffff',
    sjajA: 0,
    sjajY: 6,
  },
  'dan-grmljavina': {
    nebo: ['#1e2532', '#313847', '#4a4f60'],
    staklo: '#0c1018',
    stakloA: 0.24,
    sjaj: '#ffffff',
    sjajA: 0,
    sjajY: 6,
  },
  'dan-magla': {
    nebo: ['#56636d', '#68757e', '#939ea5'],
    staklo: '#1b2329',
    stakloA: 0.43,
    sjaj: '#ffffff',
    sjajA: 0.1,
    sjajY: 10,
  },
  'dan-snijeg': {
    nebo: ['#4f6477', '#5f7487', '#93a5b3'],
    staklo: '#16222e',
    stakloA: 0.45,
    sjaj: '#ffffff',
    sjajA: 0.08,
    sjajY: 6,
  },
  suton: {
    nebo: ['#2b3a67', '#a85f72', '#dc9a70'],
    staklo: '#1f1830',
    stakloA: 0.49,
    sjaj: '#ffd9a8',
    sjajA: 0.16,
    sjajY: 100,
  },
  'noc-vedro': {
    nebo: ['#0a1322', '#121e36', '#1c2b48'],
    staklo: '#ffffff',
    stakloA: 0.07,
    sjaj: '#c9d8ff',
    sjajA: 0.12,
    sjajY: 6,
  },
  'noc-oblacno': {
    nebo: ['#12171f', '#1b222c', '#262e3a'],
    staklo: '#ffffff',
    stakloA: 0.07,
    sjaj: '#c9d8ff',
    sjajA: 0.04,
    sjajY: 6,
  },
  'noc-kisa': {
    nebo: ['#0f151c', '#18212b', '#222d38'],
    staklo: '#ffffff',
    stakloA: 0.07,
    sjaj: '#c9d8ff',
    sjajA: 0,
    sjajY: 6,
  },
  'noc-grmljavina': {
    nebo: ['#0d1018', '#191c28', '#272a3a'],
    staklo: '#ffffff',
    stakloA: 0.07,
    sjaj: '#c9d8ff',
    sjajA: 0,
    sjajY: 6,
  },
  'noc-magla': {
    nebo: ['#1a2026', '#272e35', '#353d45'],
    staklo: '#ffffff',
    stakloA: 0.07,
    sjaj: '#c9d8ff',
    sjajA: 0.05,
    sjajY: 10,
  },
  'noc-snijeg': {
    nebo: ['#1a2230', '#2a3444', '#3d4959'],
    staklo: '#ffffff',
    stakloA: 0.07,
    sjaj: '#c9d8ff',
    sjajA: 0.05,
    sjajY: 6,
  },
};

export function kljucPalete(doba: Doba, vrsta: VrstaNeba): Kljuc {
  if (doba === 'suton') return 'suton';
  return `${doba}-${vrsta}`;
}

export const paletaZa = (nebo: Nebo): Paleta => PALETE[kljucPalete(nebo.doba, nebo.vrsta)];

/* --- Račun kontrasta (WCAG 2.x) --- */

export type Rgb = [number, number, number];

export function rgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function sjajnost([r, g, b]: Rgb): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Boja `preko` s prozirnošću `a` iznad boje `ispod`. */
export function prekrij(ispod: Rgb, preko: Rgb, a: number): Rgb {
  return ispod.map((x, i) => x * (1 - a) + (preko[i] ?? 0) * a) as Rgb;
}

export function kontrast(a: Rgb, b: Rgb): number {
  const [svjetlija, tamnija] = [sjajnost(a), sjajnost(b)].sort((x, y) => y - x) as [number, number];
  return (svjetlija + 0.05) / (tamnija + 0.05);
}
