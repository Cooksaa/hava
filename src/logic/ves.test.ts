import { afterAll, describe, expect, it } from 'vitest';
import { vesRecenica } from '../tekst';
import type { Prognoza } from '../tipovi';
import {
  BURA,
  HLADNO_SPORO,
  HLADNO_SUHO,
  KISA,
  LJETO,
  PREVLAZNO,
  SUHO,
  VLAZAN_NOVEMBAR,
  napraviPrognozu,
} from './test-pomoc';
import { brzinaSusenja, pregledVesa, procijeniVes, type VesKod, type VesNivo } from './ves';

interface Scenarij {
  ime: string;
  prognoza: Prognoza;
  nivo: VesNivo;
  kod: VesKod;
  dan: 'danas' | 'sutra';
  glavno: string;
  detalj: string;
}

const MAJ = { zalazak: '20:05' };
const NOVEMBAR = { izlazak: '06:38', zalazak: '16:22' };

const SCENARIJI: Scenarij[] = [
  {
    ime: 'Suh dan u maju, 8h',
    prognoza: napraviPrognozu({ sada: '2026-05-12T08:00', dani: [{ ...MAJ, uslovi: () => SUHO }] }),
    nivo: 'moze',
    kod: 'pali-masinu',
    dan: 'danas',
    glavno: 'Pali mašinu do 13h, suho do 19h.',
    detalj: 'Vani je suho već sad, suši se oko 4h.',
  },
  {
    ime: 'Kiša popodne, od 15h',
    prognoza: napraviPrognozu({
      sada: '2026-05-12T07:30',
      dani: [{ ...MAJ, uslovi: (h) => (h >= 15 ? KISA : SUHO) }],
    }),
    nivo: 'moze',
    kod: 'pali-masinu',
    dan: 'danas',
    glavno: 'Pali mašinu do 9h, kiša od 15h.',
    detalj: 'Vani je suho već sad, suši se oko 4h.',
  },
  {
    ime: 'Vlažan novembar, 9h, bura u četvrtak',
    prognoza: napraviPrognozu({
      sada: '2026-11-16T09:00',
      dani: [
        { ...NOVEMBAR, uslovi: () => VLAZAN_NOVEMBAR },
        { ...NOVEMBAR, uslovi: () => VLAZAN_NOVEMBAR },
        { ...NOVEMBAR, uslovi: () => VLAZAN_NOVEMBAR },
        { ...NOVEMBAR, uslovi: () => BURA },
        { ...NOVEMBAR, uslovi: () => VLAZAN_NOVEMBAR },
      ],
    }),
    nivo: 'pazi',
    kod: 'kratak-prozor',
    dan: 'danas',
    glavno: 'Danas se vani neće osušiti.',
    detalj: 'Suho je samo od 9 do 15h, a vešu treba oko 10h. Suši unutra. Bolji dan je četvrtak.',
  },
  {
    ime: 'Kiša cijeli dan, sutra suho',
    prognoza: napraviPrognozu({
      sada: '2026-05-12T08:00',
      dani: [
        { ...MAJ, uslovi: () => KISA },
        { ...MAJ, uslovi: () => SUHO },
      ],
    }),
    nivo: 'nemoj',
    kod: 'kisa',
    dan: 'danas',
    glavno: 'Danas nemoj vani.',
    detalj: 'Kiša i vlaga cijeli dan. Bolji dan je sutra.',
  },
  {
    ime: 'Prevlažno cijelu sedmicu, bez kiše',
    prognoza: napraviPrognozu({ sada: '2026-11-16T08:00', dani: [{ ...NOVEMBAR, uslovi: () => PREVLAZNO }] }),
    nivo: 'nemoj',
    kod: 'vlaga',
    dan: 'danas',
    glavno: 'Danas nemoj vani.',
    detalj: 'Ne pada, ali je prevlažno da se išta osuši. Narednih dana nema boljeg.',
  },
  {
    ime: 'Jutarnja vlaga do 10h, poslije suho',
    prognoza: napraviPrognozu({
      sada: '2026-05-12T07:00',
      dani: [{ ...MAJ, uslovi: (h) => (h < 10 ? { ...SUHO, vlaga: 95 } : SUHO) }],
    }),
    nivo: 'moze',
    kod: 'pali-masinu',
    dan: 'danas',
    glavno: 'Pali mašinu do 13h, prostri od 10h.',
    detalj: 'Suho do 19h, suši se oko 4h.',
  },
  {
    ime: 'Jutarnja vlaga do 9h, u 8h (mašina završi kad je već suho)',
    prognoza: napraviPrognozu({
      sada: '2026-05-12T08:00',
      dani: [{ ...MAJ, uslovi: (h) => (h < 9 ? { ...SUHO, vlaga: 95 } : SUHO) }],
    }),
    nivo: 'moze',
    kod: 'pali-masinu',
    dan: 'danas',
    glavno: 'Pali mašinu do 13h, suho do 19h.',
    detalj: 'Vani je suho od 9h, suši se oko 4h.',
  },
  {
    ime: 'Pljusak u podne, 7h',
    prognoza: napraviPrognozu({
      sada: '2026-05-12T07:00',
      dani: [{ ...MAJ, uslovi: (h) => (h === 12 || h === 13 ? KISA : SUHO) }],
    }),
    nivo: 'moze',
    kod: 'pali-masinu',
    dan: 'danas',
    glavno: 'Pali mašinu do 13h, prostri od 14h.',
    detalj: 'Suho do 19h, suši se oko 4h.',
  },
  {
    ime: 'Zadnji čas: 11h, kiša od 17h',
    prognoza: napraviPrognozu({
      sada: '2026-04-10T11:00',
      dani: [{ zalazak: '19:20', uslovi: (h) => (h >= 17 ? KISA : SUHO) }],
    }),
    nivo: 'moze',
    kod: 'pali-odmah',
    dan: 'danas',
    glavno: 'Pali mašinu odmah, kiša od 17h.',
    detalj: 'Vani je suho već sad, suši se oko 4h.',
  },
  {
    ime: 'Sat kasnije: 12h, kiša od 17h',
    prognoza: napraviPrognozu({
      sada: '2026-04-10T12:00',
      dani: [{ zalazak: '19:20', uslovi: (h) => (h >= 17 ? KISA : SUHO) }],
    }),
    nivo: 'pazi',
    kod: 'prostri-oprano',
    dan: 'danas',
    glavno: 'Za mašinu je kasno. Opran veš prostri do 13h.',
    detalj: 'Kiša od 17h, suši se oko 4h. Za novu mašinu bolji dan je sutra.',
  },
  {
    ime: 'Ljeto, 15h',
    prognoza: napraviPrognozu({ sada: '2026-07-20T15:00', dani: [{ zalazak: '20:25', uslovi: () => LJETO }] }),
    nivo: 'pazi',
    kod: 'prostri-oprano',
    dan: 'danas',
    glavno: 'Za mašinu je kasno. Opran veš prostri do 16h.',
    detalj: 'Suho do 19h, suši se oko 3h. Za novu mašinu bolji dan je sutra.',
  },
  {
    ime: 'Navečer u maju, 20h',
    prognoza: napraviPrognozu({ sada: '2026-05-12T20:00', dani: [{ ...MAJ, uslovi: () => SUHO }] }),
    nivo: 'moze',
    kod: 'pali-masinu',
    dan: 'sutra',
    glavno: 'Sutra pali mašinu do 13h, suho do 19h.',
    detalj: 'Vani je suho od 7h, suši se oko 4h.',
  },
  {
    ime: 'Novembar, 13h, suh dan',
    prognoza: napraviPrognozu({ sada: '2026-11-16T13:00', dani: [{ ...NOVEMBAR, uslovi: () => HLADNO_SUHO }] }),
    nivo: 'moze',
    kod: 'pali-masinu',
    dan: 'sutra',
    glavno: 'Sutra pali mašinu do 9h, suho do 15h.',
    detalj: 'Vani je suho od 7h, suši se oko 4h.',
  },
  {
    ime: 'Novembar, 14h, sutra se suši cijeli dan',
    prognoza: napraviPrognozu({ sada: '2026-11-16T14:00', dani: [{ ...NOVEMBAR, uslovi: () => HLADNO_SPORO }] }),
    nivo: 'moze',
    kod: 'prostri',
    dan: 'sutra',
    glavno: 'Operi danas, sutra prostri do 8h.',
    detalj: 'Sutra je suho od 7 do 15h, suši se oko 7h.',
  },
];

