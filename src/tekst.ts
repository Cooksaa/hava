import type { Grad } from './config';
import { vjetarRecenica } from './logic/vjetar';
import type { KisaPresuda } from './logic/kisa';
import type { VesPresuda } from './logic/ves';
import { danUSedmici } from './logic/vrijeme';
import type { Dan, Sada } from './tipovi';

/*
 * Sve rečenice na jednom mjestu. Pravilo: kratko, kako bi rekao komšija.
 * Logika vraća strukturu, ovdje se od nje pravi tekst.
 */

const DANI = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];

const veliko = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function imeBoljegDana(v: VesPresuda): string | null {
  if (!v.boljiDan) return null;
  if (v.boljiDan.zaDana === 1) return 'sutra';
  return DANI[danUSedmici(v.boljiDan.datum)] ?? null;
}

export interface Recenica {
  glavno: string;
  detalj: string;
}

export function vesRecenica(v: VesPresuda): Recenica {
  const dan = v.dan === 'danas' ? 'Danas' : 'Sutra';
  // "kiša od 15h" je važnije od "suho do 15h", pa ima prednost.
  const rep = v.kisaOd !== null ? `kiša od ${v.kisaOd}h` : `suho do ${v.suhoDo}h`;
  const susenje = `suši se oko ${v.trajanje}h`;
  const bolji = imeBoljegDana(v);
  const boljiDan = bolji ? `Bolji dan je ${bolji}.` : 'Narednih dana nema boljeg.';

  switch (v.kod) {
    case 'pali-masinu':
    case 'pali-odmah': {
      const masina =
        v.kod === 'pali-odmah'
          ? 'Pali mašinu odmah'
          : `${v.dan === 'sutra' ? 'Sutra pali' : 'Pali'} mašinu do ${v.masinaDo}h`;

      // Suho tek kasnije (jutarnja vlaga, pljusak prije podne): to mora u glavnu rečenicu,
      // inače neko opere u 8 i prostre pod kišu.
      if (v.cekajSuho) {
        return {
          glavno: `${masina}, prostri od ${v.prostriOd}h.`,
          detalj: `${veliko(rep)}, ${susenje}.`,
        };
      }
      return {
        glavno: `${masina}, ${rep}.`,
        detalj: v.odmahSuho
          ? `Vani je suho već sad, ${susenje}.`
          : `Vani je suho od ${v.prostriOd}h, ${susenje}.`,
      };
    }

    case 'prostri-oprano':
      return {
        glavno: `Za mašinu je kasno. Opran veš prostri do ${v.prostriDo}h.`,
        detalj: `${veliko(rep)}, ${susenje}.${bolji ? ` Za novu mašinu bolji dan je ${bolji}.` : ''}`,
      };

    case 'prostri':
      return {
        glavno: `Operi danas, sutra prostri do ${v.prostriDo}h.`,
        detalj: `Sutra je suho od ${v.prostriOd} do ${v.suhoDo}h, ${susenje}.`,
      };

    case 'kratak-prozor':
      return {
        glavno: `${dan} se vani neće osušiti.`,
        detalj: `Suho je samo od ${v.prostriOd} do ${v.suhoDo}h, a vešu treba oko ${v.trajanje}h. Suši unutra. ${boljiDan}`,
      };

    case 'kisa':
      return {
        glavno: `${dan} nemoj vani.`,
        detalj: `Kiša i vlaga cijeli dan. ${boljiDan}`,
      };

    case 'vlaga':
      return {
        glavno: `${dan} nemoj vani.`,
        detalj: `Ne pada, ali je prevlažno da se išta osuši. ${boljiDan}`,
      };
  }
}

export function kisaRecenica(grad: Grad, k: KisaPresuda): string {
  const u = `U ${grad.lokativ}`;
  const snijeg = k.vrsta === 'snijeg';

  switch (k.kod) {
    case 'pada': {
      const pada = snijeg ? 'pada snijeg' : 'pada';
      if (k.stajeOko !== null) return `${u} ${pada}, staje oko ${k.stajeOko}h.`;
      if (k.uskoroStaje) return `${u} ${pada}, trebalo bi uskoro stati.`;
      return `${u} ${pada} i neće skoro stati.`;
    }
    case 'stize':
      return `${u} ne pada, ${snijeg ? 'snijeg' : 'kiša'} stiže oko ${k.stizeOko}h.`;
    case 'suho':
      return `${u} je suho narednih 12 sati.`;
  }
}

/** Kratko stanje za listu gradova. */
export function kisaKratko(k: KisaPresuda): string {
  const sta = k.vrsta === 'snijeg' ? 'snijeg' : 'kiša';
  switch (k.kod) {
    case 'pada':
      if (k.stajeOko !== null) return `pada do ${k.stajeOko}h`;
      return k.uskoroStaje ? 'pada, staje uskoro' : 'pada';
    case 'stize':
      return `${sta} oko ${k.stizeOko}h`;
    case 'suho':
      return 'suho';
  }
}

/* --- Trenutno vrijeme --- */

/** "11°", "−3°". Pravi minus, ne crtica. */
export function stepeni(n: number): string {
  const z = Math.round(n);
  return `${z < 0 ? '−' : ''}${Math.abs(z)}°`;
}

