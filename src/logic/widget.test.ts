import { describe, expect, it } from 'vitest';
import { ikonaWidgeta, kadroviWidgeta, satiIzPrognoze, type SatWidgeta } from './widget';

// 26.11.2026. 10:00 u Sarajevu = 09:00 UTC
const T0 = Date.parse('2026-11-26T09:00:00Z');

function sati(f: (i: number) => Partial<SatWidgeta>, n = 30): SatWidgeta[] {
  return Array.from({ length: n }, (_, i) => ({
    t: T0 + i * 3600e3,
    temp: 12,
    kod: 1,
    kisaMm: 0,
    kisaVjer: 0,
    dan: true,
    ...f(i),
  }));
}

describe('kadroviWidgeta', () => {
  it('počinje od sata u kojem smo, 24 kadra', () => {
    const k = kadroviWidgeta(sati(() => ({})), T0 + 2.5 * 3600e3);
    expect(k).toHaveLength(24);
    expect(k[0]!.t).toBe(T0 + 2 * 3600e3);
  });

  it('suho, pa kiša oko 15h', () => {
    const k = kadroviWidgeta(sati((i) => (i >= 5 ? { kod: 63, kisaMm: 2 } : {})), T0);
    expect(k[0]).toMatchObject({ opis: 'Pretežno vedro', izgled: 'Kiša oko 15h', ikona: 'oblak-dan', temp: 12 });
    expect(k[5]).toMatchObject({ opis: 'Kiša', izgled: 'Pada i dalje', ikona: 'kisa' });
  });

  it('pada pa staje', () => {
    const k = kadroviWidgeta(sati((i) => (i < 3 ? { kod: 61, kisaMm: 0.5 } : {})), T0);
    expect(k[0]!.izgled).toBe('Pada do 13h');
    expect(k[3]!.izgled).toBe('Suho narednih 12 sati');
  });

  it('snijeg', () => {
    const k = kadroviWidgeta(sati((i) => (i >= 2 ? { kod: 73, kisaMm: 1, temp: -1 } : {})), T0);
    expect(k[0]!.izgled).toBe('Snijeg oko 12h');
    expect(k[2]!.izgled).toBe('Snijeg i dalje');
  });

  it('stara prognoza: nema kadrova', () => {
    expect(kadroviWidgeta(sati(() => ({}), 5), T0 + 10 * 3600e3)).toEqual([]);
  });
});

describe('ikonaWidgeta', () => {
  it('dan i noć, padavine', () => {
    expect(ikonaWidgeta(0, true)).toBe('vedro-dan');
    expect(ikonaWidgeta(0, false)).toBe('vedro-noc');
    expect(ikonaWidgeta(3, true)).toBe('oblak');
    expect(ikonaWidgeta(45, true)).toBe('magla');
    expect(ikonaWidgeta(95, true)).toBe('grmljavina');
    expect(ikonaWidgeta(53, false)).toBe('kisa');
  });
});

describe('satiIzPrognoze', () => {
  it('lokalno vrijeme mjesta → ms', () => {
    const s = satiIzPrognoze({ pomakSek: 3600, sati: [{ vrijeme: '2026-11-26T10:00', temp: 12, kod: 3, kisaMm: 0, kisaVjer: 10, dan: true }] });
    expect(s[0]!.t).toBe(T0);
  });
});
