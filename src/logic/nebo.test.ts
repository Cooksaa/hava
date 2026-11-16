import { describe, expect, it } from 'vitest';
import { stanjeNeba } from './nebo';

const dan = (vrijeme: string, kod: number) =>
  stanjeNeba({
    kod,
    vrijeme: `2026-05-12T${vrijeme}`,
    izlazak: '2026-05-12T05:30',
    zalazak: '2026-05-12T20:00',
  });

describe('nebo', () => {
  it('vedar dan', () => {
    expect(dan('12:45', 0)).toMatchObject({ vrsta: 'vedro', doba: 'dan', polozaj: 0.5 });
  });

  it('djelimično oblačno ostaje vedra paleta, oblačno ne', () => {
    expect(dan('12:00', 2).vrsta).toBe('vedro');
    expect(dan('12:00', 3).vrsta).toBe('oblacno');
  });

  it('suton i zora samo kad se nebo vidi', () => {
    expect(dan('19:40', 1).doba).toBe('suton');
    expect(dan('20:30', 0).doba).toBe('suton');
    expect(dan('05:10', 0).doba).toBe('suton');
    expect(dan('19:40', 3).doba).toBe('dan');
    expect(dan('20:30', 63).doba).toBe('noc');
  });

  it('noć', () => {
    expect(dan('23:00', 0).doba).toBe('noc');
    expect(dan('03:00', 0).doba).toBe('noc');
  });

  it('položaj ide od 0 do 1 kroz dan i kroz noć', () => {
    expect(dan('06:30', 0).polozaj).toBeLessThan(0.1);
    expect(dan('18:30', 0).polozaj).toBeGreaterThan(0.85);
    const predPonoc = dan('23:00', 0).polozaj;
    const poslijePonoci = dan('03:00', 0).polozaj;
    expect(predPonoc).toBeGreaterThan(0);
    expect(poslijePonoci).toBeGreaterThan(predPonoc);
    expect(poslijePonoci).toBeLessThan(1);
  });

  it('vrsta po kodu', () => {
    expect(dan('12:00', 95).vrsta).toBe('grmljavina');
    expect(dan('12:00', 73).vrsta).toBe('snijeg');
    expect(dan('12:00', 61).vrsta).toBe('kisa');
    expect(dan('12:00', 45).vrsta).toBe('magla');
  });
});
