import { jeGrmljavina, jeKisa, jeMagla, jeSnijeg } from './kodovi';
import { PRAGOVI } from './pragovi';
import { minuteIz } from './vrijeme';

/* Iz koda vremena i doba dana do stanja pozadine. Boje su u CSS-u (korak 3). */

export type VrstaNeba = 'vedro' | 'oblacno' | 'kisa' | 'grmljavina' | 'magla' | 'snijeg';
export type Doba = 'dan' | 'suton' | 'noc';

export interface Nebo {
  vrsta: VrstaNeba;
  doba: Doba;
  /**
   * Gdje je sunce (danju) ili mjesec (noću) na svom putu, 0 do 1.
   * 0 je izlazak, 1 zalazak. Pozadina po tome pomjera odsjaj slijeva nadesno.
   */
  polozaj: number;
}

function vrstaIz(kod: number): VrstaNeba {
  if (jeGrmljavina(kod)) return 'grmljavina';
  if (jeSnijeg(kod)) return 'snijeg';
  if (jeKisa(kod)) return 'kisa';
  if (jeMagla(kod)) return 'magla';
  return kod >= 3 ? 'oblacno' : 'vedro';
}

const izmedju = (x: number): number => Math.min(1, Math.max(0, x));

export function stanjeNeba(u: { kod: number; vrijeme: string; izlazak: string; zalazak: string }): Nebo {
  const sad = minuteIz(u.vrijeme);
  const izlazak = minuteIz(u.izlazak);
  const zalazak = minuteIz(u.zalazak);
  const vrsta = vrstaIz(u.kod);
  const danje = sad >= izlazak && sad < zalazak;

  // Boje zore i sutona vide se samo kad nebo nije zatvoreno.
  const blizuRuba =
    Math.abs(sad - izlazak) <= PRAGOVI.nebo.sutonMin || Math.abs(sad - zalazak) <= PRAGOVI.nebo.sutonMin;
  const doba: Doba = blizuRuba && vrsta === 'vedro' ? 'suton' : danje ? 'dan' : 'noc';

  const DAN = 24 * 60;
  const noc = DAN - zalazak + izlazak;
  const polozaj = danje
    ? (sad - izlazak) / (zalazak - izlazak)
    : sad >= zalazak
      ? (sad - zalazak) / noc
      : (sad + DAN - zalazak) / noc;

  return { vrsta, doba, polozaj: izmedju(polozaj) };
}
