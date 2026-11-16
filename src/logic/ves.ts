import type { Dan, Prognoza, Sat } from '../tipovi';
import { PRAGOVI } from './pragovi';
import { datumIz, minuteIz, razlikaDana, satIz } from './vrijeme';

/*
 * Veš: od prognoze do presude "kad paliti mašinu, kad prostrijeti".
 * Čista funkcija, bez DOM-a i bez teksta. Rečenice pravi tekst.ts.
 *
 * Model sušenja je iz faze 0 (reference/faza0.html), s jednom razlikom: napredak
 * se sabira sat po sat od trenutka prostiranja, umjesto prosjeka za cijeli prozor.
 * Tako popodne, kad je toplije i suše, vrijedi više nego jutro.
 */

export type StanjeSata = 'suho' | 'vlazno' | 'kisa';

export type VesNivo = 'moze' | 'pazi' | 'nemoj';

export type VesKod =
  /** Ima vremena i za mašinu i za sušenje. */
  | 'pali-masinu'
  /** Zadnji čas: mašina mora krenuti u ovom satu. */
  | 'pali-odmah'
  /** Za mašinu je kasno, ali već opran veš stigne da se osuši. */
  | 'prostri-oprano'
  /** Sutra je dobro, ali se mora prostrijeti rano: operi dan ranije. */
  | 'prostri'
  /** Ima suhog vremena, ali nedovoljno dugo. */
  | 'kratak-prozor'
  /** Nema suhog sata, kiša. */
  | 'kisa'
  /** Ne pada, ali je prevlažno. */
  | 'vlaga';

export interface VesPresuda {
  nivo: VesNivo;
  kod: VesKod;
  /** Na koji dan se presuda odnosi. */
  dan: 'danas' | 'sutra';
  datum: string;
  /** Najkasniji sat za paljenje mašine. */
  masinaDo: number | null;
  /** Od kad je vani suho. */
  prostriOd: number | null;
  /** Najkasniji sat za prostiranje da se stigne osušiti. */
  prostriDo: number | null;
  /** Do kad traje suhi prozor. */
  suhoDo: number | null;
  /** Koliko sati se suši. Kod "kratak-prozor": koliko bi trebalo. */
  trajanje: number | null;
  /** Sat u kojem kreće kiša, ako prekida ili prati suhi prozor. */
  kisaOd: number | null;
  /** Vani je suho već u ovom satu (samo za danas). */
  odmahSuho: boolean;
  /**
   * Mašina upaljena sad (ili sutra rano) završila bi prije nego što vani bude suho:
   * s prostiranjem treba sačekati do `prostriOd`.
   */
  cekajSuho: boolean;
  /** Prvi naredni dan na koji se veš može osušiti. `zaDana` se broji od danas. */
  boljiDan: { datum: string; zaDana: number } | null;
}

const P = PRAGOVI.ves;

/** Da 0.2 + 0.2 + 0.2 + 0.2 + 0.2 ne ispadne "skoro 1". */
const EPS = 1e-9;

export function stanjeSata(s: Sat): StanjeSata {
  if (s.kisaVjer >= P.kisaVjer || s.kisaMm >= P.kisaMm) return 'kisa';
  if (s.vlaga >= P.vlaga) return 'vlazno';
  return 'suho';
}

/** Koliko brzo se veš suši u tom satu. 1 = obični uslovi, veće je brže. */
export function brzinaSusenja(s: Sat): number {
  const brzina =
    1 +
    (s.temp - 15) * 0.035 +
    Math.min(s.vjetar, 30) * 0.02 -
    (s.vlaga - 60) * 0.015 +
    (s.oblaci < 50 ? 0.15 : 0);
  return Math.min(P.maxBrzina, Math.max(P.minBrzina, brzina));
}

/** Koliko sati treba ako se prostre na početku `niz[od]`. Null ako se ne stigne do kraja niza. */
function satiSusenja(niz: Sat[], od: number): number | null {
  let napredak = 0;
  for (let i = od; i < niz.length; i++) {
    const s = niz[i];
    if (!s) break;
    napredak += brzinaSusenja(s) / P.baznoSati;
    if (napredak >= 1 - EPS) return i - od + 1;
  }
  return null;
}

/** Gruba procjena potrebnih sati kad se u nizu ne stigne osušiti. */
function procjenaSati(niz: Sat[]): number {
  const prosjek = niz.reduce((zbir, s) => zbir + brzinaSusenja(s), 0) / niz.length;
  return Math.ceil(P.baznoSati / prosjek - EPS);
}

