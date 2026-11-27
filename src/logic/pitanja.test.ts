import { describe, expect, it } from 'vitest';
import { MJESTA } from '../mjesta';
import { LOKATIV, normalizuj, prepoznaj } from './pitanja';

describe('prepoznaj', () => {
  it('dron, danas', () => {
    expect(prepoznaj('Mogu li danas dići dron?')).toEqual({ tema: 'dron', mjesto: null, kada: 'danas' });
  });

  it('kiša u mjestu, i bez kvačica (glas)', () => {
    expect(prepoznaj('Pada li u Čapljini?')).toEqual({ tema: 'kisa', mjesto: 'Čapljina', kada: null });
    expect(prepoznaj('pada li u capljini')).toMatchObject({ tema: 'kisa', mjesto: 'Čapljina' });
    expect(prepoznaj('Hoće li sutra kiša u Banjoj Luci?')).toEqual({ tema: 'kisa', mjesto: 'Banja Luka', kada: 'sutra' });
  });

  it('veš, prskanje, roštilj, planina', () => {
    expect(prepoznaj('Kad da palim mašinu?').tema).toBe('ves');
    expect(prepoznaj('Mogu li prostrijeti veš?').tema).toBe('ves');
    expect(prepoznaj('Je li danas za prskanje?').tema).toBe('prskanje');
    expect(prepoznaj('Može li roštilj večeras?')).toMatchObject({ tema: 'rostilj', kada: 'danas' });
    expect(prepoznaj('Kakvo je vrijeme na planini?').tema).toBe('planina');
  });

  it('vjetar, temperatura, zrak, upozorenja', () => {
    expect(prepoznaj('Puše li bura u Mostaru?')).toMatchObject({ tema: 'vjetar', mjesto: 'Mostar' });
    expect(prepoznaj('Koliko je stepeni u Sarajevu?')).toMatchObject({ tema: 'temperatura', mjesto: 'Sarajevo' });
    expect(prepoznaj('Ima li smoga u Tuzli?')).toMatchObject({ tema: 'zrak', mjesto: 'Tuzla' });
    expect(prepoznaj('Ima li neko upozorenje?').tema).toBe('upozorenja');
  });

  it('nepoznato', () => {
    expect(prepoznaj('Ko je pobijedio sinoć?').tema).toBeNull();
  });
});

describe('LOKATIV', () => {
  it('svako ugrađeno mjesto ima lokativ', () => {
    expect(MJESTA.filter((m) => !(m.ime in LOKATIV)).map((m) => m.ime)).toEqual([]);
  });

  it('normalizuj', () => {
    expect(normalizuj('Međugorje, Čapljina!')).toBe('medjugorje capljina');
  });
});
