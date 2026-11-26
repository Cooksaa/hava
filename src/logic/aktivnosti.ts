import type { Ocjena } from './dron';
import { jeGrmljavina, jePadavina } from './kodovi';
import type { Prognoza, Sat } from '../tipovi';

/*
 * Aktivnosti: prskanje i roštilj (planina je u logic/planina.ts).
 * Isti oblik kao dron: ocjena svakog sata (zeleno/žuto/crveno) i jedna rečenica.
 *
 * Prskanje (voćnjak, vinograd), uobičajene preporuke za zaštitu bilja:
 *   vjetar do 10 km/h dobro, do 15 pazi (zanošenje), jači ne; udari preko 25 ne
 *   bez kiše 6 sati poslije (ispere sredstvo): kiša u 2 h = ne, u 3–6 h = pazi
 *   8–25° dobro; vruće (>25°) ili hladno (<8°) pazi, preko 30° ne (isparava)
 *   samo po danu
 * Roštilj: veče (16–23h), suho, bez jakog vjetra, toplo.
 */

export interface OcijenjenSat {
  sat: Sat;
  ocjena: Ocjena;
  razlozi: string[];
}

export interface PresudaAktivnosti {
  ocjena: Ocjena;
  dan: 'danas' | 'sutra';
  glavno: string;
  sati: OcijenjenSat[];
}

const mokar = (s: Sat): boolean => s.kisaMm >= 0.2 || s.kisaVjer >= 40 || jePadavina(s.kod);
const ocjena = (crveno: string[], zuto: string[]): Ocjena => (crveno.length ? 'crveno' : zuto.length ? 'zuto' : 'zeleno');
const h = (s: OcijenjenSat): string => `${s.sat.sat}h`;

/** Sati dana od `odSata` (uključivo) do `doSata` (isključivo), počevši od sad. */
function satiDana(p: Prognoza, datum: string, odSata: number, doSata: number, sadKljuc?: string): Sat[] {
  return p.sati.filter((s) => s.datum === datum && s.sat >= odSata && s.sat < doSata && (!sadKljuc || s.vrijeme >= sadKljuc));
}

/* --- Prskanje --- */

export function ocijeniPrskanje(sati: Sat[], i: number): OcijenjenSat {
  const s = sati[i]!;
  const crveno: string[] = [];
  const zuto: string[] = [];
  if (s.vjetar > 15) crveno.push(`vjetar ${Math.round(s.vjetar)} km/h`);
  else if (s.vjetar > 10) zuto.push(`vjetar ${Math.round(s.vjetar)} km/h`);
  if (s.udari > 25 && !crveno.length) crveno.push(`udari ${Math.round(s.udari)} km/h`);

  // Kiša sad ili u narednih 6 sati ispere sredstvo.
  const naprijed = sati.slice(i, i + 7);
  const kisaZa = naprijed.findIndex(mokar);
  if (kisaZa === 0) crveno.push('pada');
  else if (kisaZa > 0 && kisaZa <= 2) crveno.push(`kiša za ${kisaZa} h`);
  else if (kisaZa > 2) zuto.push(`kiša za ${kisaZa} h`);

  if (s.temp > 30) crveno.push(`${Math.round(s.temp)}°, isparava`);
  else if (s.temp > 25) zuto.push(`${Math.round(s.temp)}°, bolje predveče`);
  else if (s.temp < 8) zuto.push(`${Math.round(s.temp)}°, hladno`);
  return { sat: s, ocjena: ocjena(crveno, zuto), razlozi: crveno.length ? crveno : zuto };
}

/** Prozor od i dok je ocjena dobra; vraća indeks prvog sata koji više nije. */
const kraj = (s: OcijenjenSat[], i: number, ok: (x: OcijenjenSat) => boolean): number => {
  let j = i;
  while (j < s.length && ok(s[j]!)) j++;
  return j;
};

/**
 * "Prskaj sad, mirno do 11h." / "Prskaj od 14h do 17h." / "Danas ne: kiša za 2 h. Sutra od 7h."
 */