/** Suhi niz u kojem se veš stigne osušiti. */
interface Kandidat {
  prostriOd: number;
  prostriDo: number;
  suhoDo: number;
  trajanje: number;
  kisaOd: number | null;
}

interface OcjenaDana {
  /** Sati u kojima veš smije biti vani: od jutra (ili od sad) do pred zalazak. */
  prozor: Sat[];
  /** Suhi nizovi u kojima se veš stigne osušiti, po redu. */
  kandidati: Kandidat[];
  /** Najduži suhi niz kad nijedan nije dovoljan, da se vidi koliko fali. */
  najduzi: { prostriOd: number; suhoDo: number; treba: number } | null;
  /** Prvi kišni sat u prozoru. */
  prvaKisa: number | null;
}

function suhiNizovi(prozor: Sat[]): Sat[][] {
  const nizovi: Sat[][] = [];
  let tekuci: Sat[] = [];
  for (const s of prozor) {
    if (stanjeSata(s) === 'suho') {
      tekuci.push(s);
    } else if (tekuci.length) {
      nizovi.push(tekuci);
      tekuci = [];
    }
  }
  if (tekuci.length) nizovi.push(tekuci);
  return nizovi;
}

function ocijeniDan(satiDana: Sat[], dan: Dan, odSata: number): OcjenaDana {
  const kraj = Math.floor((minuteIz(dan.zalazak) - P.prijeZalaska * 60) / 60);
  const pocetak = Math.max(P.pocetakDana, odSata);
  const prozor = satiDana.filter((s) => s.sat >= pocetak && s.sat < kraj);
  const nizovi = suhiNizovi(prozor);

  const kandidati: Kandidat[] = [];
  for (const niz of nizovi) {
    const prvi = niz[0];
    const zadnji = niz[niz.length - 1];
    const trajanje = satiSusenja(niz, 0);
    if (!prvi || !zadnji || trajanje === null) continue;

    // Najkasniji sat prostiranja iz kojeg se još stigne osušiti.
    let prostriDo = prvi.sat;
    for (let i = niz.length - 1; i > 0; i--) {
      const s = niz[i];
      if (s && satiSusenja(niz, i) !== null) {
        prostriDo = s.sat;
        break;
      }
    }

    // Kiša koja dolazi poslije niza: do kraja prozora i sat iza njega.
    const kisa = satiDana.find((x) => x.sat > zadnji.sat && x.sat <= kraj && stanjeSata(x) === 'kisa');

    kandidati.push({
      prostriOd: prvi.sat,
      prostriDo,
      suhoDo: zadnji.sat + 1,
      trajanje,
      kisaOd: kisa?.sat ?? null,
    });
  }

  let najduzi: OcjenaDana['najduzi'] = null;
  if (!kandidati.length && nizovi.length) {
    const niz = nizovi.reduce((a, b) => (b.length > a.length ? b : a));
    const prvi = niz[0];
    const zadnji = niz[niz.length - 1];
    if (prvi && zadnji) {
      najduzi = { prostriOd: prvi.sat, suhoDo: zadnji.sat + 1, treba: procjenaSati(niz) };
    }
  }

  return {
    prozor,
    kandidati,
    najduzi,
    prvaKisa: prozor.find((s) => stanjeSata(s) === 'kisa')?.sat ?? null,
  };
}

