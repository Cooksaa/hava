import { BIH, MJESTA, type PoznatoMjesto } from '../mjesta';
import type { Mjesto } from '../tipovi';

/* Ime za GPS koordinate i pretraga po ugrađenoj listi mjesta. */

const R_ZEMLJE_KM = 6371;
const rad = (stepeni: number): number => (stepeni * Math.PI) / 180;

/** Udaljenost po velikom krugu, km. */
export function udaljenostKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_ZEMLJE_KM * Math.asin(Math.sqrt(h));
}

/** Do ove udaljenosti kažemo da si "u" mjestu, a do sljedeće "blizu". */
const U_MJESTU_KM = 5;
const BLIZU_KM = 30;

/**
 * Mjesto za GPS koordinate. Koordinate se zaokružuju na dvije decimale (oko 1 km):
 * prognoza je ista, a tačna lokacija ne ide u zahtjev.
 */
export function mjestoZaKoordinate(lat: number, lon: number): Mjesto {
  const tacka = { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };

  let najblize: PoznatoMjesto | null = null;
  let najmanje = Infinity;
  for (const m of MJESTA) {
    const km = udaljenostKm(tacka, m);
    if (km < najmanje) {
      najmanje = km;
      najblize = m;
    }
  }

  const ime =
    najblize && najmanje <= U_MJESTU_KM
      ? najblize.ime
      : najblize && najmanje <= BLIZU_KM
        ? `Blizu ${najblize.genitiv}`
        : 'Moja lokacija';
  // Država najbližeg poznatog mjesta; na granici (Čapljina–Metković) dovoljno tačno.
  const bih = najblize && najmanje <= BLIZU_KM ? { bih: najblize.drzava === BIH } : {};
  return { ime, ...tacka, ...bih };
}

/** "Čapljina" → "capljina", da pretraga radi i bez kvačica. */
export function bezKvacica(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Mjesta iz ugrađene liste koja počinju upitom (ili im neka riječ počinje upitom). */
export function traziPoznata(upit: string): PoznatoMjesto[] {
  const u = bezKvacica(upit);
  if (!u) return [];
  return MJESTA.filter((m) => {
    const ime = bezKvacica(m.ime);
    return ime.startsWith(u) || ime.split(' ').some((rijec) => rijec.startsWith(u));
  });
}
