import type { Ocjena } from './dron';
import { jeGrmljavina, jePadavina, jeSnijeg } from './kodovi';

/*
 * Planinarenje: prognoza za vrh, ne za grad u dolini.
 * Open-Meteo prima visinu tačke (elevation) i preračuna temperaturu za nju; vjetar je
 * iz modela za tu tačku (na grebenu zna biti jači, pa su pragovi oprezni).
 *
 *   crveno  grmljavina, udari od 60 km/h, jaki pljusak, osjećaj ispod −15°
 *   žuto    udari od 40, kiša ili snijeg, vrh u oblaku (bez pogleda, lako se zaluta),
 *           mraz ispod −5°
 * Ljeti grmljavina popodne je najčešća opasnost: pominje se i kad je jutro lijepo.
 */

export interface Vrh {
  id: string;
  ime: string;
  /** "Bjelašnice" */
  genitiv: string;
  planina: string;
  visina: number;
  lat: number;
  lon: number;
}

/** Približne koordinate vrhova (prognoza ionako ide za mrežu ~2 km). */
export const VRHOVI: Vrh[] = [
  { id: 'velez', ime: 'Botin', genitiv: 'Botina', planina: 'Velež', visina: 1969, lat: 43.3069, lon: 17.9294 },
  { id: 'prenj', ime: 'Zelena glava', genitiv: 'Zelene glave', planina: 'Prenj', visina: 2155, lat: 43.5361, lon: 17.8964 },
  { id: 'cvrsnica', ime: 'Pločno', genitiv: 'Pločnog', planina: 'Čvrsnica', visina: 2228, lat: 43.5925, lon: 17.5633 },
  { id: 'vran', ime: 'Veliki Vran', genitiv: 'Velikog Vrana', planina: 'Vran', visina: 2074, lat: 43.6464, lon: 17.4694 },
  { id: 'bjelasnica', ime: 'Bjelašnica', genitiv: 'Bjelašnice', planina: 'Bjelašnica', visina: 2067, lat: 43.7058, lon: 18.2572 },
  { id: 'treskavica', ime: 'Mala Čaba', genitiv: 'Male Čabe', planina: 'Treskavica', visina: 2088, lat: 43.5869, lon: 18.3867 },
  { id: 'jahorina', ime: 'Ogorjelica', genitiv: 'Ogorjelice', planina: 'Jahorina', visina: 1916, lat: 43.7225, lon: 18.58 },
  { id: 'maglic', ime: 'Maglić', genitiv: 'Maglića', planina: 'Maglić', visina: 2386, lat: 43.2817, lon: 18.7317 },
  { id: 'vlasic', ime: 'Paljenik', genitiv: 'Paljenika', planina: 'Vlašić', visina: 1933, lat: 44.2961, lon: 17.6631 },
];

export interface SatVrha {
  vrijeme: string;
  datum: string;
  sat: number;
  temp: number;
  osjecaj: number;
  kod: number;
  kisaMm: number;
  vjetar: number;
  udari: number;
  /** niski oblaci, % (vrh u oblaku) */
  nisko: number;
}

export interface OcijenjenSatVrha {
  sat: SatVrha;
  ocjena: Ocjena;
  razlozi: string[];
}

export function ocijeniVrh(s: SatVrha): OcijenjenSatVrha {
  const crveno: string[] = [];
  const zuto: string[] = [];
  if (jeGrmljavina(s.kod)) crveno.push('grmljavina');
  if (s.udari >= 60) crveno.push(`udari ${Math.round(s.udari)} km/h`);
  else if (s.udari >= 40) zuto.push(`udari ${Math.round(s.udari)} km/h`);
  if (s.kisaMm >= 4) crveno.push('jak pljusak');
  else if (s.kisaMm >= 0.3 || (jePadavina(s.kod) && !jeGrmljavina(s.kod))) zuto.push(jeSnijeg(s.kod) ? 'snijeg' : 'kiša');
  if (s.osjecaj < -15) crveno.push(`osjećaj ${Math.round(s.osjecaj)}°`);
  else if (s.temp < -5) zuto.push(`${Math.round(s.temp)}°`);
  if (s.nisko >= 85) zuto.push('vrh u oblaku');
  const ocjena: Ocjena = crveno.length ? 'crveno' : zuto.length ? 'zuto' : 'zeleno';
  return { sat: s, ocjena, razlozi: crveno.length ? crveno : zuto };
}

