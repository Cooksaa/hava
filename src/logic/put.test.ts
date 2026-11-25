import { describe, expect, it } from 'vitest';
import { lokalno } from './sarajevo';
import { najblize, putRecenica, tackeNaRuti, uslov, vrijemePolaska, type TackaPuta, type Uslov } from './put';

// 25.11.2026. 13:00 u Sarajevu
const SAD = Date.parse('2026-11-25T12:00:00Z');

describe('tackeNaRuti', () => {
  // Prava linija prema sjeveru, 101 tačka po ~1,11 km (0,01°), svaki komad 60 s.
  const koord = Array.from({ length: 101 }, (_, i) => [17.7, 43.0 + i * 0.01] as [number, number]);
  const trajanja = Array.from({ length: 100 }, () => 60);

  it('početak, svakih 25 km, i kraj', () => {
    const t = tackeNaRuti(koord, trajanja, 25);
    expect(t[0]).toMatchObject({ km: 0, min: 0 });
    expect(t.map((x) => Math.round(x.km))).toEqual([0, 26, 51, 77, 102, 111]);
    expect(t[t.length - 1]!.min).toBe(100);
  });

  it('kraj blizu zadnje tačke se ne duplira', () => {
    const t = tackeNaRuti(koord.slice(0, 47), trajanja, 25);
    expect(t.map((x) => Math.round(x.km))).toEqual([0, 26, 51]);
  });
});

describe('uslov', () => {
  const v = (o: Partial<{ temp: number; kisa: number; kod: number; udari: number }>) =>
    uslov({ temp: 10, kisa: 0, kod: 1, udari: 20, ...o });

  it('od suhog do poledice', () => {
    expect(v({})).toBe('suho');
    expect(v({ kisa: 0.6, kod: 61 })).toBe('kisa');
    expect(v({ kisa: 6, kod: 63 })).toBe('jaka-kisa');
    expect(v({ udari: 70 })).toBe('vjetar');
    expect(v({ kod: 45 })).toBe('magla');
    expect(v({ kod: 73, kisa: 1, temp: -2 })).toBe('snijeg');
    expect(v({ kod: 61, kisa: 0.5, temp: 0.5 })).toBe('poledica');
    expect(v({ kod: 66, kisa: 0.3, temp: 3 })).toBe('poledica');
  });
});

describe('najblize', () => {
  const mjesta = [
    { ime: 'Jablanica', lat: 43.6603, lon: 17.7617 },
    { ime: 'Konjic', lat: 43.6519, lon: 17.9608 },
  ];
  it('najbliže do 25 km', () => {
    expect(najblize(43.66, 17.8, mjesta)?.ime).toBe('Jablanica');
    expect(najblize(44.5, 18.6, mjesta)).toBeNull();
  });
});

function tacka(ime: string | null, sat: number, u: Uslov): TackaPuta {
  return {
    lat: 0,
    lon: 0,
    km: 0,
    min: 0,
    ime,
    genitiv: ime ? `${ime}G` : null,
    kad: Date.parse(`2026-11-25T${String(sat - 1).padStart(2, '0')}:10:00Z`),
    v: { temp: 8, kisa: 0, kod: 1, udari: 10 },
    uslov: u,
  };
}

describe('putRecenica', () => {
  const sarajevo = { ime: 'Sarajevo', genitiv: 'Sarajeva' };

  it('suho cijelim putem', () => {
    expect(putRecenica([tacka('Mostar', 13, 'suho'), tacka('Sarajevo', 15, 'suho')], sarajevo)).toBe(
      'Do Sarajeva suho cijelim putem.',
    );
  });

  it('kiša na dionici, na odredištu suho', () => {
    const r = putRecenica(
      [
        tacka('Mostar', 13, 'suho'),
        tacka('Jablanica', 14, 'kisa'),
        tacka(null, 14, 'jaka-kisa'),
        tacka('Konjic', 15, 'kisa'),
        tacka('Sarajevo', 16, 'suho'),
      ],
      sarajevo,
    );
    expect(r).toBe('Do Sarajeva: jaka kiša od JablanicaG do KonjicG oko 14h, na odredištu suho.');
  });

  it('loše samo na odredištu', () => {
    expect(putRecenica([tacka('Mostar', 13, 'suho'), tacka('Sarajevo', 15, 'snijeg')], sarajevo)).toBe(
      'Do Sarajeva: snijeg na odredištu oko 15h.',
    );
  });

  it('odredište bez genitiva', () => {
    expect(putRecenica([tacka('X', 13, 'magla')], { ime: 'Vlašić', genitiv: null })).toBe(
      'Vlašić: magla na odredištu oko 13h.',
    );
  });
});

describe('vrijemePolaska', () => {
  it('sutra u 7h po našem vremenu', () => {
    const l = lokalno(vrijemePolaska('sutra', SAD));
    expect([l.datum, l.sat, l.minut]).toEqual(['2026-11-26', 7, 0]);
    expect(vrijemePolaska('za-sat', SAD) - SAD).toBe(3600e3);
  });
});
