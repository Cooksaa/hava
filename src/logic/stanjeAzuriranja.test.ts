import { describe, expect, it } from 'vitest';
import { opisAzuriranja, PRAZNO, type StanjeAzuriranja } from './stanjeAzuriranja';

// 19.11.2026. 17:30 u Sarajevu
const SAD = Date.parse('2026-11-19T16:30:00Z');
const st = (s: Partial<StanjeAzuriranja>): StanjeAzuriranja => ({ ...PRAZNO, ...s });

describe('opisAzuriranja', () => {
  it('nikad provjereno', () => {
    expect(opisAzuriranja(PRAZNO, '0.4.1', SAD)).toEqual({ glavno: 'Još nije provjereno.', detalji: [] });
  });

  it('najnovija verzija, s vremenom provjere', () => {
    const o = opisAzuriranja(st({ provjereno: SAD - 5 * 60_000, zadnja: '0.4.1' }), '0.4.1', SAD);
    expect(o.glavno).toBe('Imaš najnoviju verziju.');
    expect(o.detalji).toEqual(['Zadnja provjera: prije 5 min.']);
  });

  it('skinuta verzija čeka izlazak iz aplikacije', () => {
    const o = opisAzuriranja(st({ provjereno: SAD, zadnja: '0.4.2', paket: { verzija: '0.4.2', status: 'spreman' } }), '0.4.1', SAD);
    expect(o.glavno).toBe('Verzija 0.4.2 je skinuta. Izađi iz aplikacije i vrati se, pa se uključi.');
  });

  it('pala verzija', () => {
    const o = opisAzuriranja(st({ zadnja: '0.4.2', provjereno: SAD, paket: { verzija: '0.4.2', status: 'pao' } }), '0.4.1', SAD);
    expect(o.glavno).toContain('nije pokrenula, pa je ostala 0.4.1');
  });

  it('paket koji je već uključen se ne pominje', () => {
    const o = opisAzuriranja(st({ zadnja: '0.4.1', provjereno: SAD, paket: { verzija: '0.4.1', status: 'spreman' } }), '0.4.1', SAD);
    expect(o.glavno).toBe('Imaš najnoviju verziju.');
  });

  it('neuspjeh poslije uspješne provjere se vidi, stariji ne', () => {
    const neuspjeh = { kad: SAD - 2 * 60_000, zasto: 'nema interneta ili GitHub ne odgovara' };
    const o = opisAzuriranja(st({ provjereno: Date.parse('2026-11-19T13:05:00Z'), zadnja: '0.4.1', neuspjeh }), '0.4.1', SAD);
    expect(o.detalji).toEqual([
      'Zadnja provjera: danas u 14:05.',
      'Provjera prije 2 min nije uspjela: nema interneta ili GitHub ne odgovara.',
    ]);
    const stari = { kad: SAD - 3 * 3600_000, zasto: 'x' };
    expect(opisAzuriranja(st({ provjereno: SAD, zadnja: '0.4.1', neuspjeh: stari }), '0.4.1', SAD).detalji).toHaveLength(1);
  });

  it('samo neuspjeh', () => {
    const o = opisAzuriranja(st({ neuspjeh: { kad: SAD, zasto: 'x' } }), '0.4.1', SAD);
    expect(o.glavno).toBe('Provjera nije uspjela.');
  });
});
