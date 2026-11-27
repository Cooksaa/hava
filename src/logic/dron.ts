import type { Sat } from '../tipovi';

/*
 * Dron: može li se danas dići, sat po sat.
 *
 * Ključni broj je koliki vjetar dron izdrži (DJI ga daje u m/s). Gledamo vjetar na
 * visini leta (80–120 m, gdje puše jače nego na tlu) i udare, pa kišu, grmljavinu,
 * maglu i hladnoću (baterija). Pragovi su namjerno oprezni: dron koji leti na granici
 * otpora se ne vraća sam kući.
 *
 *   zeleno  vjetar na visini do 1/2 otpora, udari do 2/3
 *   žuto    do 3/4 otpora, udari do 0,9; ili moguća kiša, rosulja, magla, mraz
 *   crveno  jače od toga, kiša, snijeg, grmljavina
 */

export interface ModelDrona {
  id: string;
  ime: string;
  /** Najveći vjetar koji izdrži, m/s (DJI specifikacija). */
  otpor: number;
}

export const MODELI: ModelDrona[] = [
  { id: 'lito-1', ime: 'DJI Lito 1', otpor: 10.7 },
  { id: 'mini-4-pro', ime: 'DJI Mini 4 Pro', otpor: 10.7 },
  { id: 'mini-3', ime: 'DJI Mini 3 / 3 Pro', otpor: 10.7 },
  { id: 'mini-2', ime: 'DJI Mini 2 / SE', otpor: 10.7 },
  { id: 'flip', ime: 'DJI Flip', otpor: 10.7 },
  { id: 'avata-2', ime: 'DJI Avata 2', otpor: 10.7 },
  { id: 'neo', ime: 'DJI Neo', otpor: 8 },
  { id: 'air-3', ime: 'DJI Air 3 / 3S', otpor: 12 },
  { id: 'mavic-3', ime: 'DJI Mavic 3 / 4 Pro', otpor: 12 },
];

export const PODRAZUMIJEVANI = MODELI[0]!;

/** Model po id-u ("air-3", ili "drugi:8" za vlastiti otpor u m/s); nepoznato → podrazumijevani. */
export function modelPoId(id: string | null | undefined): ModelDrona {
  if (id?.startsWith('drugi:')) {
    const ms = Number(id.slice(6));
    if (ms >= 3 && ms <= 25) return { id, ime: `Dron do ${String(ms).replace('.', ',')} m/s`, otpor: ms };
  }
  return MODELI.find((m) => m.id === id) ?? PODRAZUMIJEVANI;
}

export type Ocjena = 'zeleno' | 'zuto' | 'crveno';

/** Vjetar na visini za jedan sat (km/h). */
export interface Visina {
  v80: number;
  v120: number;
}

export interface SatDrona {
  sat: Sat;
  ocjena: Ocjena;
  /** Vjetar na visini leta (jači od 80 i 120 m), km/h. */
  visina: number;
  /** Procjena udara na visini, km/h. */
  udari: number;
  /** Zašto nije zeleno, kratko: "udari 40 km/h", "kiša". */
  razlozi: string[];
}

const kmh = (ms: number): number => ms * 3.6;

const KISA = (k: number): boolean => (k >= 61 && k <= 67) || (k >= 80 && k <= 82);
const SNIJEG = (k: number): boolean => (k >= 71 && k <= 77) || k === 85 || k === 86;
const GRMLJAVINA = (k: number): boolean => k >= 95;
const ROSULJA = (k: number): boolean => k >= 51 && k <= 57;
const MAGLA = (k: number): boolean => k === 45 || k === 48;

/**
 * Ocjena jednog sata.
 * @param v vjetar na 80/120 m za taj sat; bez njega se procjenjuje iz vjetra na tlu
 */
