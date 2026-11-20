import { describe, expect, it } from 'vitest';
import { kisaSad, vesPremaRadaru } from './kisaSad';
import type { Korak } from './nowcast';

// 20.11.2026. 22:00 u Sarajevu
const SAD = Date.parse('2026-11-20T21:00:00Z');

/** Koraci od 0 do 120 min; `kisa(min)` vraća [vjer, mm/h] ili null za suho. */
function koraci(kisa: (min: number) => [number, number] | null, snijeg = false): Korak[] {
  const k: Korak[] = [];
  for (let min = 0; min <= 120; min += 5) {
    const v = kisa(min);
    k.push({ min, vjer: v?.[0] ?? 0, mmh: v?.[1] ?? 0, snijeg: v ? snijeg : false });
  }
  return k;
}

describe('kisaSad', () => {
  it('suho', () => {
    expect(kisaSad(koraci(() => null), SAD)).toEqual({ vrsta: 'suho', min: null, kada: null, recenica: 'Sljedeća 2 sata suho.' });
  });

  it('kiša stiže i prestaje', () => {
    const r = kisaSad(koraci((m) => (m >= 25 && m < 65 ? [0.8, 2] : null)), SAD);
    expect(r).toEqual({ vrsta: 'stize', min: 25, kada: 'za ~25 min', recenica: 'Kiša za ~25 min, traje ~40 min.' });
  });

  it('jaka kiša koja ne prestaje', () => {
    expect(kisaSad(koraci((m) => (m >= 40 ? [0.9, 8] : null)), SAD).recenica).toBe('Jaka kiša za ~40 min.');
  });

  it('počinje svaki čas', () => {
    expect(kisaSad(koraci((m) => (m >= 10 && m < 20 ? [0.6, 2] : null)), SAD).recenica).toBe(
      'Kiša počinje svaki čas, kratko.',
    );
  });

  it('pada i staje', () => {
    const r = kisaSad(koraci((m) => (m < 35 ? [0.9, 0.5] : null)), SAD);
    expect(r).toEqual({ vrsta: 'pada', min: 35, kada: 'za ~35 min', recenica: 'Pada slaba kiša, staje za ~35 min.' });
    expect(kisaSad(koraci((m) => (m < 80 ? [0.9, 2] : null)), SAD).recenica).toBe('Pada kiša, staje oko 23:20.');
  });

  it('pada i ne staje', () => {
    expect(kisaSad(koraci(() => [0.9, 6]), SAD).recenica).toBe('Pada jaka kiša, ne staje u naredna 2 sata.');
  });

  it('jedan prazan korak ne prekida kišu', () => {
    const r = kisaSad(koraci((m) => (m === 15 || m >= 50 ? null : [0.9, 2])), SAD);
    expect(r.min).toBe(50);
  });

  it('snijeg', () => {
    expect(kisaSad(koraci(() => [0.9, 0.5], true), SAD).recenica).toBe('Pada slab snijeg, ne staje u naredna 2 sata.');
    expect(kisaSad(koraci((m) => (m >= 30 ? [0.9, 2] : null), true), SAD).recenica).toBe('Snijeg za ~30 min.');
  });

  it('poslije sat vremena samo "moguća"', () => {
    const r = kisaSad(koraci((m) => (m >= 70 ? [0.9, 2] : null)), SAD);
    expect(r).toEqual({ vrsta: 'moguca', min: 70, kada: 'oko 23:10', recenica: 'Moguća kiša oko 23:10.' });
  });

  it('rub kiše u prvom satu = moguća', () => {
    expect(kisaSad(koraci((m) => (m >= 20 && m < 40 ? [0.3, 1] : null)), SAD).recenica).toBe('Moguća kiša za ~20 min.');
    // Slabi rub tek poslije sata se ne pominje.
    expect(kisaSad(koraci((m) => (m >= 80 ? [0.3, 1] : null)), SAD).vrsta).toBe('suho');
  });
});

describe('vesPremaRadaru', () => {
  const ves = { dan: 'danas' as const, nivo: 'moze' as const, odmahSuho: true };
  const stize = kisaSad(koraci((m) => (m >= 25 ? [0.8, 2] : null)), SAD);

  it('kiša za pola sata pobija "prostri"', () => {
    expect(vesPremaRadaru(ves, stize)).toBe('Kiša za ~25 min: ne prostiri sad.');
    expect(vesPremaRadaru(ves, kisaSad(koraci((m) => (m < 35 ? [0.9, 2] : null)), SAD))).toBe(
      'Pada, staje za ~35 min. Ne prostiri do tad.',
    );
  });

  it('ne miješa se kad veš ionako ne ide vani ili je riječ o sutra', () => {
    expect(vesPremaRadaru({ ...ves, nivo: 'nemoj' }, stize)).toBeNull();
    expect(vesPremaRadaru({ ...ves, dan: 'sutra' }, stize)).toBeNull();
    expect(vesPremaRadaru({ ...ves, odmahSuho: false }, stize)).toBeNull();
    expect(vesPremaRadaru(ves, kisaSad(koraci(() => null), SAD))).toBeNull();
    expect(vesPremaRadaru(ves, null)).toBeNull();
  });
});
