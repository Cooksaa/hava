import { describe, expect, it } from 'vitest';
import { kadRecenica, regijaZa, upozorenjaZa, type MaZapis } from './upozorenja';

function zapis(o: {
  regija?: string;
  vrsta?: number;
  nivo?: number;
  od: string;
  do: string;
  izdato: string;
  opis?: string;
  status?: string;
}): MaZapis {
  return {
    alert: {
      status: o.status ?? 'Actual',
      msgType: 'Alert',
      sent: o.izdato,
      info: [
        { language: 'en', description: 'english' },
        {
          language: 'bs',
          description: o.opis ?? 'Udari vjetra 40-80 km/h.',
          instruction: 'Budite spremni.',
          senderName: 'FHMZ BiH',
          onset: o.od,
          expires: o.do,
          parameter: [
            { valueName: 'awareness_level', value: `${o.nivo ?? 2}; x; y` },
            { valueName: 'awareness_type', value: `${o.vrsta ?? 1}; Wind` },
          ],
          area: [{ areaDesc: 'Mostar', geocode: [{ valueName: 'EMMA_ID', value: o.regija ?? 'BA008' }] }],
        },
      ],
    },
  };
}

const SAD = Date.parse('2026-11-19T14:00:00+01:00');

describe('regijaZa', () => {
  it('najbliži grad regije', () => {
    expect(regijaZa(43.1137, 17.6847)).toBe('BA008'); // Čapljina → Mostar
    expect(regijaZa(42.93, 17.62)).toBe('BA008'); // Neum
    expect(regijaZa(44.2, 17.9)).toBe('BA006'); // Zenica → Sarajevo
    expect(regijaZa(44.76, 19.21)).toBe('BA004'); // Bijeljina → Tuzla
  });

  it('daleko od BiH: ništa', () => {
    expect(regijaZa(44.79, 20.45)).toBeNull(); // Beograd
  });
});

describe('upozorenjaZa', () => {
  it('samo za regiju, bez isteklih', () => {
    const z = [
      zapis({ od: '2026-11-19T12:00:00+01:00', do: '2026-11-19T20:00:00+01:00', izdato: '2026-11-19T08:00:00+01:00' }),
      zapis({ regija: 'BA010', od: '2026-11-19T12:00:00+01:00', do: '2026-11-19T20:00:00+01:00', izdato: '2026-11-19T08:00:00+01:00' }),
      zapis({ od: '2026-11-18T00:00:00+01:00', do: '2026-11-18T23:59:59+01:00', izdato: '2026-11-17T08:00:00+01:00' }),
    ];
    const u = upozorenjaZa(z, 'BA008', SAD);
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ regija: 'Mostar', vrsta: 'vjetar', nivo: 2, opis: 'Udari vjetra 40–80 km/h.', izvor: 'FHMZ BiH' });
  });

  it('za istu vrstu i dan važi najnovije izdato', () => {
    const z = [
      zapis({ nivo: 2, od: '2026-11-19T00:00:00+01:00', do: '2026-11-19T23:59:59+01:00', izdato: '2026-11-17T08:00:00+01:00' }),
      zapis({ nivo: 3, od: '2026-11-19T12:00:00+01:00', do: '2026-11-19T23:59:59+01:00', izdato: '2026-11-19T08:00:00+01:00' }),
    ];
    const u = upozorenjaZa(z, 'BA008', SAD);
    expect(u.map((x) => x.nivo)).toEqual([3]);
  });

  it('ono što traje ide prije onoga što dolazi, pa ozbiljnije prije blažeg', () => {
    const z = [
      zapis({ vrsta: 10, nivo: 4, od: '2026-11-20T00:00:00+01:00', do: '2026-11-20T23:59:59+01:00', izdato: '2026-11-19T08:00:00+01:00' }),
      zapis({ vrsta: 1, nivo: 2, od: '2026-11-19T12:00:00+01:00', do: '2026-11-19T20:00:00+01:00', izdato: '2026-11-19T08:00:00+01:00' }),
    ];
    expect(upozorenjaZa(z, 'BA008', SAD).map((x) => x.vrsta)).toEqual(['vjetar', 'kiša']);
  });

  it('ne-stvarna (Test) i zelena se preskaču', () => {
    const z = [
      zapis({ status: 'Test', od: '2026-11-19T12:00:00+01:00', do: '2026-11-19T20:00:00+01:00', izdato: '2026-11-19T08:00:00+01:00' }),
      zapis({ nivo: 1, od: '2026-11-19T12:00:00+01:00', do: '2026-11-19T20:00:00+01:00', izdato: '2026-11-19T08:00:00+01:00' }),
    ];
    expect(upozorenjaZa(z, 'BA008', SAD)).toEqual([]);
  });
});

describe('kadRecenica', () => {
  const u = (od: string, do_: string) =>
    upozorenjaZa([zapis({ od, do: do_, izdato: '2026-11-19T08:00:00+01:00' })], 'BA008', SAD)[0]!;

  it('traje', () => {
    expect(kadRecenica(u('2026-11-19T12:00:00+01:00', '2026-11-19T20:00:00+01:00'), SAD)).toBe('traje do 20h');
    expect(kadRecenica(u('2026-11-19T12:00:00+01:00', '2026-11-19T23:59:59+01:00'), SAD)).toBe('traje do ponoći');
  });

  it('dolazi', () => {
    expect(kadRecenica(u('2026-11-19T18:00:00+01:00', '2026-11-19T23:59:59+01:00'), SAD)).toBe('danas od 18h do ponoći');
    expect(kadRecenica(u('2026-11-20T00:00:00+01:00', '2026-11-20T23:59:59+01:00'), SAD)).toBe('sutra cijeli dan');
    expect(kadRecenica(u('2026-11-21T06:00:00+01:00', '2026-11-21T15:00:00+01:00'), SAD)).toBe('21.11. od 6h do 15h');
  });
});
