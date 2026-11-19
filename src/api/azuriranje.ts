import { CapacitorHttp } from '@capacitor/core';
import { procitajIzdanje, procitajManifest, type GhIzdanje, type Izdanje } from '../logic/azuriranje';
import { PRAZNO, type StanjeAzuriranja } from '../logic/stanjeAzuriranja';

/*
 * Samo za Android aplikaciju s GitHuba: zadnje izdanje i stanje ažuriranja.
 * Kad app bude na Play Storeu, APK ažurira Play, a web dio i dalje ide ovuda.
 *
 * Prvo izdanje.json s izdanja (obična adresa, bez limita, a Androidov HTTP prati
 * preusmjeravanje i ne pita za CORS). Ako ga nema (izdanja prije 0.4.1), GitHub API,
 * koji bez prijave dozvoljava 60 upita na sat po IP adresi.
 */

const MANIFEST = 'https://github.com/Cooksaa/hava/releases/latest/download/izdanje.json';
const API = 'https://api.github.com/repos/Cooksaa/hava/releases/latest';
const KLJUC = 'azuriranje:v3';

export interface Zapamceno extends StanjeAzuriranja {
  izdanje: Izdanje | null;
}

export function citajStanje(): Zapamceno {
  try {
    const s = localStorage.getItem(KLJUC);
    if (s) return { ...PRAZNO, izdanje: null, ...(JSON.parse(s) as Partial<Zapamceno>) };
  } catch {
    /* pokvareno ili nedostupno: kao da nikad nije provjereno */
  }
  return { ...PRAZNO, izdanje: null };
}

export function pisiStanje(z: Zapamceno): void {
  try {
    localStorage.setItem(KLJUC, JSON.stringify(z));
  } catch {
    /* bez pamćenja: sljedeći put se samo provjeri ponovo */
  }
}

const json = (data: unknown): unknown => (typeof data === 'string' ? JSON.parse(data) : data);

async function get(url: string, headers: Record<string, string> = {}): Promise<{ status: number; data: unknown }> {
  try {
    return await CapacitorHttp.get({ url, headers, connectTimeout: 10_000, readTimeout: 15_000 });
  } catch {
    throw new Error('nema interneta ili GitHub ne odgovara');
  }
}

/** Zadnje izdanje. Baca grešku s kratkim razlogom (za prikaz na telefonu). */
export async function dohvatiIzdanje(): Promise<Izdanje> {
  const m = await get(MANIFEST);
  if (m.status === 200) {
    const iz = procitajManifest(json(m.data));
    if (iz) return iz;
  }
  // Starije izdanje bez izdanje.json, ili je s njim nešto krivo: GitHub API.
  const a = await get(API, { Accept: 'application/vnd.github+json' });
  if (a.status === 403 || a.status === 429) throw new Error('GitHub privremeno odbija provjere s ove mreže');
  if (a.status !== 200) throw new Error(`GitHub je vratio grešku ${a.status}`);
  return procitajIzdanje(json(a.data) as GhIzdanje);
}
