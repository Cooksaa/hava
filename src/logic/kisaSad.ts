import type { Korak } from './nowcast';

/*
 * Kiša u naredna 2 sata, jednom rečenicom: "Kiša za ~25 min, traje ~40 min."
 *
 * Provjera unazad na radaru nad BiH (novembar 2026): sa pragom 40 %
 * pogađa ~80 % kiše za 10 min, ~60 % za 30 min, a za sat samo ~20 %. Zato poslije
 * sat vremena govorimo "moguća", a ne obećavamo.
 */

export type VrstaKise = 'pada' | 'stize' | 'moguca' | 'suho';

export interface KisaSad {
  vrsta: VrstaKise;
  recenica: string;
  /** Minuta od sad kad počinje (stize, moguca) ili prestaje (pada); null = ne u 2 sata. */
  min: number | null;
  /** "za ~25 min", "svaki čas", "oko 23:40" za taj trenutak; null kad ga nema. */
  kada: string | null;
}

/** Od ove vjerovatnoće kažemo "pada" / "kiša za…". */
export const KISA = 0.4;
/** Od ove "moguća", ali samo za prvi sat. */
const MOGUCA = 0.2;
const SAT = 60;

type Jacina = 'slaba' | 'umjerena' | 'jaka';
const jacina = (mmh: number): Jacina => (mmh < 1 ? 'slaba' : mmh < 4 ? 'umjerena' : 'jaka');

/** "kiša", "jaka kiša", "slab snijeg"… (malim slovom). */
function sta(j: Jacina, snijeg: boolean, saSlabom: boolean): string {
  if (snijeg) return j === 'jaka' ? 'jak snijeg' : j === 'slaba' && saSlabom ? 'slab snijeg' : 'snijeg';
  return j === 'jaka' ? 'jaka kiša' : j === 'slaba' && saSlabom ? 'slaba kiša' : 'kiša';
}

const moguce = (snijeg: boolean): string => (snijeg ? 'Moguć snijeg' : 'Moguća kiša');

const veliko = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Sat u Sarajevu, zaokružen na 10 minuta: "23:40". */
export function satOko(ms: number): string {
  const z = Math.round(ms / 600_000) * 600_000;
  return new Date(z).toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sarajevo' });
}

/** "za ~25 min", "svaki čas", "oko 23:40". */
function kad(min: number, sad: number): string {
  if (min <= 10) return 'svaki čas';
  if (min < SAT) return `za ~${min} min`;
  return `oko ${satOko(sad + min * 60_000)}`;
}

/** Prvi korak od `od` na kojem prestaje: dva uzastopna ispod praga (da jedna rupa ne prekine kišu). */
function prestaje(koraci: Korak[], od: number): number | null {
  for (let i = od; i < koraci.length; i++) {
    if (koraci[i]!.vjer < KISA && (koraci[i + 1]?.vjer ?? 0) < KISA) return koraci[i]!.min;
  }
  return null;
}

function trajanje(min: number): string {
  if (min < 20) return 'kratko';
  if (min < SAT) return `traje ~${Math.round(min / 10) * 10} min`;
  if (min < 90) return 'traje oko sat';
  return 'traje dugo';
}

/**
 * @param koraci iz prognozaTacke, svakih 5 min od sad, do 2 sata
 * @param sad ms, za "oko 23:40"
 */
export function kisaSad(koraci: Korak[], sad: number): KisaSad {
  const kisni = koraci.filter((k) => k.vjer >= KISA);
  const snijeg = kisni.filter((k) => k.snijeg).length * 2 > kisni.length;

  // Pada sad (ili za 5 min, što je isto).
  if ((koraci[0]?.vjer ?? 0) >= KISA || (koraci[1]?.vjer ?? 0) >= KISA) {
    const prvih = koraci.slice(0, 3).filter((k) => k.vjer >= KISA);
    const j = jacina(prvih.reduce((s, k) => s + k.mmh, 0) / Math.max(1, prvih.length));
    const kraj = prestaje(koraci, 1);
    const pocetak = `Pada ${sta(j, snijeg, true)}`;
    if (kraj === null) return { vrsta: 'pada', min: null, kada: null, recenica: `${pocetak}, ne staje u naredna 2 sata.` };
    return { vrsta: 'pada', min: kraj, kada: kad(kraj, sad), recenica: `${pocetak}, staje ${kad(kraj, sad)}.` };
  }

  const prvi = koraci.findIndex((k) => k.vjer >= KISA);
  if (prvi >= 0) {
    const k = koraci[prvi]!;
    const j = jacina(k.mmh);
    if (k.min >= SAT) {
      return { vrsta: 'moguca', min: k.min, kada: kad(k.min, sad), recenica: `${moguce(snijeg)} ${kad(k.min, sad)}.` };
    }
    const kraj = prestaje(koraci, prvi + 1);
    const dodatak = kraj === null ? '' : `, ${trajanje(kraj - k.min)}`;
    const kada = k.min <= 10 ? 'počinje svaki čas' : kad(k.min, sad);
    return { vrsta: 'stize', min: k.min, kada: kad(k.min, sad), recenica: `${veliko(sta(j, snijeg, false))} ${kada}${dodatak}.` };
  }

  const moguca = koraci.find((k) => k.min <= SAT && k.vjer >= MOGUCA);
  if (moguca) {
    return {
      vrsta: 'moguca',
      min: moguca.min,
      kada: kad(moguca.min, sad),
      recenica: `${moguce(moguca.snijeg)} ${kad(moguca.min, sad)}.`,
    };
  }
  return { vrsta: 'suho', min: null, kada: null, recenica: 'Sljedeća 2 sata suho.' };
}

/**
 * Veš kaže "prostri", a radar vidi kišu u narednom satu: radar ima prednost,
 * jer je satna prognoza za to pregruba. Null kad radar ne mijenja ništa.
 */
export function vesPremaRadaru(
  ves: { dan: 'danas' | 'sutra'; nivo: 'moze' | 'pazi' | 'nemoj'; odmahSuho: boolean },
  kisa: KisaSad | null,
): string | null {
  if (!kisa || ves.dan !== 'danas' || ves.nivo === 'nemoj' || !ves.odmahSuho) return null;
  if (kisa.vrsta === 'pada') {
    return kisa.kada ? `Pada, staje ${kisa.kada}. Ne prostiri do tad.` : 'Pada. Ne prostiri dok ne stane.';
  }
  if (kisa.vrsta === 'stize' && kisa.min !== null && kisa.min <= SAT) return `Kiša ${kisa.kada}: ne prostiri sad.`;
  return null;
}
