import type { Prognoza } from '../tipovi';

/*
 * Stara prognoza (bez interneta, ili app otvoren satima): "sada" je slika trenutka
 * kad je dohvaćena. Da veš, nebo i lista sati ne ostanu zamrznuti u tom trenutku,
 * "sada" se uzima iz satne prognoze za tekući sat.
 */

/** Poslije koliko minuta "sada" iz odgovora više ne vrijedi. */
const VRIJEDI_MIN = 30;

/** Lokalno vrijeme mjesta, "2026-11-16T13:05". */
export function lokalnoVrijeme(sadMs: number, pomakSek: number): string {
  return new Date(sadMs + pomakSek * 1000).toISOString().slice(0, 16);
}

/**
 * Prognoza usklađena sa sadašnjim satom.
 * Vraća null ako je toliko stara da više ne pokriva sadašnji sat.
 */
export function uskladiSaSatom(p: Prognoza, spremljenoMs: number, sadMs: number): Prognoza | null {
  if (sadMs - spremljenoMs < VRIJEDI_MIN * 60_000) return p;

  const vrijeme = lokalnoVrijeme(sadMs, p.pomakSek);
  const danas = vrijeme.slice(0, 10);
  const sat = p.sati.find((s) => s.vrijeme.slice(0, 13) === vrijeme.slice(0, 13));
  // Ostatak aplikacije računa da je prvi dan u listi današnji.
  const dani = p.dani.filter((d) => d.datum >= danas);
  if (!sat || dani[0]?.datum !== danas) return null;

  return {
    ...p,
    dani,
    sada: {
      vrijeme,
      temp: sat.temp,
      // Satna prognoza nema "osjećaj", pa je isti kao temperatura.
      osjecaj: sat.temp,
      vlaga: sat.vlaga,
      kisaMm: sat.kisaMm,
      kod: sat.kod,
      dan: sat.dan,
      vjetar: sat.vjetar,
      udari: sat.udari,
    },
  };
}
