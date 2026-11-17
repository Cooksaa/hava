import { describe, expect, it } from 'vitest';
import { staJeNovo, type Novost } from './novosti';

const N: Novost[] = [
  { verzija: '0.3.0', stavke: ['a'] },
  { verzija: '0.3.2', stavke: ['c'] },
  { verzija: '0.3.1', stavke: ['b'] },
];

describe('staJeNovo', () => {
  it('prvo pokretanje: ništa', () => {
    expect(staJeNovo(N, '0.3.2', null)).toEqual([]);
  });

  it('ista verzija: ništa', () => {
    expect(staJeNovo(N, '0.3.2', '0.3.2')).toEqual([]);
  });

  it('preskočene verzije, najnovija prva', () => {
    expect(staJeNovo(N, '0.3.2', '0.3.0').map((n) => n.verzija)).toEqual(['0.3.2', '0.3.1']);
  });

  it('ne pokazuje verzije novije od one koja radi', () => {
    expect(staJeNovo(N, '0.3.1', '0.2.9').map((n) => n.verzija)).toEqual(['0.3.1', '0.3.0']);
  });

  it('verzija bez novosti (sitna popravka): ništa', () => {
    expect(staJeNovo(N, '0.3.3', '0.3.2')).toEqual([]);
  });
});
