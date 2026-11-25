import { jeGrmljavina, jeMagla, jePadavina, jeSnijeg } from './kodovi';
import { PRAGOVI } from './pragovi';
import { lokalno } from './sarajevo';

/*
 * Widget na početnom ekranu telefona (android/.../HavaWidget.java).
 *
 * Widget ne zna računati, pa mu unaprijed spremimo kadar za svaki od narednih
 * 24 sata: temperatura, ikona, dvije kratke rečenice. On sam izabere kadar za
 * sat u kojem jeste, pa je tačan i kad Havu dugo ne otvaraš. Svježe kadrove
 * pravi aplikacija kad se otvori i provjera u pozadini svakih ~15 minuta.
 *
 * Bez Intl-a: isti kod radi u pozadinskoj provjeri (src/pozadina).
 */

export interface SatWidgeta {
  /** ms, početak sata */
  t: number;
  temp: number;
  kod: number;
  /** mm u satu */
  kisaMm: number;
  /** % (0 kad ga model nema) */
  kisaVjer: number;
  dan: boolean;
}

export type IkonaWidgeta = 'vedro-dan' | 'vedro-noc' | 'oblak-dan' | 'oblak-noc' | 'oblak' | 'kisa' | 'snijeg' | 'grmljavina' | 'magla';

export interface KadarWidgeta {
  t: number;
  temp: number;
  ikona: IkonaWidgeta;
  /** "Oblačno" */
  opis: string;
  /** "Kiša oko 15h", "Pada do 18h", "Suho narednih 12 sati" */
  izgled: string;
}

export interface PodaciWidgeta {
  mjesto: string;
  /** ms, kad su kadrovi napravljeni */
  izracunato: number;
  kadrovi: KadarWidgeta[];
  /** Rečenica za veš, samo za taj dan ("2026-11-26"). */
  ves?: { datum: string; tekst: string };
}

const OPIS: Record<number, string> = {
  0: 'Vedro',
  1: 'Pretežno vedro',
  2: 'Djelimično oblačno',
  3: 'Oblačno',
  45: 'Magla',
  48: 'Magla',
  51: 'Rosulja',
  53: 'Rosulja',
  55: 'Rosulja',
  56: 'Ledena rosulja',
  57: 'Ledena rosulja',
  61: 'Slaba kiša',
  63: 'Kiša',
  65: 'Jaka kiša',
  66: 'Ledena kiša',
  67: 'Ledena kiša',
  71: 'Slab snijeg',
  73: 'Snijeg',
  75: 'Jak snijeg',
  77: 'Snijeg',
  80: 'Pljusak',
  81: 'Pljusak',
  82: 'Jak pljusak',
  85: 'Snijeg',
  86: 'Jak snijeg',
  95: 'Grmljavina',
  96: 'Grmljavina s gradom',
  99: 'Grmljavina s gradom',
};

export function ikonaWidgeta(kod: number, dan: boolean): IkonaWidgeta {
  if (jeGrmljavina(kod)) return 'grmljavina';
  if (jeSnijeg(kod)) return 'snijeg';
  if (jePadavina(kod) || (kod >= 51 && kod <= 57)) return 'kisa';
  if (jeMagla(kod)) return 'magla';
  if (kod === 3) return 'oblak';
  if (kod === 1 || kod === 2) return dan ? 'oblak-dan' : 'oblak-noc';
  return dan ? 'vedro-dan' : 'vedro-noc';
}

const mokar = (s: SatWidgeta): boolean =>
  s.kisaMm >= PRAGOVI.kisa.mm || s.kisaVjer >= PRAGOVI.kisa.vjer || jePadavina(s.kod);

/** "Pada do 16h", "Kiša oko 15h", "Suho narednih 12 sati" za sat `i`. */
function izgled(sati: SatWidgeta[], i: number): string {
  const s = sati[i]!;
  const prozor = sati.slice(i + 1, i + 1 + PRAGOVI.kisa.prozorSati);
  const h = (x: SatWidgeta): number => lokalno(x.t).sat;
  if (mokar(s)) {
    const sta = jeSnijeg(s.kod) ? 'Snijeg' : 'Pada';
    const suh = prozor.find((x) => !mokar(x));
    return suh ? `${sta} do ${h(suh)}h` : `${sta} i dalje`;
  }
  const prvi = prozor.find(mokar);
  if (prvi) return `${jeSnijeg(prvi.kod) ? 'Snijeg' : 'Kiša'} oko ${h(prvi)}h`;
  return prozor.length >= PRAGOVI.kisa.prozorSati ? 'Suho narednih 12 sati' : 'Suho';
}

/** Kadrovi od sata u kojem je `od`, `koliko` sati unaprijed. */
export function kadroviWidgeta(sati: SatWidgeta[], od: number, koliko = 24): KadarWidgeta[] {
  const prvi = sati.findIndex((s) => s.t + 3600e3 > od);
  if (prvi < 0) return [];
  const out: KadarWidgeta[] = [];
  for (let i = prvi; i < sati.length && out.length < koliko; i++) {
    const s = sati[i]!;
    out.push({
      t: s.t,
      temp: Math.round(s.temp),
      ikona: ikonaWidgeta(s.kod, s.dan),
      opis: OPIS[s.kod] ?? 'Promjenjivo',
      izgled: izgled(sati, i),
    });
  }
  return out;
}

/** Sati iz prognoze aplikacije (lokalno vrijeme mjesta) u oblik za widget. */
export function satiIzPrognoze(p: {
  pomakSek: number;
  sati: { vrijeme: string; temp: number; kod: number; kisaMm: number; kisaVjer: number; dan: boolean }[];
}): SatWidgeta[] {
  return p.sati.map((s) => ({
    t: Date.parse(`${s.vrijeme}:00Z`) - p.pomakSek * 1000,
    temp: s.temp,
    kod: s.kod,
    kisaMm: s.kisaMm,
    kisaVjer: s.kisaVjer,
    dan: s.dan,
  }));
}
