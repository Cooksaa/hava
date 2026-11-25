import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { procitajZone, type Zona } from '../logic/zone';

/*
 * DJI zone za dron. Samo u Android aplikaciji: DJI server ne dozvoljava poziv iz
 * preglednika (CORS), a Androidov HTTP to ne pita. Na webu zona nema (null).
 *
 * DJI ne daje zone za veliko područje: poluprečnik pretrage držimo do ~25 km.
 * Zone se rijetko mijenjaju, pa se odgovor pamti 24 sata (i bez mreže).
 */

const ADRESA = 'https://www-api.dji.com/api/geo/areas';
const PAMTI_MS = 24 * 3600e3;
const KLJUC = 'zone:v1';
export const NAJVECI_RADIJUS = 25_000;

interface Zapis {
  kad: number;
  zone: Zona[];
}

const memorija = new Map<string, Zapis>();

function citaj(): Record<string, Zapis> {
  try {
    return JSON.parse(localStorage.getItem(KLJUC) ?? '{}') as Record<string, Zapis>;
  } catch {
    return {};
  }
}

function pamti(kljuc: string, z: Zapis): void {
  memorija.set(kljuc, z);
  try {
    const sve = citaj();
    sve[kljuc] = z;
    // Samo zadnjih nekoliko mjesta (svako par kB).
    const kljucevi = Object.keys(sve).sort((a, b) => sve[b]!.kad - sve[a]!.kad);
    for (const k of kljucevi.slice(12)) delete sve[k];
    localStorage.setItem(KLJUC, JSON.stringify(sve));
  } catch {
    /* bez pamćenja */
  }
}

export const imaZone = (): boolean => Capacitor.isNativePlatform();

/**
 * Zone oko tačke. Vraća i staru kopiju ako DJI ne odgovara (onda `stare: true`),
 * a null samo kad zona nema ni u kešu.
 */
export async function dohvatiZone(
  lat: number,
  lon: number,
  radijus: number,
): Promise<{ zone: Zona[]; stare: boolean } | null> {
  if (!imaZone()) return null;
  const r = Math.min(NAJVECI_RADIJUS, Math.max(2000, Math.round(radijus / 1000) * 1000));
  const kljuc = `${lat.toFixed(2)},${lon.toFixed(2)},${r}`;
  const staro = memorija.get(kljuc) ?? citaj()[kljuc];
  if (staro && Date.now() - staro.kad < PAMTI_MS) return { zone: staro.zone, stare: false };

  const url =
    `${ADRESA}?drone=dji-mini-2&zones_mode=total&country=BA&level=0,1,2,3,4,6,7` +
    `&lng=${lon.toFixed(5)}&lat=${lat.toFixed(5)}&search_radius=${r}`;
  try {
    const o = await CapacitorHttp.get({ url, connectTimeout: 10_000, readTimeout: 15_000 });
    if (o.status !== 200) throw new Error(String(o.status));
    const zone = procitajZone(typeof o.data === 'string' ? JSON.parse(o.data) : o.data);
    pamti(kljuc, { kad: Date.now(), zone });
    return { zone, stare: false };
  } catch {
    return staro ? { zone: staro.zone, stare: true } : null;
  }
}
