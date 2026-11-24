import { describe, expect, it } from 'vitest';
import { MODELI, ocijeniSat, presudaDrona, PODRAZUMIJEVANI, visinaSunca, zlatniPlavi, type Visina } from './dron';
import { napraviPrognozu, type Uslovi } from './test-pomoc';

const LITO = PODRAZUMIJEVANI; // 10,7 m/s ≈ 38,5 km/h
const NEO = MODELI.find((m) => m.id === 'neo')!; // 8 m/s ≈ 28,8 km/h

/** Prognoza za danas i sutra; vjetar na visini = 1,3 × vjetar na tlu (bez posebnog podatka). */
function prognoza(sada: string, uslovi: (dan: number, sat: number) => Partial<Uslovi>) {
  return napraviPrognozu({
    sada,
    dani: [
      { izlazak: '06:40', zalazak: '16:20', uslovi: (h) => uslovi(0, h) },
      { izlazak: '06:41', zalazak: '16:19', uslovi: (h) => uslovi(1, h) },
    ],
  });
}

function presuda(
  sada: string,
  uslovi: (dan: number, sat: number) => Partial<Uslovi>,
  model = LITO,
  visine = new Map<string, Visina>()
) {
  const p = prognoza(sada, uslovi);
  return presudaDrona(p.dani, p.sati, visine, model, sada);
}

describe('ocijeniSat', () => {
  const sat = (u: Partial<Uslovi>) => prognoza('2026-11-24T10:00', () => u).sati[10]!;

  it('mirno je zeleno', () => {
    expect(ocijeniSat(sat({ vjetar: 8, udari: 15 }), undefined, LITO).ocjena).toBe('zeleno');
  });

  it('vjetar na visini se gleda, ne samo na tlu', () => {
    const s = sat({ vjetar: 10, udari: 15 });
    expect(ocijeniSat(s, { v80: 24, v120: 27 }, LITO).ocjena).toBe('zuto');
    expect(ocijeniSat(s, { v80: 28, v120: 32 }, LITO).ocjena).toBe('crveno');
  });

  it('isti vjetar: Lito može, Neo pazi', () => {
    const s = sat({ vjetar: 12, udari: 18 });
    expect(ocijeniSat(s, { v80: 15, v120: 17 }, LITO).ocjena).toBe('zeleno');
    expect(ocijeniSat(s, { v80: 15, v120: 17 }, NEO).ocjena).toBe('zuto');
  });

  it('kiša, grmljavina i mraz', () => {
    expect(ocijeniSat(sat({ kod: 63, kisaMm: 2 }), undefined, LITO)).toMatchObject({
      ocjena: 'crveno',
      razlozi: ['kiša'],
    });
    expect(ocijeniSat(sat({ kod: 95 }), undefined, LITO).razlozi).toContain('grmljavina');
    expect(ocijeniSat(sat({ temp: -3 }), undefined, LITO)).toMatchObject({ ocjena: 'zuto' });
    expect(ocijeniSat(sat({ kisaVjer: 50 }), undefined, LITO).razlozi).toEqual(['moguća kiša']);
  });
});

describe('presudaDrona', () => {
  it('mirno cijeli dan', () => {
    expect(presuda('2026-11-24T09:15', () => ({}))).toMatchObject({
      ocjena: 'zeleno',
      dan: 'danas',
      glavno: 'Leti, mirno do mraka.',
    });
  });

  it('mirno do podne, pa puše', () => {
    const r = presuda('2026-11-24T09:15', (d, h) => (d === 0 && h >= 12 ? { vjetar: 25, udari: 45 } : {}));
    expect(r?.glavno).toBe('Leti sad, mirno do 12h.');
  });

  it('sad puše, mirnije poslije', () => {
    const r = presuda('2026-11-24T09:15', (d, h) => (d === 0 && h < 13 ? { vjetar: 30, udari: 55 } : {}));
    expect(r).toMatchObject({ ocjena: 'crveno', glavno: 'Sad ne. Mirno od 13h do mraka.' });
  });

  it('cijeli dan jak vjetar', () => {
    const r = presuda('2026-11-24T09:15', () => ({ vjetar: 35, udari: 60 }));
    expect(r?.ocjena).toBe('crveno');
    expect(r?.glavno).toMatch(/^Danas ne: udari do \d+ km\/h na visini\.$/);
  });

  it('pred mrak gleda sutra', () => {
    const r = presuda('2026-11-24T15:30', (d) => (d === 1 ? {} : { vjetar: 35, udari: 60 }));
    expect(r).toMatchObject({ dan: 'sutra', ocjena: 'zeleno' });
  });

  it('samo noćni sati se ne računaju', () => {
    const r = presuda('2026-11-24T09:15', (_d, h) => (h < 6 || h > 16 ? { vjetar: 40, udari: 70 } : {}));
    expect(r?.ocjena).toBe('zeleno');
    expect(r?.sati.every((s) => s.sat.sat >= 9 && s.sat.sat <= 15)).toBe(true);
  });
});

describe('sunce', () => {
  // Čapljina
  const LAT = 43.12;
  const LON = 17.68;

  it('podne je visoko, ponoć duboko', () => {
    // 24.11.2026. 11:00 UTC ≈ podne po suncu
    expect(visinaSunca(Date.parse('2026-11-24T10:50:00Z'), LAT, LON)).toBeGreaterThan(24);
    expect(visinaSunca(Date.parse('2026-11-24T23:00:00Z'), LAT, LON)).toBeLessThan(-40);
  });

  it('zlatni i plavi sat ujutro i uveče', () => {
    const { zlatni, plavi } = zlatniPlavi(Date.parse('2026-11-23T23:00:00Z'), LAT, LON);
    expect(zlatni).toHaveLength(2);
    expect(plavi).toHaveLength(2);
    // Večernji zlatni sat završava poslije zalaska (~15:15 UTC), plavi je odmah iza njega.
    const vecer = zlatni[1]!;
    expect(new Date(vecer.do).toISOString().slice(11, 13)).toBe('15');
    expect(plavi[1]!.od).toBe(vecer.do);
  });
});
