import { describe, expect, it } from 'vitest';
import { kategorija, zrakSad, type Zrak } from './zrak';

function zrak(aqi: (number | null)[]): Zrak {
  return {
    sati: aqi.map((_, i) => `2026-11-19T${String(12 + i).padStart(2, '0')}:00`),
    aqi,
    pm25: aqi.map((a) => (a == null ? null : a / 2)),
    pm10: aqi.map(() => 10),
  };
}

describe('zrak', () => {
  it('kategorije po EAQI', () => {
    expect([0, 19, 20, 45, 65, 85, 140].map(kategorija)).toEqual([0, 0, 1, 2, 3, 4, 5]);
  });

  it('sada dobar', () => {
    const z = zrakSad(zrak([12, 14, 15]), '2026-11-19T12:40');
    expect(z).toMatchObject({ kategorija: 0, aqi: 12, pm25: 6, recenica: 'Zrak je dobar.', savjet: '' });
  });

  it('uveče se navuče smog', () => {
    const z = zrakSad(zrak([15, 25, 30, 50, 70, 75]), '2026-11-19T12:10');
    expect(z?.recenica).toBe('Zrak je dobar, oko 16h loš.');
    expect(z?.savjet).toBe('Ne trči vani, provjetravaj kratko.');
  });

  it('blago pogoršanje (prihvatljiv) se ne pominje', () => {
    expect(zrakSad(zrak([15, 25, 30]), '2026-11-19T12:00')?.recenica).toBe('Zrak je dobar.');
  });

  it('bez podatka za taj sat: ništa', () => {
    expect(zrakSad(zrak([null, 20]), '2026-11-19T12:00')).toBeNull();
    expect(zrakSad(zrak([20]), '2026-11-20T12:00')).toBeNull();
  });
});