const tabela: string[] = [];

describe('veš: scenariji', () => {
  for (const s of SCENARIJI) {
    it(s.ime, () => {
      const presuda = procijeniVes(s.prognoza);
      const recenica = vesRecenica(presuda);
      tabela.push(`| ${s.ime} | ${presuda.nivo} | ${recenica.glavno} | ${recenica.detalj} |`);

      expect(presuda.nivo).toBe(s.nivo);
      expect(presuda.kod).toBe(s.kod);
      expect(presuda.dan).toBe(s.dan);
      expect(recenica.glavno).toBe(s.glavno);
      expect(recenica.detalj).toBe(s.detalj);
    });
  }

  afterAll(() => {
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
    if (env?.TABELA) {
      console.log(['| Scenarij | Nivo | Glavno | Detalj |', '|---|---|---|---|', ...tabela].join('\n'));
    }
  });
});

describe('veš: pravila', () => {
  it('sutra nikad ne traži mašinu prije 7h', () => {
    for (const s of SCENARIJI) {
      const p = procijeniVes(s.prognoza);
      if (p.dan === 'sutra' && p.masinaDo !== null) expect(p.masinaDo).toBeGreaterThanOrEqual(7);
    }
  });

  it('danas nikad ne traži mašinu u satu koji je prošao', () => {
    for (const s of SCENARIJI) {
      const p = procijeniVes(s.prognoza);
      const sad = Number(s.prognoza.sada.vrijeme.slice(11, 13));
      if (p.dan === 'danas' && p.masinaDo !== null) expect(p.masinaDo).toBeGreaterThanOrEqual(sad);
    }
  });

  it('mašina + sušenje uvijek stanu prije kraja suhog prozora', () => {
    for (const s of SCENARIJI) {
      const p = procijeniVes(s.prognoza);
      if (p.masinaDo === null || p.trajanje === null || p.suhoDo === null) continue;
      expect(p.masinaDo + 2).toBeLessThanOrEqual(p.suhoDo - 1);
    }
  });

  it('ljeti u 15h ne preskače na sutra (stara greška s granicom u 14h)', () => {
    const p = procijeniVes(
      napraviPrognozu({ sada: '2026-07-20T15:00', dani: [{ zalazak: '20:25', uslovi: () => LJETO }] }),
    );
    expect(p.dan).toBe('danas');
  });

  it('bura suši brže od toplog dana bez vjetra', () => {
    const sat = (u: object) =>
      napraviPrognozu({ sada: '2026-05-12T10:00', dani: [{ uslovi: () => u }] }).sati[10]!;
    expect(brzinaSusenja(sat(BURA))).toBeGreaterThan(brzinaSusenja(sat(SUHO)));
    expect(brzinaSusenja(sat(VLAZAN_NOVEMBAR))).toBeLessThan(brzinaSusenja(sat(HLADNO_SUHO)));
  });
});

