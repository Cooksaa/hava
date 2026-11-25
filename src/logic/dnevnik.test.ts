import { describe, expect, it } from 'vitest';
import { brojGresaka, dodaj, izvjestaj, NAJVISE, ocisti, uredjaj, type Zapis } from './dnevnik';

const T = Date.parse('2026-11-25T21:00:00Z');
const g = (poruka: string, kad = T, gdje = 'assets/index.js:1:2'): Omit<Zapis, 'puta'> => ({
  kad,
  poruka,
  gdje,
  verzija: '0.8.3',
});

describe('dnevnik', () => {
  it('ista greška samo broji, nova se dodaje', () => {
    let z = dodaj([], g('TypeError: x is undefined'));
    z = dodaj(z, g('TypeError: x is undefined', T + 1000));
    z = dodaj(z, g('RangeError: y'));
    expect(z.map((x) => [x.poruka, x.puta])).toEqual([
      ['TypeError: x is undefined', 2],
      ['RangeError: y', 1],
    ]);
  });

  it('čuva samo zadnjih NAJVISE', () => {
    let z: Zapis[] = [];
    for (let i = 0; i < NAJVISE + 5; i++) z = dodaj(z, g(`Greška ${i}`));
    expect(z).toHaveLength(NAJVISE);
    expect(z[0]!.poruka).toBe('Greška 5');
  });

  it('adrese bez upita (koordinate ne idu u izvještaj)', () => {
    expect(ocisti('Failed https://api.open-meteo.com/v1/forecast?latitude=43.1&longitude=17.6 x')).toBe(
      'Failed https://api.open-meteo.com/v1/forecast x',
    );
  });

  it('tekst izvještaja', () => {
    const z = dodaj(dodaj([], g('A')), g('A', T + 60_000));
    expect(izvjestaj(z, { verzija: '0.8.3', apk: '0.6.0', uredjaj: 'Android 17, Xiaomi 15', sad: T + 120_000 })).toBe(
      [
        'Hava: izvještaj o greškama',
        'Verzija 0.8.3 (APK 0.6.0)',
        'Telefon: Android 17, Xiaomi 15',
        'Poslano: 2026-11-25 21:02 UTC',
        '',
        '2026-11-25 21:01 UTC · 0.8.3 · 2×',
        '  A',
        '  assets/index.js:1:2',
      ].join('\n'),
    );
  });

  it('telefon iz user-agenta', () => {
    expect(uredjaj('Mozilla/5.0 (Linux; Android 17; 24129PN74G Build/X; wv) AppleWebKit/537.36')).toBe(
      'Android 17, 24129PN74G Build/X',
    );
    expect(uredjaj('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
  });
});

describe('brojGresaka', () => {
  it('padeži', () => {
    expect([1, 2, 3, 5, 11, 12, 21, 22, 25].map(brojGresaka)).toEqual([
      'jednu grešku', '2 greške', '3 greške', '5 grešaka', '11 grešaka', '12 grešaka', '21 grešku', '22 greške', '25 grešaka',
    ]);
  });
});
