import { describe, expect, it } from 'vitest';
import { bezDuplikata, idObavijesti, noc, obavijestiModela, obavijestiUpozorenja, zaSlanje, type SatModela } from './obavijesti';
import type { Upozorenje } from './upozorenja';

// 23.11.2026. 14:00 u Sarajevu
const SAD = Date.parse('2026-11-23T13:00:00Z');
const SAT = 3600e3;

function sati(f: (i: number) => Partial<SatModela>): SatModela[] {
  return Array.from({ length: 14 }, (_, i) => ({ vrijeme: SAD + i * SAT, kisa: 0, udari: 20, ...f(i) }));
}

describe('obavijestiModela', () => {
  it('mirno: ništa', () => {
    expect(obavijestiModela(sati(() => ({})), 'Čapljina', SAD)).toEqual([]);
  });

  it('jak vjetar', () => {
    const o = obavijestiModela(sati((i) => (i >= 4 && i <= 6 ? { udari: i === 5 ? 83 : 76 } : {})), 'Čapljina', SAD);
    expect(o).toEqual([
      {
        kljuc: 'vjetar:2026-11-23',
        naslov: 'Jak vjetar, Čapljina',
        tekst: 'Udari do 85 km/h, oko 18h. Skloni šta vjetar može odnijeti.',
      },
    ]);
  });

  it('olujni vjetar već sad', () => {
    const o = obavijestiModela(sati((i) => (i === 0 ? { udari: 95 } : {})), 'Mostar', SAD);
    expect(o[0]!.naslov).toBe('Olujni vjetar, Mostar');
    expect(o[0]!.tekst).toContain('već sad');
  });

  it('jaka kiša u satu', () => {
    const o = obavijestiModela(sati((i) => (i === 3 ? { kisa: 14.6 } : {})), 'Čapljina', SAD);
    expect(o).toEqual([{ kljuc: 'kisa:2026-11-23', naslov: 'Jaka kiša, Čapljina', tekst: 'Do 15 mm za sat, oko 17h.' }]);
  });

  it('jaka kiša kroz tri sata', () => {
    const o = obavijestiModela(sati((i) => (i >= 9 && i <= 11 ? { kisa: 9 } : {})), 'Čapljina', SAD);
    expect(o[0]!.tekst).toBe('Do 27 mm za tri sata, od 23h.');
    expect(o[0]!.kljuc).toBe('kisa:2026-11-23');
  });

  it('dalje od 12 sati se ne gleda', () => {
    expect(obavijestiModela(sati((i) => (i === 13 ? { udari: 100 } : {})), 'Čapljina', SAD)).toEqual([]);
  });
});

describe('obavijestiUpozorenja', () => {
  const u = (nivo: 2 | 3 | 4): Upozorenje => ({
    regija: 'Mostar',
    vrsta: 'vjetar',
    nivo,
    od: SAD + 4 * SAT,
    do: Date.parse('2026-11-23T22:59:00Z'),
    opis: 'Udari bure 80–100 km/h. Moguće štete.',
    uputa: '',
    izvor: 'FHMZ',
    izdato: SAD,
  });

  it('samo narandžasto i crveno', () => {
    expect(obavijestiUpozorenja([u(2)], SAD)).toEqual([]);
    expect(obavijestiUpozorenja([u(3)], SAD)).toEqual([
      {
        kljuc: `ma:vjetar:3:${SAD + 4 * SAT}`,
        naslov: 'Narandžasto upozorenje: vjetar',
        tekst: 'Mostar, danas od 18h do ponoći. Udari bure 80–100 km/h.',
      },
    ]);
  });
});

describe('zaSlanje', () => {
  const o = { kljuc: 'vjetar:2026-11-23', naslov: 'x', tekst: 'y' };

  it('isti događaj samo jednom, stari ključevi se brišu', () => {
    const prvi = zaSlanje([o], { stari: SAD - 4 * 864e5 }, SAD);
    expect(prvi.nove).toHaveLength(1);
    expect(prvi.poslano).toEqual({ 'vjetar:2026-11-23': SAD });
    expect(zaSlanje([o], prvi.poslano, SAD + SAT).nove).toEqual([]);
  });
});

describe('ostalo', () => {
  it('noć je 22–7h po Sarajevu', () => {
    expect(noc(Date.parse('2026-11-23T21:30:00Z'))).toBe(true);
    expect(noc(Date.parse('2026-11-23T05:59:00Z'))).toBe(true);
    expect(noc(Date.parse('2026-11-23T06:00:00Z'))).toBe(false);
  });

  it('id je stabilan i pozitivan', () => {
    expect(idObavijesti('vjetar:2026-11-23')).toBe(idObavijesti('vjetar:2026-11-23'));
    expect(idObavijesti('a')).toBeGreaterThanOrEqual(0);
  });
});

describe('bezDuplikata', () => {
  it('službeno upozorenje na vjetar gasi naš vjetar, ne i kišu', () => {
    const s = [{ kljuc: 'ma:vjetar:3:1', naslov: '', tekst: '' }];
    const m = [
      { kljuc: 'vjetar:2026-11-23', naslov: '', tekst: '' },
      { kljuc: 'kisa:2026-11-23', naslov: '', tekst: '' },
    ];
    expect(bezDuplikata(s, m).map((o) => o.kljuc)).toEqual(['ma:vjetar:3:1', 'kisa:2026-11-23']);
  });
});