describe('veš: pregled po danima', () => {
  it('traka ide od 7h do sat prije zalaska i nosi stanje svakog sata', () => {
    const p = napraviPrognozu({
      sada: '2026-05-12T07:30',
      dani: [{ ...MAJ, uslovi: (h) => (h >= 15 ? KISA : h < 9 ? { ...SUHO, vlaga: 95 } : SUHO) }],
    });
    const [danas] = pregledVesa(p);
    expect(danas?.traka[0]).toEqual({ sat: 7, stanje: 'vlazno' });
    expect(danas?.traka.at(-1)).toEqual({ sat: 18, stanje: 'kisa' });
    expect(danas?.traka.find((s) => s.sat === 10)?.stanje).toBe('suho');
    expect(danas?.nivo).toBe('moze');
  });

  it('ocjena po danima: vlažno, pa bura', () => {
    const p = napraviPrognozu({
      sada: '2026-11-16T09:00',
      dani: [
        { ...NOVEMBAR, uslovi: () => VLAZAN_NOVEMBAR },
        { ...NOVEMBAR, uslovi: () => KISA },
        { ...NOVEMBAR, uslovi: () => BURA },
      ],
    });
    expect(pregledVesa(p).slice(0, 3).map((d) => d.nivo)).toEqual(['pazi', 'nemoj', 'moze']);
  });
});
