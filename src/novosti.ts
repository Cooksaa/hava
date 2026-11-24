import type { Novost } from './logic/novosti';

/*
 * Šta je novo, po verziji. Kratko, kako bi rekao komšija: šta se promijenilo za
 * onoga ko koristi aplikaciju, ne šta je promijenjeno u kodu.
 * Verzija bez stavki ovdje (sitna popravka) se u "Šta je novo" ne pokazuje.
 */
export const NOVOSTI: Novost[] = [
  {
    verzija: '0.7.0',
    stavke: [
      'Dron: može li se danas dići, sat po sat u boji. Gleda vjetar na visini leta (80–120 m), udare, kišu i hladnoću.',
      'Izaberi svoj dron (DJI Lito 1, Mini, Air, Mavic, Neo…) ili upiši koliki vjetar izdrži.',
      'Zlatni i plavi sat za snimanje, jutro i veče.',
    ],
  },
  {
    verzija: '0.6.1',
    stavke: ['Popravljeno: kartica za uključivanje obavijesti se sad pokazuje pri dnu ekrana.'],
  },
  {
    verzija: '0.6.0',
    stavke: [
      'Radar na mapi: dugme gore, pored lupe, ili dodir na traku s kišom. Zadnji sat i sat unaprijed.',
      'Obavijesti za baš jaku kišu i vjetar, i kad je aplikacija zatvorena. Uključuju se pri dnu ekrana.',
    ],
  },
  {
    verzija: '0.5.2',
    stavke: [
      'Radar i mjerenja s aerodroma se osvježe svakih 5 minuta dok je aplikacija otvorena.',
      'Službena upozorenja svakih 15 minuta.',
      'Ova verzija je stigla sama: ažuriranje radi.',
    ],
  },
  {
    verzija: '0.5.1',
    stavke: ['Popravljeno ažuriranje: nove verzije sad stižu same, bez instaliranja APK-a.'],
  },
  {
    verzija: '0.5.0',
    stavke: [
      'Kiša s radara: kad je kiša blizu, ispod temperature piše kad počinje ili staje, s trakom za naredna 2 sata.',
      'Prvih pola sata je prilično tačno, dalje sve grublje. Poslije sat vremena piše samo „moguća“.',
      'Veš gleda i radar: ako kiša stiže u narednom satu, kaže da ne prostireš sad.',
    ],
  },
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
