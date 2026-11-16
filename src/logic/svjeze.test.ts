import { describe, expect, it } from 'vitest';
import { lokalnoVrijeme, uskladiSaSatom } from './svjeze';
import { KISA, SUHO, napraviPrognozu } from './test-pomoc';
import { procijeniVes } from './ves';

const SAT = 60 * 60 * 1000;
// 12. maj 2026. u 08:00 po lokalnom vremenu mjesta (UTC+1 u testnoj prognozi).
const DOHVACENO = Date.UTC(2026, 4, 12, 7, 0);

const prognoza = () =>
  napraviPrognozu({
    sada: '2026-05-12T08:00',
    dani: [{ zalazak: '20:05', uslovi: (h) => (h >= 15 ? { ...KISA, temp: 11 } : { ...SUHO, temp: 10 + h }) }],
  });

describe('lokalno vrijeme mjesta', () => {
  it('dodaje pomak od UTC', () => {
    expect(lokalnoVrijeme(Date.UTC(2026, 10, 16, 21, 15), 3600)).toBe('2026-11-16T22:15');
    expect(lokalnoVrijeme(Date.UTC(2026, 6, 1, 23, 30), 7200)).toBe('2026-07-02T01:30');
  });
});

describe('usklađivanje stare prognoze', () => {
  it('svježu prognozu ne dira', () => {
    const p = prognoza();
    expect(uskladiSaSatom(p, DOHVACENO, DOHVACENO + 10 * 60_000)).toBe(p);
  });

  it('poslije pet sati "sada" dolazi iz satne prognoze', () => {
    const p = uskladiSaSatom(prognoza(), DOHVACENO, DOHVACENO + 5 * SAT);
    expect(p?.sada).toMatchObject({ vrijeme: '2026-05-12T13:00', temp: 23, kod: 1 });
  });

  it('veš prati sat, ne trenutak dohvata', () => {
    const p = prognoza();
    expect(procijeniVes(p)).toMatchObject({ kod: 'pali-masinu', dan: 'danas' });
    // U 13h je do kiše u 15h premalo vremena: presuda prelazi na sutra.
    const kasnije = uskladiSaSatom(p, DOHVACENO, DOHVACENO + 5 * SAT);
    expect(kasnije && procijeniVes(kasnije).dan).toBe('sutra');
  });

  it('sutradan je prvi dan u listi sutrašnji', () => {
    const p = uskladiSaSatom(prognoza(), DOHVACENO, DOHVACENO + 26 * SAT);
    expect(p?.sada.vrijeme).toBe('2026-05-13T10:00');
    expect(p?.dani[0]?.datum).toBe('2026-05-13');
    expect(p?.dani).toHaveLength(6);
  });

  it('prognoza starija od sedmice više ne vrijedi', () => {
    expect(uskladiSaSatom(prognoza(), DOHVACENO, DOHVACENO + 8 * 24 * SAT)).toBeNull();
  });
});
