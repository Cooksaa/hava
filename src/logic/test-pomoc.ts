import type { Dan, Prognoza, Sat } from '../tipovi';

/* Pravljenje prognoze za testove: opišeš dan funkcijom "sat → uslovi". */

export interface Uslovi {
  temp: number;
  vlaga: number;
  kisaVjer: number;
  kisaMm: number;
  kod: number;
  oblaci: number;
  vjetar: number;
  udari: number;
}

const OSNOVNO: Uslovi = {
  temp: 18,
  vlaga: 50,
  kisaVjer: 0,
  kisaMm: 0,
  kod: 1,
  oblaci: 20,
  vjetar: 8,
  udari: 15,
};

export interface DanOpis {
  /** "06:10" */
  izlazak?: string;
  /** "20:05" */
  zalazak?: string;
  uslovi: (sat: number) => Partial<Uslovi>;
}

function dodajDane(datum: string, n: number): string {
  const [g, m, d] = datum.split('-').map(Number);
  return new Date(Date.UTC(g ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

const dvije = (n: number): string => String(n).padStart(2, '0');

/**
 * @param o.sada  "2026-05-12T08:00"
 * @param o.dani  Opis dana od danas nadalje. Ako ih je manje od 7, zadnji se ponavlja.
 */
export function napraviPrognozu(o: { sada: string; dani: DanOpis[] }): Prognoza {
  const danas = o.sada.slice(0, 10);
  const sati: Sat[] = [];
  const dani: Dan[] = [];

  for (let i = 0; i < 7; i++) {
    const opis = o.dani[Math.min(i, o.dani.length - 1)];
    if (!opis) throw new Error('Treba bar jedan dan.');
    const datum = dodajDane(danas, i);
    const izlazak = opis.izlazak ?? '06:00';
    const zalazak = opis.zalazak ?? '19:00';
    const satiDana: Sat[] = [];

    for (let h = 0; h < 24; h++) {
      const u = { ...OSNOVNO, ...opis.uslovi(h) };
      const vrijeme = `${datum}T${dvije(h)}:00`;
      satiDana.push({
        vrijeme,
        datum,
        sat: h,
        ...u,
        dan: vrijeme >= `${datum}T${izlazak}` && vrijeme < `${datum}T${zalazak}`,
      });
    }

    sati.push(...satiDana);
    const podne = satiDana[12] as Sat;
    dani.push({
      datum,
      kod: podne.kod,
      tMax: Math.max(...satiDana.map((s) => s.temp)),
      tMin: Math.min(...satiDana.map((s) => s.temp)),
      kisaVjerMax: Math.max(...satiDana.map((s) => s.kisaVjer)),
      kisaMm: satiDana.reduce((zbir, s) => zbir + s.kisaMm, 0),
      vjetarMax: Math.max(...satiDana.map((s) => s.vjetar)),
      izlazak: `${datum}T${izlazak}`,
      zalazak: `${datum}T${zalazak}`,
    });
  }

  const sadSat = sati.find((s) => s.vrijeme.slice(0, 13) === o.sada.slice(0, 13));
  if (!sadSat) throw new Error(`Nema sata za ${o.sada}.`);

  return {
    pomakSek: 3600,
    sada: {
      vrijeme: o.sada,
      temp: sadSat.temp,
      osjecaj: sadSat.temp - 1,
      vlaga: sadSat.vlaga,
      kisaMm: sadSat.kisaMm,
      kod: sadSat.kod,
      dan: sadSat.dan,
      vjetar: sadSat.vjetar,
      udari: sadSat.udari,
    },
    sati,
    dani,
  };
}

/* Tipični uslovi, da scenariji budu čitljivi. */
export const SUHO: Partial<Uslovi> = { temp: 18, vlaga: 50, vjetar: 8, oblaci: 20, kod: 1 };
export const LJETO: Partial<Uslovi> = { temp: 30, vlaga: 35, vjetar: 10, oblaci: 10, kod: 0 };
export const KISA: Partial<Uslovi> = { temp: 12, vlaga: 92, kisaVjer: 80, kisaMm: 1.2, oblaci: 100, kod: 63 };
export const VLAZAN_NOVEMBAR: Partial<Uslovi> = { temp: 9, vlaga: 86, vjetar: 5, oblaci: 90, kod: 3 };
export const BURA: Partial<Uslovi> = { temp: 10, vlaga: 40, vjetar: 30, oblaci: 10, kod: 0 };
export const HLADNO_SUHO: Partial<Uslovi> = { temp: 13, vlaga: 55, vjetar: 10, oblaci: 20, kod: 1 };
export const HLADNO_SPORO: Partial<Uslovi> = { temp: 10, vlaga: 70, vjetar: 6, oblaci: 60, kod: 3 };
export const PREVLAZNO: Partial<Uslovi> = { temp: 11, vlaga: 93, vjetar: 3, oblaci: 100, kod: 45 };
