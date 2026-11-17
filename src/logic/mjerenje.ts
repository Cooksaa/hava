import type { Prognoza } from '../tipovi';
import { jePadavina } from './kodovi';
import { udaljenostKm } from './mjesto';

/*
 * "Sad" iz mjerenja. Model (i najbolji) za trenutno stanje griješi više od stanice
 * koja upravo mjeri. Aerodromske stanice (METAR) šalju mjerenje svakih 30–60 minuta.
 *
 * Temperatura se uzima sa stanice do 25 km i do 150 m visinske razlike (ispravljeno
 * za visinu). Kiša i oblaci samo do 15 km: kiša se mijenja na kraćoj udaljenosti.
 */

export const AERODROMI: Record<string, string> = {
  LQMO: 'Mostar',
  LQSA: 'Sarajevo',
  LQBK: 'Banja Luka',
  LQTZ: 'Tuzla',
  LDDU: 'Dubrovnik',
  LDSP: 'Split',
  LDOS: 'Osijek',
  LDZA: 'Zagreb',
  LYBE: 'Beograd',
  LYPG: 'Podgorica',
};

export interface Mjerenje {
  stanica: string;
  ime: string;
  lat: number;
  lon: number;
  /** Visina stanice, m. */
  visina: number;
  /** Kad je izmjereno (ms UTC). */
  vrijeme: number;
  temp: number;
  /** WMO kod za ono što se vidi na stanici, ili null ako se ne može reći. */
  kod: number | null;
  pada: boolean;
}

/** Jedan zapis s aviationweather.gov (format=json), samo polja koja koristimo. */
export interface MetarZapis {
  icaoId: string;
  obsTime: number;
  temp?: number | null;
  wxString?: string | null;
  cover?: string | null;
  lat: number;
  lon: number;
  elev: number;
}

const DO_TEMP_KM = 25;
const DO_KISE_KM = 15;
const VISINSKA_RAZLIKA_M = 150;
const STARO_MIN = 90;
/** Temperatura pada ~0,65° na 100 m. */
const PAD_PO_M = 0.0065;

/** Kod iz METAR pojava (wxString) i naoblake. */
function kodIzMetara(wx: string, cover: string | null | undefined): { kod: number | null; pada: boolean } {
  const pojave = wx.split(/\s+/).filter((p) => p && !p.startsWith('VC') && !p.startsWith('RE'));
  for (const p of pojave) {
    const jako = p.startsWith('+');
    const slabo = p.startsWith('-');
    if (/TS/.test(p)) return { kod: 95, pada: true };
    if (/SN|SG|PL/.test(p)) return { kod: jako ? 75 : slabo ? 71 : 73, pada: true };
    if (/GR|GS/.test(p)) return { kod: 96, pada: true };
    if (/SHRA/.test(p)) return { kod: jako ? 82 : slabo ? 80 : 81, pada: true };
    if (/RA/.test(p)) return { kod: jako ? 65 : slabo ? 61 : 63, pada: true };
    if (/DZ/.test(p)) return { kod: jako ? 55 : slabo ? 51 : 53, pada: true };
  }
  if (pojave.some((p) => /FG/.test(p))) return { kod: 45, pada: false };
  const naoblaka: Record<string, number> = { CLR: 0, SKC: 0, NSC: 0, NCD: 0, CAVOK: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 3, OVX: 3 };
  return { kod: cover && cover in naoblaka ? (naoblaka[cover] ?? null) : null, pada: false };
}

export function izMetara(z: MetarZapis): Mjerenje | null {
  const ime = AERODROMI[z.icaoId];
  if (!ime || typeof z.temp !== 'number') return null;
  const { kod, pada } = kodIzMetara(z.wxString ?? '', z.cover);
  return { stanica: z.icaoId, ime, lat: z.lat, lon: z.lon, visina: z.elev, vrijeme: z.obsTime * 1000, temp: z.temp, kod, pada };
}

/** Najsvježije mjerenje po stanici. */
export function zadnjaMjerenja(zapisi: MetarZapis[]): Mjerenje[] {
  const po = new Map<string, Mjerenje>();
  for (const z of zapisi) {
    const m = izMetara(z);
    if (m && (po.get(m.stanica)?.vrijeme ?? 0) < m.vrijeme) po.set(m.stanica, m);
  }
  return [...po.values()];
}

export interface Izmjereno {
  /** "aerodrom Mostar" */
  gdje: string;
  /** Lokalno vrijeme mjerenja, "20:30". */
  kad: string;
}

/**
 * Prognoza s "sada" ispravljenim prema najbližoj stanici, ili ista prognoza ako
 * nijedna stanica nije dovoljno blizu, dovoljno slične visine i dovoljno svježa.
 */
export function primijeniMjerenje(
  p: Prognoza,
  mjesto: { lat: number; lon: number },
  mjerenja: Mjerenje[],
  sadMs: number,
): Prognoza {
  if (p.visina === undefined) return p;
  const visina = p.visina;
  let najbolje: { m: Mjerenje; km: number } | null = null;
  for (const m of mjerenja) {
    if (sadMs - m.vrijeme > STARO_MIN * 60_000) continue;
    if (Math.abs(m.visina - visina) > VISINSKA_RAZLIKA_M) continue;
    const km = udaljenostKm(mjesto, m);
    if (km <= DO_TEMP_KM && (!najbolje || km < najbolje.km)) najbolje = { m, km };
  }
  if (!najbolje) return p;
  const { m, km } = najbolje;

  const temp = m.temp + (m.visina - visina) * PAD_PO_M;
  const razlika = temp - p.sada.temp;
  const sada = { ...p.sada, temp, osjecaj: p.sada.osjecaj + razlika };
  let sati = p.sati;

  if (km <= DO_KISE_KM && m.kod !== null) {
    const modelPada = sada.kisaMm > 0 || jePadavina(sada.kod);
    // Kod modela se mijenja samo kad se stanica s njim ne slaže; inače je model detaljniji.
    if (m.pada !== modelPada || m.kod === 95) sada.kod = m.kod;
    sada.kisaMm = m.pada ? Math.max(sada.kisaMm, 0.1) : 0;

    const kljuc = p.sada.vrijeme.slice(0, 13);
    sati = p.sati.map((s) =>
      s.vrijeme.slice(0, 13) !== kljuc
        ? s
        : m.pada
          ? { ...s, kisaMm: Math.max(s.kisaMm, 0.1), kisaVjer: Math.max(s.kisaVjer, 60) }
          : { ...s, kisaMm: 0, kisaVjer: Math.min(s.kisaVjer, 30) },
    );
  }

  const kad = new Date(m.vrijeme + p.pomakSek * 1000).toISOString().slice(11, 16);
  return { ...p, sada, sati, izmjereno: { gdje: `aerodrom ${m.ime}`, kad } };
}
