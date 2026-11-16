import { describe, expect, it } from 'vitest';
import { GRADOVI } from '../config';
import { kisaKratko, kisaRecenica } from '../tekst';
import { procijeniKisu } from './kisa';
import { KISA, SUHO, napraviPrognozu, type Uslovi } from './test-pomoc';

const capljina = GRADOVI[0]!;
const sarajevo = GRADOVI[4]!;
const SNIJEG: Partial<Uslovi> = { temp: -1, vlaga: 90, kisaVjer: 85, kisaMm: 0.8, oblaci: 100, kod: 73 };

const prognoza = (sada: string, uslovi: (h: number) => Partial<Uslovi>) =>
  napraviPrognozu({ sada, dani: [{ uslovi }] });

describe('pada li u…', () => {
  it('pada i zna se kad staje', () => {
    const k = procijeniKisu(prognoza('2026-05-12T13:20', (h) => (h >= 13 && h < 16 ? KISA : SUHO)));
    expect(k).toMatchObject({ kod: 'pada', stajeOko: 16 });
    expect(kisaRecenica(capljina, k)).toBe('U Čapljini pada, staje oko 16h.');
    expect(kisaKratko(k)).toBe('pada do 16h');
  });

  it('staje kad završi tekuća kiša, ne zadnji pljusak u prozoru', () => {
    const k = procijeniKisu(
      prognoza('2026-05-12T13:00', (h) => ((h >= 13 && h < 15) || h === 20 ? KISA : SUHO)),
    );
    expect(k.stajeOko).toBe(15);
  });

  it('pada cijeli prozor', () => {
    const k = procijeniKisu(prognoza('2026-05-12T08:00', () => KISA));
    expect(k).toMatchObject({ kod: 'pada', stajeOko: null, uskoroStaje: false });
    expect(kisaRecenica(capljina, k)).toBe('U Čapljini pada i neće skoro stati.');
  });

  it('pada, ali prognoza za ovaj sat više ne vidi kišu', () => {
    const p = prognoza('2026-05-12T08:00', () => SUHO);
    p.sada.kod = 61;
    p.sada.kisaMm = 0.3;
    const k = procijeniKisu(p);
    expect(k).toMatchObject({ kod: 'pada', uskoroStaje: true });
    expect(kisaRecenica(capljina, k)).toBe('U Čapljini pada, trebalo bi uskoro stati.');
  });

  it('ne pada, kiša stiže', () => {
    const k = procijeniKisu(prognoza('2026-05-12T09:40', (h) => (h >= 15 ? KISA : SUHO)));
    expect(k).toMatchObject({ kod: 'stize', stizeOko: 15 });
    expect(kisaRecenica(capljina, k)).toBe('U Čapljini ne pada, kiša stiže oko 15h.');
    expect(kisaKratko(k)).toBe('kiša oko 15h');
  });

  it('kiša za više od 12 sati se ne računa', () => {
    const k = procijeniKisu(prognoza('2026-05-12T06:00', (h) => (h >= 19 ? KISA : SUHO)));
    expect(k.kod).toBe('suho');
    expect(kisaRecenica(capljina, k)).toBe('U Čapljini je suho narednih 12 sati.');
  });

  it('gleda i preko ponoći', () => {
    const p = napraviPrognozu({
      sada: '2026-05-12T20:00',
      dani: [{ uslovi: () => SUHO }, { uslovi: (h) => (h >= 2 ? KISA : SUHO) }],
    });
    expect(procijeniKisu(p)).toMatchObject({ kod: 'stize', stizeOko: 2 });
  });

  it('snijeg', () => {
    const stize = procijeniKisu(prognoza('2026-01-10T09:00', (h) => (h >= 14 ? SNIJEG : SUHO)));
    expect(kisaRecenica(sarajevo, stize)).toBe('U Sarajevu ne pada, snijeg stiže oko 14h.');

    const pada = procijeniKisu(prognoza('2026-01-10T09:00', (h) => (h < 12 ? SNIJEG : SUHO)));
    expect(kisaRecenica(sarajevo, pada)).toBe('U Sarajevu pada snijeg, staje oko 12h.');
  });
});
