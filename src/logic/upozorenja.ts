import { lokalno } from './sarajevo';

/*
 * Službena upozorenja FHMZ BiH i RHMZ RS, preko MeteoAlarma (CC BY 4.0).
 *
 * Feed: https://feeds.meteoalarm.org/api/v1/warnings/feeds-bosnia-herzegovina
 * BiH je podijeljena na 10 regija (EMMA_ID BA001–BA010). Mjesto pripada regiji
 * čiji je grad najbliži; dalje od ~60 km od svih (Beograd) nema upozorenja. Mjesta van
 * BiH bliže od toga (Split, Dubrovnik) isključuje oznaka mjesta `bih` (tipovi.ts).
 *
 * Zavodi izdaju upozorenje za isti dan više puta (dan, dva unaprijed, pa jutro tog
 * dana), bez oznake da novo zamjenjuje staro. Zato za svaku vrstu i dan početka
 * vrijedi samo najnovije izdato.
 */

export type Nivo = 2 | 3 | 4; // žuto, narandžasto, crveno (1 = zeleno, ne objavljuje se)

export interface Upozorenje {
  regija: string;
  vrsta: string;
  nivo: Nivo;
  /** ms, UTC */
  od: number;
  do: number;
  opis: string;
  uputa: string;
  izvor: string;
  izdato: number;
}

interface CapInfo {
  language?: string;
  description?: string;
  instruction?: string;
  senderName?: string;
  onset?: string;
  effective?: string;
  expires?: string;
  parameter?: { valueName: string; value: string }[];
  area?: { areaDesc?: string; geocode?: { valueName: string; value: string }[] }[];
}

export interface MaZapis {
  alert?: { status?: string; msgType?: string; sent?: string; info?: CapInfo[] };
}

export const REGIJE: Record<string, { ime: string; lat: number; lon: number }> = {
  BA001: { ime: 'Bihać', lat: 44.816, lon: 15.871 },
  BA002: { ime: 'Prijedor', lat: 44.98, lon: 16.713 },
  BA003: { ime: 'Banja Luka', lat: 44.772, lon: 17.191 },
  BA004: { ime: 'Tuzla', lat: 44.538, lon: 18.676 },
  BA005: { ime: 'Livno', lat: 43.827, lon: 17.008 },
  BA006: { ime: 'Sarajevo', lat: 43.856, lon: 18.413 },
  BA007: { ime: 'Višegrad', lat: 43.782, lon: 19.288 },
  BA008: { ime: 'Mostar', lat: 43.344, lon: 17.808 },
  BA009: { ime: 'Foča', lat: 43.506, lon: 18.776 },
  BA010: { ime: 'Trebinje', lat: 42.712, lon: 18.344 },
};

const NAJDALJE_KM = 60;

/** Regija za mjesto, ili null ako je mjesto daleko od BiH. */
export function regijaZa(lat: number, lon: number): string | null {
  let najbliza: string | null = null;
  let najmanje = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const [id, r] of Object.entries(REGIJE)) {
    const km = 111 * Math.hypot(r.lat - lat, (r.lon - lon) * k);
    if (km < najmanje) {
      najmanje = km;
      najbliza = id;
    }
  }
  return najmanje <= NAJDALJE_KM ? najbliza : null;
}

const VRSTE: Record<number, string> = {
  1: 'vjetar',
  2: 'snijeg i led',
  3: 'grmljavina',
  4: 'magla',
  5: 'vrućina',
  6: 'hladnoća',
  7: 'nevrijeme na obali',
  8: 'šumski požari',
  9: 'lavine',
  10: 'kiša',
  11: 'poplave',
  12: 'kiša i poplave',
};

const param = (i: CapInfo, ime: string): string | undefined => i.parameter?.find((p) => p.valueName === ime)?.value;
const vrijeme = (s: string | undefined): number => (s ? Date.parse(s) : NaN);

