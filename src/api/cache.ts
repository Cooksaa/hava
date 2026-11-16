import type { Mjesto, Prognoza } from '../tipovi';

/*
 * Zadnja prognoza i zadnje mjesto u localStorage, da se app otvori odmah
 * i da radi bez interneta. Sve je u try/catch: privatni prozor ili pun disk
 * ne smiju srušiti aplikaciju.
 */

const KLJUC_PROGNOZA = 'prognoza:v2';
const KLJUC_MJESTO = 'mjesto:v1';

export interface SpremljenaPrognoza {
  mjesto: Mjesto;
  prognoza: Prognoza;
  /** Kad je dohvaćena, ms od epohe. */
  spremljeno: number;
}

function citaj<T>(kljuc: string): T | null {
  try {
    const sirovo = localStorage.getItem(kljuc);
    return sirovo ? (JSON.parse(sirovo) as T) : null;
  } catch {
    return null;
  }
}

function pisi(kljuc: string, vrijednost: unknown): void {
  try {
    localStorage.setItem(kljuc, JSON.stringify(vrijednost));
  } catch {
    /* nema mjesta ili je zabranjeno: nastavljamo bez cachea */
  }
}

const istoMjesto = (a: Mjesto, b: Mjesto): boolean =>
  Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;

export function ucitajMjesto(): Mjesto | null {
  const m = citaj<Mjesto>(KLJUC_MJESTO);
  return m && typeof m.lat === 'number' && typeof m.lon === 'number' && typeof m.ime === 'string' ? m : null;
}

export function spremiMjesto(mjesto: Mjesto): void {
  pisi(KLJUC_MJESTO, mjesto);
}

export function ucitajPrognozu(mjesto: Mjesto): SpremljenaPrognoza | null {
  const s = citaj<SpremljenaPrognoza>(KLJUC_PROGNOZA);
  if (!s?.prognoza?.sada || !Array.isArray(s.prognoza.sati) || !s.mjesto) return null;
  if (typeof s.prognoza.pomakSek !== 'number') return null;
  return istoMjesto(s.mjesto, mjesto) ? s : null;
}

export function spremiPrognozu(mjesto: Mjesto, prognoza: Prognoza): number {
  const spremljeno = Date.now();
  pisi(KLJUC_PROGNOZA, { mjesto, prognoza, spremljeno } satisfies SpremljenaPrognoza);
  return spremljeno;
}

/* Gradovi za "Pada li u…?": zadnje stanje, da kartica ne bude prazna dok stiže novo. */

const KLJUC_GRADOVI = 'gradovi:v2';
/** Starije od ovoga ne prikazujemo: "pada li sad" od prije sat vremena više ništa ne znači. */
const GRADOVI_VRIJEDE_MS = 60 * 60 * 1000;

export function ucitajGradove(koliko: number): Prognoza[] | null {
  const s = citaj<{ prognoze: Prognoza[]; spremljeno: number }>(KLJUC_GRADOVI);
  if (!s || !Array.isArray(s.prognoze) || s.prognoze.length !== koliko) return null;
  if (Date.now() - s.spremljeno > GRADOVI_VRIJEDE_MS) return null;
  return s.prognoze.every((p) => p?.sada && Array.isArray(p.sati)) ? s.prognoze : null;
}

export function spremiGradove(prognoze: Prognoza[]): void {
  pisi(KLJUC_GRADOVI, { prognoze, spremljeno: Date.now() });
}
