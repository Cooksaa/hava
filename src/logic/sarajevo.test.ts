import { describe, expect, it } from 'vitest';
import { lokalno, pomak } from './sarajevo';

/** Isto preko Intl-a, za poređenje. */
function intl(ms: number): { datum: string; sat: number; minut: number } {
  const f = (o: Intl.DateTimeFormatOptions): string =>
    new Date(ms).toLocaleString('sv-SE', { timeZone: 'Europe/Sarajevo', ...o });
  return {
    datum: f({ year: 'numeric', month: '2-digit', day: '2-digit' }),
    sat: Number(f({ hour: '2-digit', hour12: false })),
    minut: Number(f({ minute: '2-digit' })),
  };
}

describe('sarajevo', () => {
  it('ljeto i zima', () => {
    expect(pomak(Date.parse('2026-07-01T12:00:00Z'))).toBe(120);
    expect(pomak(Date.parse('2026-11-23T12:00:00Z'))).toBe(60);
  });

  it('prelazi: 29.3.2026. i 25.10.2026. u 01:00 UTC', () => {
    expect(pomak(Date.parse('2026-03-29T00:59:00Z'))).toBe(60);
    expect(pomak(Date.parse('2026-03-29T01:00:00Z'))).toBe(120);
    expect(pomak(Date.parse('2026-10-25T00:59:00Z'))).toBe(120);
    expect(pomak(Date.parse('2026-10-25T01:00:00Z'))).toBe(60);
  });

  it('isto kao Intl, svakih 37 sati kroz tri godine', () => {
    const od = Date.parse('2025-01-01T00:00:00Z');
    for (let ms = od; ms < od + 3 * 365 * 864e5; ms += 37 * 3600e3 + 7 * 60e3) {
      const l = lokalno(ms);
      expect({ datum: l.datum, sat: l.sat, minut: l.minut }).toEqual(intl(ms));
    }
  });
});
