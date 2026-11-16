import { udaljenostKm } from '../logic/mjesto';
import type { Mjesto } from '../tipovi';

/* Pretraga mjesta po imenu: Open-Meteo geocoding (GeoNames podaci). */

const ADRESA = 'https://geocoding-api.open-meteo.com/v1/search';

export interface Pogodak extends Mjesto {
  /** "Federacija Bosne i Hercegovine, Bosna i Hercegovina" */
  opis: string;
}

interface OmMjesto {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  feature_code?: string;
}

async function upit(ime: string, drzava: string | null, signal?: AbortSignal): Promise<OmMjesto[]> {
  const p = new URLSearchParams({ name: ime, count: '6', language: 'bs' });
  if (drzava) p.set('countryCode', drzava);
  const odgovor = await fetch(`${ADRESA}?${p}`, { signal });
  if (!odgovor.ok) throw new Error(`Geocoding: ${odgovor.status}`);
  const json = (await odgovor.json()) as { results?: OmMjesto[] };
  // Samo naselja: bez planina, vrhova i rijeka istog imena.
  return (json.results ?? []).filter((r) => r.feature_code?.startsWith('PPL'));
}

/** Isto mjesto često dođe dvaput (naselje i općina). */
export function bezDuplih(lista: Pogodak[]): Pogodak[] {
  const izlaz: Pogodak[] = [];
  for (const m of lista) {
    if (!izlaz.some((x) => x.ime === m.ime && udaljenostKm(x, m) < 10)) izlaz.push(m);
  }
  return izlaz;
}

/**
 * Traži u BiH i u svijetu u isto vrijeme, BiH ide prva.
 * Bez toga "mos" daje Mosul i Moskvu prije Mostara.
 */
export async function traziMjesta(ime: string, signal?: AbortSignal): Promise<Pogodak[]> {
  const [domaca, svijet] = await Promise.all([upit(ime, 'BA', signal), upit(ime, null, signal)]);
  return bezDuplih(
    [...domaca, ...svijet].map((r) => ({
      ime: r.name,
      lat: r.latitude,
      lon: r.longitude,
      opis: [r.admin1, r.country].filter((x) => x && x !== r.name).join(', '),
    })),
  ).slice(0, 8);
}
