import type { Novost } from './logic/novosti';

/*
 * Šta je novo, po verziji. Kratko, kako bi rekao komšija: šta se promijenilo za
 * onoga ko koristi aplikaciju, ne šta je promijenjeno u kodu.
 * Verzija bez stavki ovdje (sitna popravka) se u "Šta je novo" ne pokazuje.
 */
export const NOVOSTI: Novost[] = [
  {
    verzija: '0.4.1',
    stavke: [
      'Nove verzije stižu pouzdanije, i preko mobilnih podataka.',
      'Dodirni „Hava 0.4.1“ skroz dole: piše je li stigla nova verzija, a „Provjeri sad“ provjeri odmah.',
      'Povlačenje ekrana nadolje provjeri i novu verziju.',
    ],
  },
  {
    verzija: '0.4.0',
    stavke: [
      'Službena upozorenja zavoda (žuto, narandžasto, crveno) za kišu, vjetar i ostalo. Dodirni traku za cijeli tekst.',
      'Vjetar sa smjerom. U Hercegovini se zove kako treba: bura i jugo.',
      'U satima strelica i brzina vjetra kad puše.',
      'Kvalitet zraka ispod temperature, i upozori kad se uveče navuče smog.',
      'Kiša se crta lakše, telefon manje radi.',
    ],
  },
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