export function ocijeniSat(sat: Sat, v: Visina | undefined, model: ModelDrona): SatDrona {
  const granica = kmh(model.otpor);
  // Na visini puše bar kao na tlu; bez podatka o visini, grubo ×1,3 (tipično za 100 m).
  const visina = Math.max(v ? Math.max(v.v80, v.v120) : sat.vjetar * 1.3, sat.vjetar);
  // Udari na visini: isti nalet kao na tlu, dodan na jači srednji vjetar gore.
  const udari = visina + Math.max(0, sat.udari - sat.vjetar);

  const crveno: string[] = [];
  const zuto: string[] = [];
  if (visina > granica * 0.75) crveno.push(`vjetar ${Math.round(visina)} km/h na visini`);
  else if (visina > granica * 0.5) zuto.push(`vjetar ${Math.round(visina)} km/h na visini`);
  if (udari > granica * 0.9) crveno.push(`udari do ${Math.round(udari)} km/h`);
  else if (udari > granica * (2 / 3)) zuto.push(`udari do ${Math.round(udari)} km/h`);

  if (GRMLJAVINA(sat.kod)) crveno.push('grmljavina');
  else if (SNIJEG(sat.kod)) crveno.push('snijeg');
  else if (KISA(sat.kod) || sat.kisaMm >= 0.5) crveno.push('kiša');
  else if (ROSULJA(sat.kod) || sat.kisaVjer >= 40) zuto.push(ROSULJA(sat.kod) ? 'rosulja' : 'moguća kiša');
  if (MAGLA(sat.kod)) zuto.push('magla');

  if (sat.temp < -10 || sat.temp > 40) crveno.push(`${Math.round(sat.temp)}°`);
  else if (sat.temp < 0) zuto.push('mraz, baterija slabije drži');

  const ocjena: Ocjena = crveno.length ? 'crveno' : zuto.length ? 'zuto' : 'zeleno';
  return { sat, ocjena, visina, udari, razlozi: crveno.length ? crveno : zuto };
}

/** Sati od `od` (lokalno "2026-11-24T13:00") do kraja dnevnog svjetla tog dana. */
export function satiZaDan(sati: Sat[], datum: string, izlazak: string, zalazak: string, od?: string): Sat[] {
  // Sat u kojem sunce izlazi se računa ako izlazi do pola sata (6:40 → od 7h).
  const prvi = Number(izlazak.slice(11, 13)) + (Number(izlazak.slice(14, 16)) > 30 ? 1 : 0);
  // Sat u kojem sunce zalazi se računa ako zalazi poslije pola sata.
  const zadnji = Number(zalazak.slice(11, 13)) - (Number(zalazak.slice(14, 16)) < 30 ? 1 : 0);
  return sati.filter((s) => s.datum === datum && s.sat >= prvi && s.sat <= zadnji && (!od || s.vrijeme >= od));
}

export interface DronPresuda {
  ocjena: Ocjena;
  dan: 'danas' | 'sutra';
  /** Jedna rečenica: "Leti sad, mirno do 14h." */
  glavno: string;
  sati: SatDrona[];
}

const doKraja = (s: SatDrona[], i: number, ok: (x: SatDrona) => boolean): number => {
  let j = i;
  while (j < s.length && ok(s[j]!)) j++;
  return j;
};

/** Glavni razlog dana: najjači vjetar ili prva padavina. */
function zastoNe(s: SatDrona[]): string {
  const najgori = s.filter((x) => x.ocjena === 'crveno');
  const vjetar = najgori.filter((x) => x.razlozi.some((r) => r.startsWith('udari') || r.startsWith('vjetar')));
  if (vjetar.length) return `udari do ${Math.round(Math.max(...vjetar.map((x) => x.udari)))} km/h na visini`;
  return najgori[0]?.razlozi[0] ?? 'loše vrijeme';
}

/**
 * Presuda za ostatak danas (ako ima bar 2 sata svjetla), inače za sutra.
 * @param sad lokalno vrijeme mjesta, "2026-11-24T13:00"
 */
