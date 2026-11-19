/*
 * Kvalitet zraka: evropski indeks (EAQI), procjena modela CAMS preko Open-Meteo.
 *
 * Model ima mrežu od ~11 km, pa smog u uskim kotlinama (Sarajevo, Tuzla, Zenica) vidi
 * grublje nego stanice. Upoređen sa senzorima u Tuzli prošle zime, dane smoga je
 * pogađao, ali ne sat po sat. Zato kategorija riječima, ne broj.
 */

export interface Zrak {
  /** Lokalno vrijeme sata, "2026-11-19T15:00". */
  sati: string[];
  aqi: (number | null)[];
  pm25: (number | null)[];
  pm10: (number | null)[];
}

export type Kategorija = 0 | 1 | 2 | 3 | 4 | 5;

/** EAQI granice: 0–20 dobar, 20–40 prihvatljiv, 40–60 umjeren, 60–80 loš, 80–100 vrlo loš, više izuzetno loš. */
export const kategorija = (aqi: number): Kategorija =>
  aqi < 20 ? 0 : aqi < 40 ? 1 : aqi < 60 ? 2 : aqi < 80 ? 3 : aqi < 100 ? 4 : 5;

export const KATEGORIJE = ['dobar', 'prihvatljiv', 'umjeren', 'loš', 'vrlo loš', 'izuzetno loš'] as const;

const SAVJET: Record<Kategorija, string> = {
  0: '',
  1: '',
  2: 'Osjetljivi neka ne pretjeruju vani.',
  3: 'Ne trči vani, provjetravaj kratko.',
  4: 'Ostani unutra koliko možeš.',
  5: 'Ostani unutra, prozori zatvoreni.',
};

export interface ZrakSad {
  kategorija: Kategorija;
  aqi: number;
  pm25: number | null;
  pm10: number | null;
  /** Jedna rečenica: "Zrak je dobar, oko 19h loš." */
  recenica: string;
  savjet: string;
}

/** Koliko sati unaprijed gledamo pogoršanje (smog se navuče uveče). */
const NAPRIJED = 12;

/**
 * @param sad lokalno vrijeme mjesta, "2026-11-19T15:20"
 * @returns null ako za taj sat nema podatka
 */
export function zrakSad(z: Zrak, sad: string): ZrakSad | null {
  const kljuc = sad.slice(0, 13);
  const i = z.sati.findIndex((t) => t.slice(0, 13) === kljuc);
  const aqi = i >= 0 ? z.aqi[i] : null;
  if (i < 0 || aqi == null) return null;

  const k = kategorija(aqi);
  let gore: { k: Kategorija; sat: number } | null = null;
  for (let j = i + 1; j <= i + NAPRIJED && j < z.sati.length; j++) {
    const a = z.aqi[j];
    if (a == null) continue;
    const kj = kategorija(a);
    // Pominje se tek kad pređe u "umjeren" ili gore, i bar za korak gore od sadašnjeg.
    if (kj > k && kj >= 2 && (!gore || kj > gore.k)) gore = { k: kj, sat: Number(z.sati[j]!.slice(11, 13)) };
  }

  const recenica = gore
    ? `Zrak je ${KATEGORIJE[k]}, oko ${gore.sat}h ${KATEGORIJE[gore.k]}.`
    : `Zrak je ${KATEGORIJE[k]}.`;
  return {
    kategorija: k,
    aqi: Math.round(aqi),
    pm25: z.pm25[i] ?? null,
    pm10: z.pm10[i] ?? null,
    recenica,
    savjet: SAVJET[Math.max(k, gore?.k ?? 0) as Kategorija],
  };
}