/** Lokalni datum (Sarajevo) početka, za grupisanje po danu. Bez Intl-a: radi i u pozadini. */
const danPocetka = (ms: number): string => lokalno(ms).datum;

/** Sirovi feed → upozorenja za regiju koja još traju ili tek dolaze, najozbiljnija prva. */
export function upozorenjaZa(zapisi: MaZapis[], regija: string, sad: number): Upozorenje[] {
  const kandidati: Upozorenje[] = [];
  for (const z of zapisi) {
    const a = z.alert;
    if (!a || a.status !== 'Actual' || a.msgType === 'Cancel') continue;
    const info = a.info?.find((i) => i.language === 'bs') ?? a.info?.[0];
    if (!info) continue;
    const uRegiji = info.area?.some((ar) => ar.geocode?.some((g) => g.valueName === 'EMMA_ID' && g.value === regija));
    if (!uRegiji) continue;

    const nivo = Number(param(info, 'awareness_level')?.split(';')[0]);
    const vrsta = VRSTE[Number(param(info, 'awareness_type')?.split(';')[0])];
    const od = vrijeme(info.onset ?? info.effective);
    const do_ = vrijeme(info.expires);
    if (!(nivo >= 2 && nivo <= 4) || !vrsta || Number.isNaN(od) || Number.isNaN(do_) || do_ <= sad) continue;

    kandidati.push({
      regija: REGIJE[regija]?.ime ?? regija,
      vrsta,
      nivo: nivo as Nivo,
      od,
      do: do_,
      // "40-80 km/h" → "40–80 km/h"
      opis: info.description?.trim().replace(/(\d)\s*-\s*(\d)/g, '$1–$2') ?? '',
      uputa: info.instruction?.trim() ?? '',
      izvor: info.senderName?.trim() ?? '',
      izdato: vrijeme(a.sent) || 0,
    });
  }

  // Za istu vrstu i dan važi samo najnovije izdato.
  const najnovije = new Map<string, Upozorenje>();
  for (const u of kandidati) {
    const kljuc = `${u.vrsta}|${danPocetka(u.od)}`;
    const staro = najnovije.get(kljuc);
    if (!staro || u.izdato > staro.izdato) najnovije.set(kljuc, u);
  }

  return [...najnovije.values()].sort((a, b) => {
    const aTraje = a.od <= sad ? 1 : 0;
    const bTraje = b.od <= sad ? 1 : 0;
    return bTraje - aTraje || b.nivo - a.nivo || a.od - b.od;
  });
}

const BOJA: Record<Nivo, string> = { 2: 'Žuto', 3: 'Narandžasto', 4: 'Crveno' };
export const nivoIme = (n: Nivo): string => BOJA[n];

function sat(ms: number): { dan: string; sat: number; minut: number } {
  const l = lokalno(ms);
  return { dan: l.datum, sat: l.sat, minut: l.minut };
}

/** "danas od 12h do ponoći", "sutra cijeli dan", "traje do 20h". */
export function kadRecenica(u: Upozorenje, sad: number): string {
  const s = sat(sad);
  const od = sat(u.od);
  const kraj = sat(u.do);
  const sutra = sat(sad + 864e5).dan;
  const imeDana = (dan: string): string => (dan === s.dan ? 'danas' : dan === sutra ? 'sutra' : `${Number(dan.slice(8))}.${Number(dan.slice(5, 7))}.`);
  // 23:59 je u feedu "do kraja dana".
  const doPonoci = kraj.sat === 23 && kraj.minut >= 59;
  const doKad = doPonoci ? 'ponoći' : `${kraj.sat}h`;

  if (u.od <= sad) return kraj.dan === s.dan ? `traje do ${doKad}` : `traje do ${imeDana(kraj.dan)}`;
  const dan = imeDana(od.dan);
  if (od.sat === 0 && doPonoci && od.dan === kraj.dan) return `${dan} cijeli dan`;
  return od.dan === kraj.dan ? `${dan} od ${od.sat}h do ${doKad}` : `${dan} od ${od.sat}h`;
}
