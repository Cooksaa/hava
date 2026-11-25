import { describe, expect, it } from 'vitest';
import mostar from './zone-mostar.test.json';
import { krug, procitajZone, zonaRecenica, zoneNaTacki } from './zone';

// Pravi odgovor DJI API-ja za Mostar (25.11.2026.): aerodrom (3 zone) i stadion Bijeli Brijeg.

describe('procitajZone', () => {
  const zone = procitajZone(mostar);

  it('svaka podzona je posebna zona s prstenom', () => {
    // aerodrom: 1 + 5 + 1 podzona, stadion: 1 krug
    expect(zone).toHaveLength(8);
    expect(zone.every((z) => z.prsten.length >= 4)).toBe(true);
    expect(new Set(zone.map((z) => z.nivo))).toEqual(new Set([0, 3]));
  });

  it('krug (stadion) se pretvori u mnogougao', () => {
    const stadion = zone.find((z) => z.ime === 'Bijeli Brijeg Stadium')!;
    expect(stadion.prsten).toHaveLength(49);
  });

  it('pokvaren odgovor i istekle zone', () => {
    expect(procitajZone(null)).toEqual([]);
    expect(procitajZone({ areas: 'x' })).toEqual([]);
    const istekla = { areas: [{ name: 'Koncert', level: 2, lat: 43, lng: 17, radius: 300, end_at: 1000 }] };
    expect(procitajZone(istekla)).toEqual([]);
    expect(procitajZone({ areas: [{ name: 'X', level: 9, lat: 43, lng: 17, radius: 300 }] })).toEqual([]);
  });
});

describe('zoneNaTacki', () => {
  const zone = procitajZone(mostar);

  it('aerodrom: pojačano upozorenje je ozbiljnije od upozorenja', () => {
    const na = zoneNaTacki(zone, 43.283, 17.844);
    expect(na.map((z) => z.nivo)).toEqual([3, 0]);
    expect(zonaRecenica(na)).toBe(
      'Ovdje je zona Mostar International Airport: pojačano upozorenje, DJI Fly traži da potvrdiš let.',
    );
  });

  it('stadion u centru Mostara je i u zoni aerodroma (isti nivo): obje se vide', () => {
    expect(zoneNaTacki(zone, 43.3456, 17.7953).map((z) => z.ime).sort()).toEqual(['Bijeli Brijeg Stadium', 'Mostar International Airport']);
  });

  it('Čapljina je van zona', () => {
    expect(zoneNaTacki(zone, 43.12, 17.68)).toEqual([]);
    expect(zonaRecenica([])).toBeNull();
  });

  it('krug: tačka 400 m od centra unutra, 600 m van', () => {
    const k = [{ id: 'k', ime: 'K', nivo: 2, boja: '#f00', visina: 0, prsten: krug(43, 17, 500) }];
    expect(zoneNaTacki(k, 43 + 400 / 111_320, 17)).toHaveLength(1);
    expect(zoneNaTacki(k, 43 + 600 / 111_320, 17)).toHaveLength(0);
  });
});