export interface PresudaVrha {
  ocjena: Ocjena;
  dan: 'danas' | 'sutra';
  glavno: string;
  sati: OcijenjenSatVrha[];
}

/**
 * "Bjelašnica: lijepo do 14h, na vrhu −3°." / "Bjelašnica danas ne: udari 70 km/h."
 * Gleda dan od izlaska do zalaska sunca (bez podataka o suncu 7–17h); danas od sad,
 * a kad ostanu manje od 3 sata svjetla, sutra.
 */
export function presudaVrha(
  vrh: Vrh,
  sati: SatVrha[],
  sad: string,
  dani: { datum: string; izlazak: string; zalazak: string }[] = [],
): PresudaVrha | null {
  const sadKljuc = `${sad.slice(0, 13)}:00`;
  const datumi = [...new Set(sati.map((s) => s.datum))];
  for (const [i, datum] of datumi.slice(0, 2).entries()) {
    const d = dani.find((x) => x.datum === datum);
    // Izlazak 6:40 → od 7h; zalazak 16:20 → do 16h (sat u kojem zalazi se ne računa).
    const od = d ? Number(d.izlazak.slice(11, 13)) + (Number(d.izlazak.slice(14, 16)) > 30 ? 1 : 0) : 7;
    const doSata = d ? Number(d.zalazak.slice(11, 13)) : 17;
    const dan = sati.filter((s) => s.datum === datum && s.sat >= od && s.sat < doSata && (i > 0 || s.vrijeme >= sadKljuc));
    if (i === 0 && dan.length < 3) continue;
    if (!dan.length) continue;
    const o = dan.map(ocijeniVrh);
    const kada = i === 0 ? 'danas' : 'sutra';
    const ime = vrh.planina;
    const podne = dan.find((s) => s.sat === 12) ?? dan[Math.floor(dan.length / 2)]!;
    const temp = `na vrhu ${Math.round(podne.temp)}°`;
    const grom = o.find((x) => x.razlozi.includes('grmljavina'));
    const dobro = (x: OcijenjenSatVrha): boolean => x.ocjena === 'zeleno';
    const z = o.findIndex(dobro);
    if (z >= 0) {
      let k = z;
      while (k < o.length && dobro(o[k]!)) k++;
      const od = z === 0 ? '' : ` od ${o[z]!.sat.sat}h`;
      const doKad = k >= o.length ? '' : ` do ${o[k]!.sat.sat}h`;
      const pazi = grom && grom.sat.sat >= (o[z]!.sat.sat) ? `, grmljavina oko ${grom.sat.sat}h` : '';
      return {
        ocjena: grom ? 'zuto' : 'zeleno',
        dan: kada,
        sati: o,
        glavno: `${ime}${i === 1 ? ' sutra' : ''}: lijepo${od}${doKad}, ${temp}${pazi}.`,
      };
    }
    const zu = o.findIndex((x) => x.ocjena === 'zuto');
    if (zu >= 0) {
      return { ocjena: 'zuto', dan: kada, sati: o, glavno: `${ime}${i === 1 ? ' sutra' : ''}: može, ali ${o[zu]!.razlozi[0]}, ${temp}.` };
    }
    return { ocjena: 'crveno', dan: kada, sati: o, glavno: `${ime} ${kada} ne: ${o[0]!.razlozi[0]}.` };
  }
  return null;
}

/** Najbliži vrh mjestu (za početni izbor). */
export function najbliziVrh(lat: number, lon: number): Vrh {
  let naj = VRHOVI[0]!;
  let d = Infinity;
  for (const v of VRHOVI) {
    const x = (v.lat - lat) ** 2 + ((v.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (x < d) {
      d = x;
      naj = v;
    }
  }
  return naj;
}
