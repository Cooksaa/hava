import type { Prognoza, Sat } from '../tipovi';
import { jePadavina, jeSnijeg } from './kodovi';
import { PRAGOVI } from './pragovi';

/* "Pada li u…?": šta je sad i šta slijedi u narednih 12 sati. */

export type KisaKod = 'pada' | 'stize' | 'suho';

export interface KisaPresuda {
  kod: KisaKod;
  vrsta: 'kisa' | 'snijeg';
  /** Sat u kojem staje. Null ako ne staje u prozoru ili se ne zna. */
  stajeOko: number | null;
  /** Pada, ali prognoza za ovaj sat više ne vidi padavine. */
  uskoroStaje: boolean;
  /** Sat u kojem stiže. */
  stizeOko: number | null;
}

const P = PRAGOVI.kisa;

const mokar = (s: Sat): boolean => s.kisaVjer >= P.vjer || s.kisaMm >= P.mm;

export function procijeniKisu(p: Prognoza): KisaPresuda {
  const kljuc = p.sada.vrijeme.slice(0, 13);
  const pocetak = Math.max(
    0,
    p.sati.findIndex((s) => s.vrijeme.slice(0, 13) === kljuc),
  );
  const prozor = p.sati.slice(pocetak, pocetak + P.prozorSati);

  const padaSad = p.sada.kisaMm > 0 || jePadavina(p.sada.kod);

  if (padaSad) {
    // Kraj tekućih padavina, a ne zadnji pljusak u cijelom prozoru.
    let n = 0;
    while (n < prozor.length && mokar(prozor[n] as Sat)) n++;
    return {
      kod: 'pada',
      vrsta: jeSnijeg(p.sada.kod) ? 'snijeg' : 'kisa',
      stajeOko: n > 0 && n < prozor.length ? (prozor[n] as Sat).sat : null,
      uskoroStaje: n === 0,
      stizeOko: null,
    };
  }

  const prva = prozor.find(mokar);
  if (prva) {
    return {
      kod: 'stize',
      vrsta: jeSnijeg(prva.kod) ? 'snijeg' : 'kisa',
      stajeOko: null,
      uskoroStaje: false,
      stizeOko: prva.sat,
    };
  }

  return { kod: 'suho', vrsta: 'kisa', stajeOko: null, uskoroStaje: false, stizeOko: null };
}