export function prskanje(p: Prognoza): PresudaAktivnosti | null {
  const sadKljuc = `${p.sada.vrijeme.slice(0, 13)}:00`;
  const ocijeni = (datum: string, od?: string): OcijenjenSat[] => {
    // Samo po danu: od izlaska (6:40 → od 7h) do zalaska, i ne prije 6 ni poslije 20h.
    const d = p.dani.find((x) => x.datum === datum);
    const izlazak = d ? Number(d.izlazak.slice(11, 13)) + (Number(d.izlazak.slice(14, 16)) > 30 ? 1 : 0) : 6;
    const zalazak = d ? Number(d.zalazak.slice(11, 13)) + (Number(d.zalazak.slice(14, 16)) >= 30 ? 1 : 0) : 20;
    const odSata = Math.max(6, izlazak);
    const doSata = Math.min(20, zalazak);
    // Za kišu "6 sati poslije" trebaju i sati poslije prozora, pa ocjenjujemo na cijelom nizu.
    const svi = p.sati;
    return svi
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.datum === datum && s.sat >= odSata && s.sat < doSata && (!od || s.vrijeme >= od))
      .map(({ i }) => ocijeniPrskanje(svi, i));
  };
  const danas = p.dani[0];
  const sutra = p.dani[1];
  if (!danas) return null;
  const d = ocijeni(danas.datum, sadKljuc);
  const s = sutra ? ocijeni(sutra.datum) : [];
  const dobro = (x: OcijenjenSat): boolean => x.ocjena === 'zeleno';

  if (d.length >= 1) {
    if (dobro(d[0]!)) {
      const k = kraj(d, 0, dobro);
      return { ocjena: 'zeleno', dan: 'danas', sati: d, glavno: k >= d.length ? 'Prskaj, uslovi dobri do večeri.' : `Prskaj sad, dobro do ${h(d[k]!)}.` };
    }
    const z = d.findIndex(dobro);
    if (z >= 0) {
      const k = kraj(d, z, dobro);
      const doKad = k >= d.length ? 'do večeri' : `do ${h(d[k]!)}`;
      return { ocjena: d[0]!.ocjena === 'crveno' ? 'crveno' : 'zuto', dan: 'danas', sati: d, glavno: `Prskaj od ${h(d[z]!)} ${doKad}.` };
    }
  }
  const razlog = (d[0] ?? s[0])?.razlozi[0];
  const zs = s.findIndex(dobro);
  const sutraDio = zs >= 0 ? ` Sutra od ${h(s[zs]!)}.` : '';
  if (d.length && zs >= 0) return { ocjena: 'crveno', dan: 'danas', sati: d, glavno: `Danas ne${razlog ? `: ${razlog}` : ''}.${sutraDio}` };
  if (!d.length && zs >= 0) {
    const k = kraj(s, zs, dobro);
    return { ocjena: 'zeleno', dan: 'sutra', sati: s, glavno: `Sutra prskaj od ${h(s[zs]!)}${k < s.length ? ` do ${h(s[k]!)}` : ''}.` };
  }
  const sati = d.length ? d : s;
  return { ocjena: 'crveno', dan: d.length ? 'danas' : 'sutra', sati, glavno: `${d.length ? 'Danas i sutra' : 'Sutra'} ne${razlog ? `: ${razlog}` : ''}.` };
}

/* --- Roštilj --- */

export function ocijeniRostilj(s: Sat): OcijenjenSat {
  const crveno: string[] = [];
  const zuto: string[] = [];
  if (jeGrmljavina(s.kod)) crveno.push('grmljavina');
  else if (s.kisaMm >= 0.2 || jePadavina(s.kod)) crveno.push('kiša');
  else if (s.kisaVjer >= 30) zuto.push('moguća kiša');
  if (s.udari > 45) crveno.push(`udari ${Math.round(s.udari)} km/h`);
  else if (s.vjetar > 20 || s.udari > 35) zuto.push('puše');
  if (s.temp < 8) crveno.push(`${Math.round(s.temp)}°, hladno`);
  else if (s.temp < 15) zuto.push(`${Math.round(s.temp)}°, ponesi jaknu`);
  return { sat: s, ocjena: ocjena(crveno, zuto), razlozi: crveno.length ? crveno : zuto };
}

/** "Večeras lijepo do 22h." / "Večeras može, ali 12°, ponesi jaknu." / "Večeras ne: kiša od 19h." */
export function rostilj(p: Prognoza): PresudaAktivnosti | null {
  const sadKljuc = `${p.sada.vrijeme.slice(0, 13)}:00`;
  const danas = p.dani[0];
  const sutra = p.dani[1];
  if (!danas) return null;
  // Od 22h (ostala manje od 3 sata večeri) gledamo sutrašnje veče.
  let dan: 'danas' | 'sutra' = 'danas';
  let s = satiDana(p, danas.datum, 16, 24, sadKljuc);
  if (s.length < 3 && sutra) {
    dan = 'sutra';
    s = satiDana(p, sutra.datum, 16, 24);
  }
  const o = s.map(ocijeniRostilj);
  if (!o.length) return null;
  const kad = dan === 'danas' ? 'Večeras' : 'Sutra uveče';
  const dobro = (x: OcijenjenSat): boolean => x.ocjena === 'zeleno';
  const z = o.findIndex(dobro);
  if (z >= 0) {
    const k = kraj(o, z, dobro);
    const odKad = z === 0 ? '' : ` od ${h(o[z]!)}`;
    const doKad = k >= o.length ? '' : ` do ${h(o[k]!)}`;
    return { ocjena: 'zeleno', dan, sati: o, glavno: `${kad} lijepo${odKad}${doKad}.` };
  }
  const zu = o.findIndex((x) => x.ocjena === 'zuto');
  if (zu >= 0) return { ocjena: 'zuto', dan, sati: o, glavno: `${kad} može, ali ${o[zu]!.razlozi[0]}.` };
  const prvaKisa = o.find((x) => x.razlozi[0] === 'kiša' || x.razlozi[0] === 'grmljavina');
  const razlog = prvaKisa ? `${prvaKisa.razlozi[0]} od ${h(prvaKisa)}` : o[0]!.razlozi[0];
  return { ocjena: 'crveno', dan, sati: o, glavno: `${kad} ne: ${razlog}.` };
}