export function presudaDrona(
  dan: { datum: string; izlazak: string; zalazak: string }[],
  sati: Sat[],
  visine: Map<string, Visina>,
  model: ModelDrona,
  sad: string
): DronPresuda | null {
  const satSad = `${sad.slice(0, 13)}:00`;
  for (const [i, d] of dan.slice(0, 2).entries()) {
    const odabrani = satiZaDan(sati, d.datum, d.izlazak, d.zalazak, i === 0 ? satSad : undefined);
    if (i === 0 && odabrani.length < 2) continue;
    const s = odabrani.map((x) => ocijeniSat(x, visine.get(x.vrijeme), model));
    if (!s.length) continue;
    const kada = i === 0 ? 'danas' : 'sutra';
    const prvi = s[0]!;
    const uSatu = (x: SatDrona): string => `${x.sat.sat}h`;
    const mirno = (x: SatDrona): boolean => x.ocjena === 'zeleno';
    const moze = (x: SatDrona): boolean => x.ocjena !== 'crveno';

    // Danas, i sad je dobro.
    if (i === 0 && mirno(prvi)) {
      const kraj = doKraja(s, 0, mirno);
      const glavno = kraj >= s.length ? 'Leti, mirno do mraka.' : `Leti sad, mirno do ${uSatu(s[kraj]!)}.`;
      return { ocjena: 'zeleno', dan: kada, glavno, sati: s };
    }
    const zeleni = s.findIndex(mirno);
    if (zeleni >= 0) {
      const kraj = doKraja(s, zeleni, mirno);
      const doKad = kraj >= s.length ? 'do mraka' : `do ${uSatu(s[kraj]!)}`;
      const glavno =
        i === 0
          ? `${moze(prvi) ? 'Može, ali pazi' : 'Sad ne'}. Mirno od ${uSatu(s[zeleni]!)} ${doKad}.`
          : `Sutra mirno od ${uSatu(s[zeleni]!)} ${doKad}.`;
      // Danas: ocjena je za sad. Sutra: ima mirnog vremena, to je odgovor.
      const ocjena: Ocjena = i === 0 ? (moze(prvi) ? 'zuto' : 'crveno') : 'zeleno';
      return { ocjena, dan: kada, glavno, sati: s };
    }
    const zuti = s.findIndex(moze);
    if (zuti >= 0) {
      const razlog = s[zuti]!.razlozi[0] ?? '';
      const glavno = `${
        i === 0
          ? zuti === 0
            ? 'Može, ali pazi'
            : `Može od ${uSatu(s[zuti]!)}, ali pazi`
          : `Sutra može od ${uSatu(s[zuti]!)}, ali pazi`
      }: ${razlog}.`;
      return { ocjena: 'zuto', dan: kada, glavno, sati: s };
    }
    return { ocjena: 'crveno', dan: kada, glavno: `${i === 0 ? 'Danas' : 'Sutra'} ne: ${zastoNe(s)}.`, sati: s };
  }
  return null;
}

/* --- Zlatni i plavi sat --- */

const rad = Math.PI / 180;

/** Visina sunca iznad horizonta, stepeni (NOAA, uprošteno; ±0,5°). */
export function visinaSunca(ms: number, lat: number, lon: number): number {
  const d = ms / 864e5 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dek = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const h = (gmst * 15 + lon) * rad - ra;
  return Math.asin(Math.sin(lat * rad) * Math.sin(dek) + Math.cos(lat * rad) * Math.cos(dek) * Math.cos(h)) / rad;
}

export interface Svjetlo {
  /** ms */
  od: number;
  do: number;
}

/**
 * Zlatni (sunce od −4° do 6°) i plavi sat (−6° do −4°) za dan koji počinje u `ponoc` (ms),
 * jutro i veče. Fotografima i snimateljima je to najbolje svjetlo.
 */
export function zlatniPlavi(ponoc: number, lat: number, lon: number): { zlatni: Svjetlo[]; plavi: Svjetlo[] } {
  const zlatni: Svjetlo[] = [];
  const plavi: Svjetlo[] = [];
  let z: number | null = null;
  let p: number | null = null;
  for (let t = ponoc; t <= ponoc + 864e5; t += 60_000) {
    const h = visinaSunca(t, lat, lon);
    const uZ = h >= -4 && h <= 6;
    const uP = h >= -6 && h < -4;
    if (uZ && z === null) z = t;
    if (!uZ && z !== null) {
      zlatni.push({ od: z, do: t });
      z = null;
    }
    if (uP && p === null) p = t;
    if (!uP && p !== null) {
      plavi.push({ od: p, do: t });
      p = null;
    }
  }
  return { zlatni, plavi };
}
