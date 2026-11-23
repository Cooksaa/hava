import { describe, expect, it } from 'vitest';
import { kisaUKrugu, kretanje, odSad, prognozaTacke } from './nowcast';
import { bojaKise, mmh, prazno, upisi, type Polje } from './radar';

const N = 160;

/** Polje s pravougaonom kišom (x, y = gornji lijevi ugao). */
function sKisom(oblaci: { x: number; y: number; s: number; v: number; jacina?: number }[]): Polje {
  const p = prazno(N, N);
  for (const o of oblaci) {
    for (let y = o.y; y < o.y + o.v; y++) {
      for (let x = o.x; x < o.x + o.s; x++) {
        // Malo "teksture", da poklapanje nije trivijalno.
        p.kisa[y * N + x] = (o.jacina ?? 2) * (1 + 0.5 * Math.sin(x * 0.7) * Math.cos(y * 0.5));
      }
    }
  }
  return p;
}

describe('radar boje', () => {
  it('čita kišu i snijeg iz neprozirnih piksela, prozirne preskače', () => {
    const p = prazno(4, 1);
    // 20 dBZ kiša, 30 dBZ snijeg, providna, nepoznata boja
    upisi(p, new Uint8Array([0x00, 0xa3, 0xe0, 255, 0x4f, 0x8f, 0xff, 255, 0x82, 0x7b, 0x69, 0x49, 1, 2, 3, 255]), 4, 0, 0);
    expect(p.kisa[0]).toBeCloseTo(mmh(20), 5);
    expect(p.snijeg[0]).toBe(0);
    expect(p.kisa[1]).toBeCloseTo(mmh(30), 5);
    expect(p.snijeg[1]).toBe(1);
    expect(p.kisa[2]).toBe(0);
    expect(p.kisa[3]).toBe(0);
  });

  it('Marshall–Palmer', () => {
    expect(mmh(20)).toBeCloseTo(0.65, 1);
    expect(mmh(35)).toBeCloseTo(5.6, 1);
  });
});

describe('kretanje', () => {
  it('nalazi pomak oblaka', () => {
    const staro = sKisom([{ x: 30, y: 40, s: 30, v: 20 }, { x: 90, y: 90, s: 15, v: 25 }]);
    const novo = sKisom([{ x: 39, y: 46, s: 30, v: 20 }, { x: 99, y: 96, s: 15, v: 25 }]);
    const k = kretanje(staro, novo, 30, 1.2);
    expect(k).not.toBeNull();
    expect(k!.vx).toBeCloseTo(0.3, 1);
    expect(k!.vy).toBeCloseTo(0.2, 1);
  });

  it('bez dovoljno kiše nema kretanja', () => {
    expect(kretanje(sKisom([{ x: 10, y: 10, s: 3, v: 3 }]), sKisom([{ x: 12, y: 10, s: 3, v: 3 }]), 30, 1)).toBeNull();
  });
});

describe('prognozaTacke', () => {
  const kmPoPikselu = 1.8;

  it('kiša stiže kad oblak dođe do tačke', () => {
    // Oblak širok 20 px, ide udesno 0,5 px/min. Tačka je 40 px desno od prednje ivice → ~80 min.
    const polje = sKisom([{ x: 40, y: 60, s: 20, v: 40 }]);
    const koraci = prognozaTacke(polje, { vx: 0.5, vy: 0 }, 100, 80, { kasnjenje: 0, kmPoPikselu });
    const prvi = koraci.find((k) => k.vjer >= 0.5);
    expect(prvi?.min).toBeGreaterThanOrEqual(70);
    expect(prvi?.min).toBeLessThanOrEqual(90);
    expect(koraci[0]!.vjer).toBe(0);
  });

  it('kašnjenje snimka se uračuna', () => {
    const polje = sKisom([{ x: 40, y: 60, s: 20, v: 40 }]);
    const bez = prognozaTacke(polje, { vx: 0.5, vy: 0 }, 100, 80, { kasnjenje: 0, kmPoPikselu }).find((k) => k.vjer >= 0.5);
    const sa = prognozaTacke(polje, { vx: 0.5, vy: 0 }, 100, 80, { kasnjenje: 10, kmPoPikselu }).find((k) => k.vjer >= 0.5);
    expect(bez!.min - sa!.min).toBe(10);
  });

  it('bez kretanja kiša ostaje gdje jeste', () => {
    const polje = sKisom([{ x: 90, y: 70, s: 30, v: 30 }]);
    const koraci = prognozaTacke(polje, null, 100, 80, { kasnjenje: 5, kmPoPikselu });
    expect(koraci.every((k) => k.vjer > 0.5)).toBe(true);
    expect(koraci).toHaveLength(25);
  });

  it('snijeg', () => {
    const polje = sKisom([{ x: 90, y: 70, s: 30, v: 30 }]);
    polje.snijeg.fill(1);
    expect(prognozaTacke(polje, null, 100, 80, { kasnjenje: 0, kmPoPikselu })[0]!.snijeg).toBe(true);
  });
});

describe('kisaUKrugu', () => {
  it('vidi kišu u krugu, ne van njega', () => {
    const polje = sKisom([{ x: 0, y: 0, s: 5, v: 5 }]);
    expect(kisaUKrugu(polje, 30, 30, 70, 1.8)).toBe(true);
    expect(kisaUKrugu(polje, 100, 100, 60, 1.8)).toBe(false);
  });
});

describe('odSad', () => {
  it('pomakne korake za proteklo vrijeme', () => {
    const k = [0, 5, 10, 15].map((min) => ({ min, vjer: min / 100, mmh: 0, snijeg: false }));
    expect(odSad(k, 7).map((x) => [x.min, x.vjer])).toEqual([[0, 0.05], [5, 0.1], [10, 0.15]]);
    expect(odSad(k, 0)).toHaveLength(4);
  });
});

describe('bojaKise', () => {
  it('vraća boju iz tabele, obrnuto od čitanja', () => {
    expect(bojaKise(mmh(20), false)).toEqual([0x00, 0xa3, 0xe0]);
    expect(bojaKise(mmh(30), true)).toEqual([0x4f, 0x8f, 0xff]);
    expect(bojaKise(0, false)).toBeNull();
  });
});
