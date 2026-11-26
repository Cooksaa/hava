import { describe, expect, it } from 'vitest';
import { prskanje, rostilj } from './aktivnosti';
import { napraviPrognozu, type Uslovi } from './test-pomoc';

const p = (sada: string, u: (dan: number, sat: number) => Partial<Uslovi>) =>
  napraviPrognozu({
    sada,
    dani: [{ uslovi: (h) => u(0, h) }, { uslovi: (h) => u(1, h) }],
  });

// Osnovno u test-pomoc: 18°, vjetar 8, udari 15, suho.

describe('prskanje', () => {
  it('mirno i suho: prskaj', () => {
    expect(prskanje(p('2026-05-12T08:00', () => ({})))?.glavno).toBe('Prskaj, uslovi dobri do večeri.');
  });

  it('kiša u 15h: dobro do 9h (6 sati prije kiše)', () => {
    const r = prskanje(p('2026-05-12T08:00', (d, h) => (d === 0 && h >= 15 ? { kisaMm: 2, kod: 63 } : {})));
    expect(r?.glavno).toBe('Prskaj sad, dobro do 9h.');
  });

  it('vjetrovito ujutro, mirno popodne', () => {
    const r = prskanje(p('2026-05-12T08:00', (d, h) => (d === 0 && h < 14 ? { vjetar: 20, udari: 30 } : {})));
    expect(r).toMatchObject({ ocjena: 'crveno', glavno: 'Prskaj od 14h do večeri.' });
  });

  it('danas kiša cijeli dan, sutra dobro', () => {
    const r = prskanje(p('2026-05-12T08:00', (d) => (d === 0 ? { kisaMm: 1, kod: 61 } : {})));
    expect(r?.glavno).toBe('Danas ne: pada. Sutra od 6h.');
  });

  it('uveče gleda sutra', () => {
    expect(prskanje(p('2026-05-12T21:00', () => ({})))).toMatchObject({ dan: 'sutra', glavno: 'Sutra prskaj od 6h.' });
  });
});

describe('roštilj', () => {
  it('lijepo veče', () => {
    expect(rostilj(p('2026-05-12T10:00', () => ({ temp: 20 })))?.glavno).toBe('Večeras lijepo.');
  });

  it('kiša od 19h', () => {
    const r = rostilj(p('2026-05-12T10:00', (_d, h) => (h >= 19 ? { temp: 20, kisaMm: 1, kod: 61 } : { temp: 20 })));
    expect(r?.glavno).toBe('Večeras lijepo do 19h.');
    const svaKisa = rostilj(p('2026-05-12T10:00', () => ({ temp: 20, kisaMm: 1, kod: 61 })));
    expect(svaKisa?.glavno).toBe('Večeras ne: kiša od 16h.');
  });

  it('svježe', () => {
    expect(rostilj(p('2026-05-12T10:00', () => ({ temp: 12 })))?.glavno).toBe('Večeras može, ali 12°, ponesi jaknu.');
  });

  it('poslije 22h sutra uveče', () => {
    expect(rostilj(p('2026-05-12T22:30', () => ({ temp: 20 })))).toMatchObject({ dan: 'sutra', glavno: 'Sutra uveče lijepo.' });
  });
});
