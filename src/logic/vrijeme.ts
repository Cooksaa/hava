/* Pomoćne funkcije za vremena oblika "2026-11-16T13:00". */

export const datumIz = (t: string): string => t.slice(0, 10);
export const satIz = (t: string): number => Number(t.slice(11, 13));
export const minuteIz = (t: string): number => satIz(t) * 60 + Number(t.slice(14, 16));

function utc(datum: string): number {
  const [g, m, d] = datum.split('-').map(Number);
  return Date.UTC(g ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** 0 = nedjelja … 6 = subota. */
export const danUSedmici = (datum: string): number => new Date(utc(datum)).getUTCDay();

/** Koliko je dana `b` poslije `a`. */
export const razlikaDana = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 86_400_000);