export function procijeniVes(p: Prognoza): VesPresuda {
  const danas = datumIz(p.sada.vrijeme);
  const sad = satIz(p.sada.vrijeme);

  const satiPoDatumu = new Map<string, Sat[]>();
  for (const s of p.sati) {
    const lista = satiPoDatumu.get(s.datum);
    if (lista) lista.push(s);
    else satiPoDatumu.set(s.datum, [s]);
  }

  const ocijeni = (dan: Dan, odSata: number): OcjenaDana =>
    ocijeniDan(satiPoDatumu.get(dan.datum) ?? [], dan, odSata);

  const boljiDan = (poslije: string): VesPresuda['boljiDan'] => {
    for (const d of p.dani) {
      if (d.datum <= poslije) continue;
      if (ocijeni(d, 0).kandidati.length) return { datum: d.datum, zaDana: razlikaDana(danas, d.datum) };
    }
    return null;
  };

  const neuspjeh = (o: OcjenaDana, dan: Dan, koji: 'danas' | 'sutra'): VesPresuda => {
    const kod: VesKod = o.najduzi ? 'kratak-prozor' : o.prvaKisa !== null ? 'kisa' : 'vlaga';
    return {
      nivo: kod === 'kratak-prozor' ? 'pazi' : 'nemoj',
      kod,
      dan: koji,
      datum: dan.datum,
      masinaDo: null,
      prostriOd: o.najduzi?.prostriOd ?? null,
      prostriDo: null,
      suhoDo: o.najduzi?.suhoDo ?? null,
      trajanje: o.najduzi?.treba ?? null,
      kisaOd: o.prvaKisa,
      odmahSuho: false,
      cekajSuho: false,
      boljiDan: boljiDan(dan.datum),
    };
  };

  const danDanas = p.dani.find((d) => d.datum === danas);
  const danSutra = p.dani.find((d) => d.datum > danas);

  if (danDanas) {
    const ostatak = ocijeni(danDanas, sad);
    // Prednost ima prozor u koji stane i mašina. Ako takvog nema, prvi u koji stane opran veš.
    const k =
      ostatak.kandidati.find((x) => x.prostriDo - P.trajanjeMasine >= sad) ?? ostatak.kandidati[0];

    if (k) {
      const masinaDo = k.prostriDo - P.trajanjeMasine;
      const kod: VesKod =
        masinaDo > sad ? 'pali-masinu' : masinaDo === sad ? 'pali-odmah' : 'prostri-oprano';
      return {
        nivo: kod === 'prostri-oprano' ? 'pazi' : 'moze',
        kod,
        dan: 'danas',
        datum: danas,
        masinaDo: kod === 'prostri-oprano' ? null : masinaDo,
        prostriOd: k.prostriOd,
        prostriDo: k.prostriDo,
        suhoDo: k.suhoDo,
        trajanje: k.trajanje,
        kisaOd: k.kisaOd,
        odmahSuho: k.prostriOd === sad,
        cekajSuho: k.prostriOd > sad + P.trajanjeMasine,
        boljiDan: kod === 'prostri-oprano' ? boljiDan(danas) : null,
      };
    }

    // Ne stiže se. Je li kriv dan ili sat? Ako bi cijeli dan od jutra bio dovoljan,
    // onda je samo kasno, pa je korisnije reći šta je sutra.
    const kasnoJe = ocijeni(danDanas, 0).kandidati.length > 0;
    if (!kasnoJe && ostatak.prozor.length > 0) return neuspjeh(ostatak, danDanas, 'danas');
  }

  if (danSutra) {
    const sutra = ocijeni(danSutra, 0);
    const k =
      sutra.kandidati.find((x) => x.prostriDo - P.trajanjeMasine >= P.pocetakDana) ??
      sutra.kandidati[0];

    if (k) {
      const masinaDo = k.prostriDo - P.trajanjeMasine;
      const stigneUjutro = masinaDo >= P.pocetakDana;
      return {
        nivo: 'moze',
        kod: stigneUjutro ? 'pali-masinu' : 'prostri',
        dan: 'sutra',
        datum: danSutra.datum,
        masinaDo: stigneUjutro ? masinaDo : null,
        prostriOd: k.prostriOd,
        prostriDo: k.prostriDo,
        suhoDo: k.suhoDo,
        trajanje: k.trajanje,
        kisaOd: k.kisaOd,
        odmahSuho: false,
        cekajSuho: k.prostriOd > P.pocetakDana,
        boljiDan: null,
      };
    }
    return neuspjeh(sutra, danSutra, 'sutra');
  }

  // Nema podataka ni za danas ni za sutra.
  return {
    nivo: 'nemoj',
    kod: 'vlaga',
    dan: 'danas',
    datum: danas,
    masinaDo: null,
    prostriOd: null,
    prostriDo: null,
    suhoDo: null,
    trajanje: null,
    kisaOd: null,
    odmahSuho: false,
    cekajSuho: false,
    boljiDan: null,
  };
}

/* --- Pregled po danima: za traku na kartici i za listu u detaljima --- */

export interface SatTrake {
  sat: number;
  stanje: StanjeSata;
}

export interface DanPregled {
  datum: string;
  /** Ocjena cijelog dana, od jutra. Ne zna koliko je sati sad. */
  nivo: VesNivo;
  /** Sati u kojima veš smije biti vani, od jutra do pred zalazak. */
  traka: SatTrake[];
}

export function pregledVesa(p: Prognoza): DanPregled[] {
  return p.dani.map((dan) => {
    const o = ocijeniDan(
      p.sati.filter((s) => s.datum === dan.datum),
      dan,
      0,
    );
    return {
      datum: dan.datum,
      nivo: o.kandidati.length ? 'moze' : o.najduzi ? 'pazi' : 'nemoj',
      traka: o.prozor.map((s) => ({ sat: s.sat, stanje: stanjeSata(s) })),
    };
  });
}
