import { describe, expect, it } from 'vitest';
import { MJESTA } from '../mjesta';
import { bezKvacica, mjestoZaKoordinate, traziPoznata, udaljenostKm } from './mjesto';

const nadji = (ime: string) => MJESTA.find((m) => m.ime === ime)!;

describe('udaljenost', () => {
  it('Čapljina–Mostar je oko 27 km zračne linije', () => {
    const km = udaljenostKm(nadji('Čapljina'), nadji('Mostar'));
    expect(km).toBeGreaterThan(25);
    expect(km).toBeLessThan(30);
  });
});

describe('ime za GPS', () => {
  it('u mjestu', () => {
    expect(mjestoZaKoordinate(43.1171, 17.6902).ime).toBe('Čapljina');
  });

  it('blizu mjesta, s genitivom', () => {
    // između Stoca i Čapljine, bliže Stocu
    expect(mjestoZaKoordinate(43.08, 17.86).ime).toBe('Blizu Stoca');
  });

  it('daleko od svega poznatog', () => {
    expect(mjestoZaKoordinate(48.2, 16.37).ime).toBe('Moja lokacija');
  });

  it('koordinate se zaokružuju na oko 1 km', () => {
    expect(mjestoZaKoordinate(43.117123, 17.690234)).toMatchObject({ lat: 43.12, lon: 17.69 });
  });
});

describe('pretraga po ugrađenoj listi', () => {
  it('radi bez kvačica', () => {
    expect(bezKvacica('Čapljina')).toBe('capljina');
    expect(bezKvacica('Međugorje')).toBe('medugorje');
    expect(traziPoznata('capl').map((m) => m.ime)).toEqual(['Čapljina']);
    expect(traziPoznata('međ').map((m) => m.ime)).toEqual(['Međugorje']);
  });

  it('pogađa i drugu riječ', () => {
    expect(traziPoznata('luka').map((m) => m.ime)).toEqual(['Banja Luka']);
    expect(traziPoznata('brij').map((m) => m.ime)).toEqual(['Široki Brijeg']);
  });

  it('"mos" daje Mostar', () => {
    expect(traziPoznata('mos').map((m) => m.ime)).toEqual(['Mostar']);
  });

  it('prazan upit ne daje ništa', () => {
    expect(traziPoznata('  ')).toEqual([]);
  });
});

describe('lista mjesta', () => {
  it('nema duplih imena i sve koordinate su u regiji', () => {
    expect(new Set(MJESTA.map((m) => m.ime)).size).toBe(MJESTA.length);
    for (const m of MJESTA) {
      expect(m.lat).toBeGreaterThan(42);
      expect(m.lat).toBeLessThan(45.5);
      expect(m.lon).toBeGreaterThan(15.5);
      expect(m.lon).toBeLessThan(19.7);
    }
  });
});
