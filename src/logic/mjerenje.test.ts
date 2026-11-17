import { describe, expect, it } from 'vitest';
import { izMetara, primijeniMjerenje, zadnjaMjerenja, type MetarZapis } from './mjerenje';
import { KISA, SUHO, napraviPrognozu } from './test-pomoc';

const MOSTAR = { lat: 43.3438, lon: 17.8078 };
const CAPLJINA = { lat: 43.1137, lon: 17.6847 };
const SARAJEVO = { lat: 43.8563, lon: 18.4131 };

// 2026-11-17 20:30 lokalno (UTC+1) = 19:30 UTC
const SAD = Date.UTC(2026, 10, 17, 19, 40);
const IZMJERENO = Date.UTC(2026, 10, 17, 19, 30) / 1000;

function metar(o: Partial<MetarZapis> = {}): MetarZapis {
  return { icaoId: 'LQMO', obsTime: IZMJERENO, temp: 17, wxString: null, cover: 'BKN', lat: 43.2829, lon: 17.8459, elev: 48, ...o };
}

const kisovito = () => {
  const p = napraviPrognozu({ sada: '2026-11-17T20:30', dani: [{ uslovi: () => ({ ...KISA, temp: 14 }) }] });
  return { ...p, visina: 60 };
};

describe('METAR', () => {
  it('pojave u kod', () => {
    expect(izMetara(metar({ wxString: '-RA' }))).toMatchObject({ kod: 61, pada: true });
    expect(izMetara(metar({ wxString: '+SHRA' }))).toMatchObject({ kod: 82, pada: true });
    expect(izMetara(metar({ wxString: 'TSRA' }))).toMatchObject({ kod: 95, pada: true });
    expect(izMetara(metar({ wxString: '-SN' }))).toMatchObject({ kod: 71, pada: true });
    expect(izMetara(metar({ wxString: 'BR', cover: 'OVC' }))).toMatchObject({ kod: 3, pada: false });
    expect(izMetara(metar({ wxString: 'FG' }))).toMatchObject({ kod: 45, pada: false });
    expect(izMetara(metar({ cover: 'CAVOK' }))).toMatchObject({ kod: 0, pada: false });
  });

  it('kiša u blizini (VC) ne pada na stanici', () => {
    expect(izMetara(metar({ wxString: 'VCSH', cover: 'SCT' }))).toMatchObject({ kod: 2, pada: false });
  });

  it('nepoznata stanica i bez temperature se preskaču', () => {
    expect(izMetara(metar({ icaoId: 'KJFK' }))).toBeNull();
    expect(izMetara(metar({ temp: null }))).toBeNull();
  });

  it('po stanici samo zadnje mjerenje', () => {
    const m = zadnjaMjerenja([metar({ temp: 15, obsTime: IZMJERENO - 1800 }), metar({ temp: 17 })]);
    expect(m).toHaveLength(1);
    expect(m[0]?.temp).toBe(17);
  });
});

describe('primijeniMjerenje', () => {
  const mj = zadnjaMjerenja([metar()]);

  it('Mostar: model kaže kišu, aerodrom suho i 17°: vjeruje se aerodromu', () => {
    const p = primijeniMjerenje(kisovito(), MOSTAR, mj, SAD);
    expect(p.sada.temp).toBeCloseTo(16.92, 2); // mjesto je 12 m više od aerodroma
    expect(p.sada.kisaMm).toBe(0);
    expect(p.sada.kod).toBe(3);
    const sat = p.sati.find((s) => s.vrijeme === '2026-11-17T20:00');
    expect(sat?.kisaMm).toBe(0);
    expect(sat?.kisaVjer).toBeLessThanOrEqual(30);
    expect(p.izmjereno).toEqual({ gdje: 'aerodrom Mostar', kad: '20:30' });
  });

  it('Čapljina (22 km): samo temperatura, kiša ostaje iz modela', () => {
    const p = primijeniMjerenje(kisovito(), CAPLJINA, mj, SAD);
    expect(p.sada.temp).toBeCloseTo(16.92, 2);
    expect(p.sada.kod).toBe(KISA.kod);
    expect(p.sada.kisaMm).toBeGreaterThan(0);
  });

  it('aerodrom vidi kišu, model suh: pada', () => {
    const suho = { ...napraviPrognozu({ sada: '2026-11-17T20:30', dani: [{ uslovi: () => SUHO }] }), visina: 60 };
    const p = primijeniMjerenje(suho, MOSTAR, zadnjaMjerenja([metar({ wxString: '-RA' })]), SAD);
    expect(p.sada.kod).toBe(61);
    expect(p.sada.kisaMm).toBeGreaterThan(0);
  });

  it('predaleko, previsoko, prestaro ili bez visine: ništa se ne mijenja', () => {
    const p = kisovito();
    expect(primijeniMjerenje(p, SARAJEVO, mj, SAD)).toBe(p);
    expect(primijeniMjerenje({ ...p, visina: 400 }, MOSTAR, mj, SAD)).toEqual({ ...p, visina: 400 });
    expect(primijeniMjerenje(p, MOSTAR, mj, SAD + 3 * 3600e3)).toBe(p);
    const bezVisine = { ...p, visina: undefined };
    expect(primijeniMjerenje(bezVisine, MOSTAR, mj, SAD)).toBe(bezVisine);
  });
});
