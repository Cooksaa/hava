/*
 * Pitanja za glasovnog asistenta (notch) i za ?pitaj= u adresi: "Mogu li danas dići dron?",
 * "Pada li u Čapljini?". Ovdje samo prepoznamo temu, mjesto i dan; odgovor slaže
 * ui/pitanja.ts od istih rečenica koje aplikacija već pokazuje.
 */

export type Tema =
  | 'dron'
  | 'ves'
  | 'kisa'
  | 'prskanje'
  | 'rostilj'
  | 'planina'
  | 'temperatura'
  | 'vjetar'
  | 'zrak'
  | 'upozorenja';

export interface Pitanje {
  tema: Tema | null;
  /** Ime mjesta iz ugrađene liste ("Čapljina"), ako je pomenuto. */
  mjesto: string | null;
  kada: 'danas' | 'sutra' | null;
}

/** Lokativ za ugrađena mjesta: "u Čapljini". Služi i za rečenicu i za prepoznavanje u pitanju. */
export const LOKATIV: Record<string, string> = {
  Čapljina: 'Čapljini',
  Mostar: 'Mostaru',
  Sarajevo: 'Sarajevu',
  Konjic: 'Konjicu',
  Jablanica: 'Jablanici',
  Neum: 'Neumu',
  Počitelj: 'Počitelju',
  Međugorje: 'Međugorju',
  Čitluk: 'Čitluku',
  Ljubuški: 'Ljubuškom',
  Stolac: 'Stocu',
  Blagaj: 'Blagaju',
  'Široki Brijeg': 'Širokom Brijegu',
  Grude: 'Grudama',
  Posušje: 'Posušju',
  Ravno: 'Ravnom',
  Trebinje: 'Trebinju',
  Bileća: 'Bileći',
  Nevesinje: 'Nevesinju',
  Gacko: 'Gacku',
  Prozor: 'Prozoru',
  Tomislavgrad: 'Tomislavgradu',
  Livno: 'Livnu',
  Kupres: 'Kupresu',
  Bugojno: 'Bugojnu',
  Jajce: 'Jajcu',
  Travnik: 'Travniku',
  Zenica: 'Zenici',
  Kakanj: 'Kaknju',
  Visoko: 'Visokom',
  Goražde: 'Goraždu',
  Foča: 'Foči',
  Višegrad: 'Višegradu',
  Tuzla: 'Tuzli',
  Zvornik: 'Zvorniku',
  Bijeljina: 'Bijeljini',
  Brčko: 'Brčkom',
  Doboj: 'Doboju',
  'Banja Luka': 'Banjoj Luci',
  Prijedor: 'Prijedoru',
  Bihać: 'Bihaću',
  Metković: 'Metkoviću',
  Ploče: 'Pločama',
  Makarska: 'Makarskoj',
  Dubrovnik: 'Dubrovniku',
};

/** Mala slova, bez kvačica i interpunkcije: "Može li?" → "moze li". Glas često ne piše kvačice. */
export function normalizuj(t: string): string {
  return t
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Redoslijed je bitan: prva tema koja se poklopi pobjeđuje ("dron" prije "vjetar"). */
const TEME: [Tema, RegExp][] = [
  ['dron', /\bdron|\bletjet|\bletet|\bpoletj/],
  ['prskanje', /\bprska|\bprsk/],
  ['ves', /\bves\b|\bvesa\b|\bvesom\b|\bmasin|\bprostr|\bsusi|\bsusen/],
  ['rostilj', /\brostilj|\bcevap|\bvani uvece|\bnapolj/],
  ['planina', /\bplanin|\bvrh|\bvrhu|\bplaninar/],
  ['upozorenja', /\bupozoren|\balarm|\bnevrijem|\bnarandzast|\bcrven/],
  ['zrak', /\bzrak|\bsmog|\bzagadj|\bpm/],
  ['vjetar', /\bvjetar|\bvjetr|\bpuse|\bbura\b|\bburu\b|\bjugo\b/],
  ['temperatura', /\btemperatur|\bstepen|\bhladno|\btoplo|\bkoliko je\b/],
  ['kisa', /\bkis|\bpada|\bpadati|\bkisobran|\bpljus|\bsnijeg/],
];

export function prepoznaj(tekst: string): Pitanje {
  const n = normalizuj(tekst);
  const tema = TEME.find(([, r]) => r.test(n))?.[0] ?? null;
  const kada = /\bsutra/.test(n) ? 'sutra' : /\bdanas|\buvece|\bvecer|\bsad\b|\bsada\b/.test(n) ? 'danas' : null;

  // Mjesto: najduže poklapanje imena ili lokativa ("banjoj luci" prije "luci").
  let mjesto: string | null = null;
  let duzina = 0;
  const rijeci = ` ${n} `;
  for (const [ime, lok] of Object.entries(LOKATIV)) {
    for (const oblik of [ime, lok]) {
      const o = normalizuj(oblik);
      if (o.length > duzina && rijeci.includes(` ${o} `)) {
        mjesto = ime;
        duzina = o.length;
      }
    }
  }
  return { tema, mjesto, kada };
}
