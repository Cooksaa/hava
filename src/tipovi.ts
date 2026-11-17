/*
 * Oblik prognoze koji koristi cijela aplikacija. API sloj (korak 2) pretvara
 * Open-Meteo odgovor u ovo, a logika i UI ne znaju ništa o Open-Meteu.
 *
 * Sva vremena su lokalna za lokaciju, u obliku "2026-11-16T13:00".
 * Sate čitamo iz stringa, bez Date objekta, da nema grešaka s vremenskom zonom.
 */

export interface Sat {
  vrijeme: string;
  datum: string;
  sat: number;
  temp: number;
  /** Relativna vlaga, %. */
  vlaga: number;
  /** Vjerovatnoća padavina, %. */
  kisaVjer: number;
  /** Padavine u tom satu, mm. */
  kisaMm: number;
  /** WMO kod vremena. */
  kod: number;
  /** Oblačnost, %. */
  oblaci: number;
  /** Vjetar na 10 m, km/h. */
  vjetar: number;
  udari: number;
  dan: boolean;
}

export interface Dan {
  datum: string;
  kod: number;
  tMax: number;
  tMin: number;
  kisaVjerMax: number;
  kisaMm: number;
  vjetarMax: number;
  izlazak: string;
  zalazak: string;
}

export interface Sada {
  vrijeme: string;
  temp: number;
  osjecaj: number;
  vlaga: number;
  kisaMm: number;
  kod: number;
  dan: boolean;
  vjetar: number;
  udari: number;
}

export interface Prognoza {
  /** Pomak lokalnog vremena mjesta od UTC, u sekundama. */
  pomakSek: number;
  sada: Sada;
  sati: Sat[];
  dani: Dan[];
  /** Nadmorska visina mjesta (m), za poređenje sa stanicom. Starije spremljene prognoze je nemaju. */
  visina?: number;
  /** "Sada" je ispravljeno mjerenjem sa stanice (logic/mjerenje.ts). */
  izmjereno?: { gdje: string; kad: string };
}

export interface Mjesto {
  ime: string;
  lat: number;
  lon: number;
}
