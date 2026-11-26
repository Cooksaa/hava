import { describe, expect, it } from 'vitest';
import { najbliziVrh, ocijeniVrh, presudaVrha, VRHOVI, type SatVrha } from './planina';

const BJEL = VRHOVI.find((v) => v.id === 'bjelasnica')!;

function sati(f: (dan: number, sat: number) => Partial<SatVrha>): SatVrha[] {
  const out: SatVrha[] = [];
  for (const [d, datum] of ['2026-07-10', '2026-07-11'].entries()) {
    for (let h = 0; h < 24; h++) {
      out.push({
        vrijeme: `${datum}T${String(h).padStart(2, '0')}:00`,
        datum,
        sat: h,
        temp: 8,
        osjecaj: 6,
        kod: 1,
        kisaMm: 0,
        vjetar: 15,
        udari: 25,
        nisko: 10,
        ...f(d, h),
      });
    }
  }
  return out;
}

describe('ocijeniVrh', () => {
  const s = (u: Partial<SatVrha>) => sati(() => u)[12]!;
  it('pragovi', () => {
    expect(ocijeniVrh(s({})).ocjena).toBe('zeleno');
    expect(ocijeniVrh(s({ udari: 45 })).ocjena).toBe('zuto');
    expect(ocijeniVrh(s({ udari: 70 })).razlozi).toEqual(['udari 70 km/h']);
    expect(ocijeniVrh(s({ kod: 95 })).razlozi).toContain('grmljavina');
    expect(ocijeniVrh(s({ nisko: 95 })).razlozi).toEqual(['vrh u oblaku']);
    expect(ocijeniVrh(s({ temp: -12, osjecaj: -22 })).ocjena).toBe('crveno');
  });
});

describe('presudaVrha', () => {
  it('lijepo cijeli dan', () => {
    expect(presudaVrha(BJEL, sati(() => ({})), '2026-07-10T08:20')?.glavno).toBe('Bjelašnica: lijepo, na vrhu 8°.');
  });

  it('lijepo jutro, grmljavina popodne', () => {
    const r = presudaVrha(BJEL, sati((d, h) => (d === 0 && h >= 14 ? { kod: 95, kisaMm: 3 } : {})), '2026-07-10T08:20');
    expect(r).toMatchObject({ ocjena: 'zuto', glavno: 'Bjelašnica: lijepo do 14h, na vrhu 8°, grmljavina oko 14h.' });
  });

  it('jak vjetar cijeli dan', () => {
    expect(presudaVrha(BJEL, sati(() => ({ udari: 80 })), '2026-07-10T08:20')?.glavno).toBe(
      'Bjelašnica danas ne: udari 80 km/h.',
    );
  });

  it('poslije 15h sutra', () => {
    expect(presudaVrha(BJEL, sati(() => ({})), '2026-07-10T15:30')).toMatchObject({ dan: 'sutra', glavno: 'Bjelašnica sutra: lijepo, na vrhu 8°.' });
  });
});

describe('najbliziVrh', () => {
  it('iz Mostara Velež, iz Sarajeva Jahorina (bliža od Bjelašnice)', () => {
    expect(najbliziVrh(43.34, 17.81).planina).toBe('Velež');
    expect(najbliziVrh(43.856, 18.413).planina).toBe('Jahorina');
  });
});
