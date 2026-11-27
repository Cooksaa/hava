import { describe, expect, it, vi } from 'vitest';
import { MODELI } from './dron';
import { mjestoPitanja, odgovori, type Izvori } from './odgovor';
import { prepoznaj } from './pitanja';
import { napraviPrognozu } from './test-pomoc';
import type { Mjesto } from '../tipovi';

const MOSTAR: Mjesto = { ime: 'Mostar', lat: 43.3438, lon: 17.8078, bih: true };
const suho = napraviPrognozu({ sada: '2026-05-12T09:00', dani: [{ uslovi: () => ({}) }, { uslovi: () => ({}) }] });

function izvori(u: Partial<Izvori> = {}): Izvori {
  return {
    mjesto: MOSTAR,
    prognoza: suho,
    model: MODELI[0]!,
    dohvatiPrognozu: vi.fn(async () => suho),
    kisaSad: async () => null,
    visine: async () => null,
    zrak: async () => null,
    vrh: async () => [],
    upozorenja: () => [],
    ...u,
  };
}

describe('mjestoPitanja', () => {
  it('bez mjesta u pitanju: podrazumijevano; drugo mjesto iz liste', () => {
    expect(mjestoPitanja(prepoznaj('Pada li?'), MOSTAR)).toEqual({ mjesto: MOSTAR, isto: true });
    const r = mjestoPitanja(prepoznaj('Pada li u Čapljini?'), MOSTAR);
    expect(r.isto).toBe(false);
    expect(r.mjesto).toMatchObject({ ime: 'Čapljina', bih: true });
  });
});

describe('odgovori', () => {
  it('drugo mjesto: dohvati njegovu prognozu i kaže gdje', async () => {
    const k = izvori();
    const o = await odgovori(prepoznaj('Kad da palim mašinu u Čapljini?'), k);
    expect(k.dohvatiPrognozu).toHaveBeenCalledWith(expect.objectContaining({ ime: 'Čapljina' }));
    expect(o.startsWith('U Čapljini: ')).toBe(true);
  });

  it('isto mjesto: ne dohvata ponovo', async () => {
    const k = izvori();
    await odgovori(prepoznaj('Kad da palim mašinu?'), k);
    expect(k.dohvatiPrognozu).not.toHaveBeenCalled();
  });

  it('radar ispred modela kad pada', async () => {
    const k = izvori({ kisaSad: async () => ({ vrsta: 'pada', recenica: 'Pada, staje za ~20 min.', min: 20, kada: 'za ~20 min' }) });
    expect(await odgovori(prepoznaj('Pada li u Mostaru?'), k)).toBe('U Mostaru: pada, staje za ~20 min.');
  });

  it('dron kaže koji model', async () => {
    const o = await odgovori(prepoznaj('Mogu li danas dići dron?'), izvori());
    expect(o.endsWith(`(${MODELI[0]!.ime}).`)).toBe(true);
  });

  it('upozorenja bez prognoze; bez interneta jasna poruka', async () => {
    const bez = izvori({ prognoza: null, dohvatiPrognozu: async () => Promise.reject(new Error('mreža')) });
    expect(await odgovori(prepoznaj('Ima li upozorenje?'), bez)).toBe('Nema službenih upozorenja u Mostaru.');
    expect(await odgovori(prepoznaj('Pada li?'), bez)).toBe('Ne mogu doći do prognoze. Provjeri internet.');
  });

  it('nepoznato pitanje', async () => {
    expect(await odgovori(prepoznaj('Ko je pobijedio?'), izvori())).toMatch(/^Nisam razumio pitanje\./);
  });
});