const OPISI: Record<number, string> = {
  0: 'Vedro',
  1: 'Pretežno vedro',
  2: 'Djelimično oblačno',
  3: 'Oblačno',
  45: 'Magla',
  48: 'Magla s injem',
  51: 'Slaba rosulja',
  53: 'Rosulja',
  55: 'Jaka rosulja',
  56: 'Ledena rosulja',
  57: 'Ledena rosulja',
  61: 'Slaba kiša',
  63: 'Kiša',
  65: 'Jaka kiša',
  66: 'Ledena kiša',
  67: 'Jaka ledena kiša',
  71: 'Slab snijeg',
  73: 'Snijeg',
  75: 'Jak snijeg',
  77: 'Sitan snijeg',
  80: 'Slabi pljuskovi',
  81: 'Pljuskovi',
  82: 'Jaki pljuskovi',
  85: 'Snježni pljuskovi',
  86: 'Jaki snježni pljuskovi',
  95: 'Grmljavina',
  96: 'Grmljavina s gradom',
  99: 'Jaka grmljavina s gradom',
};

export const opisVremena = (kod: number): string => OPISI[kod] ?? 'Promjenjivo';

/** @param jadran mjesto je u Hercegovini ili na primorju (bura, jugo), vidi logic/vjetar.ts */
export function sadaRecenica(s: Sada, jadran = false): string {
  const osjecaj = Math.abs(Math.round(s.osjecaj) - Math.round(s.temp)) >= 2 ? `, osjećaj ${stepeni(s.osjecaj)}` : '';
  return `${opisVremena(s.kod)}${osjecaj}. ${vjetarRecenica(s.vjetar, s.udari, s.smjer, jadran)}.`;
}

export const rasponRecenica = (d: Dan): string => `Danas od ${stepeni(d.tMin)} do ${stepeni(d.tMax)}`;

/* --- Stanja --- */

export function greskaRecenica(vrsta: 'mreza' | 'server' | null, prestara = false): string {
  if (prestara) return 'Nema interneta, a zadnja prognoza je prestara da bi vrijedila.';
  return vrsta === 'mreza'
    ? 'Nema interneta, a nemam ni staru prognozu za ovo mjesto.'
    : 'Prognoza trenutno ne stiže. Probaj za koju minutu.';
}

/** Kad nema veze, a na ekranu je stara prognoza. */
export function osvjezenoRecenica(spremljeno: number, sad = Date.now()): string {
  const d = new Date(spremljeno);
  const sat = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const istiDan = new Date(sad).toDateString() === d.toDateString();
  return istiDan
    ? `Nema interneta. Ovo je prognoza od ${sat}.`
    : `Nema interneta. Ovo je prognoza od ${d.getDate()}.${d.getMonth() + 1}. u ${sat}.`;
}

/* --- Dani i mjesta --- */

const DANI_KRATKO = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];

export const danKratko = (datum: string): string => DANI_KRATKO[danUSedmici(datum)] ?? '';

export function lokacijaGreska(g: 'zabranjeno' | 'nedostupno'): string {
  return g === 'zabranjeno'
    ? 'Lokacija je isključena za ovu stranicu. Uključi je u postavkama preglednika ili upiši mjesto.'
    : 'Ne mogu naći gdje si. Upiši mjesto.';
}

/* --- Veš, detalji --- */

/** Činjenice ispod rečenice: [šta, koliko]. Samo ono što za tu presudu ima smisla. */
export function vesCinjenice(v: VesPresuda): [string, string][] {
  const c: [string, string][] = [];
  const uspjeh = v.nivo === 'moze' || v.kod === 'prostri-oprano';

  if (v.kod === 'pali-odmah') c.push(['Mašina', 'odmah']);
  else if (v.masinaDo !== null) c.push(['Mašina', `najkasnije u ${v.masinaDo}h`]);

  if (uspjeh && v.prostriOd !== null && v.prostriDo !== null) {
    c.push([
      'Prostri',
      v.prostriOd === v.prostriDo ? `u ${v.prostriOd}h` : `od ${v.prostriOd}h, najkasnije u ${v.prostriDo}h`,
    ]);
  }
  if (!uspjeh && v.prostriOd !== null && v.suhoDo !== null) {
    c.push(['Najduže suho', `od ${v.prostriOd} do ${v.suhoDo}h`]);
  }
  if (v.trajanje !== null) c.push([uspjeh ? 'Sušenje' : 'Vešu treba', `oko ${v.trajanje}h`]);
  if (v.kisaOd !== null) c.push(['Kiša', `od ${v.kisaOd}h`]);
  else if (uspjeh && v.suhoDo !== null) c.push(['Suho', `do ${v.suhoDo}h`]);

  return c;
}

/** Jedna riječ za dan u listi. Null znači: za danas je kasno. */
export function vesOcjenaKratko(nivo: 'moze' | 'pazi' | 'nemoj' | null): string {
  return nivo === 'moze' ? 'može' : nivo === 'pazi' ? 'kratko' : nivo === 'nemoj' ? 'ne' : 'kasno';
}

/* --- Grad, detalji --- */

/** "12°, magla. Bez vjetra." */
export function gradDetalj(s: Sada, jadran = false): string {
  return `${stepeni(s.temp)}, ${opisVremena(s.kod).toLowerCase()}. ${vjetarRecenica(s.vjetar, s.udari, s.smjer, jadran)}.`;
}
