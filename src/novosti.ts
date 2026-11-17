import type { Novost } from './logic/novosti';

/*
 * Šta je novo, po verziji. Kratko, kako bi rekao komšija: šta se promijenilo za
 * onoga ko koristi aplikaciju, ne šta je promijenjeno u kodu.
 * Verzija bez stavki ovdje (sitna popravka) se u "Šta je novo" ne pokazuje.
 */
export const NOVOSTI: Novost[] = [
  {
    verzija: '0.3.1',
    stavke: ['Poslije ažuriranja ovdje piše šta je novo. Jednom, pa nestane.'],
  },
  {
    verzija: '0.3.0',
    stavke: [
      'Prognoza je tačnija. Glavni model je sad italijanski ICON-2I, koji kod nas najbolje pogađa.',
      'Gdje je blizu aerodrom, temperatura „sad“ je izmjerena, ne izračunata.',
      'Nebo je živo: kiša, snijeg, oblaci i zvijezde se kreću iza kartica.',
      'Povuci ekran nadolje i prognoza se osvježi.',
    ],
  },
];
