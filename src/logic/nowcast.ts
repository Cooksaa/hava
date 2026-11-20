import type { Polje } from './radar';

/*
 * Kiša minut po minut: kuda se kiša na radaru kreće i kad stiže do tačke.
 *
 * Najjednostavniji pošten način (kao stari "nowcast" službi): uzmi dva snimka
 * u razmaku od ~30 minuta, nađi pomak za koji se najbolje poklapaju, pa zadnji
 * snimak pomjeraj tim pomakom unaprijed. Kiša ne raste i ne slabi, samo putuje.
 * Zato je tačno prvih 30–60 minuta, a dalje sve grublje; poslije 2 sata ništa.
 *
 * Nesigurnost se računa krugom oko tačke koji raste s vremenom: "vjerovatnoća"
 * je dio kruga na kojem pada. Ako kiša ide rubom, to se vidi kao 30–50 %.
 */

/** Pomak u pikselima po minuti (x udesno = istok, y nadolje = jug). */
export interface Kretanje {
  vx: number;
  vy: number;
}

/** Kiša jača od ovoga (mm/h) se broji. Radar ispod ~15 dBZ ionako ne crtamo. */
export const PRAG_MMH = 0.1;

/** Uprosječi polje u ćelije f×f; vrijednost je log(1 + mm/h), da pljusak ne nadjača sve. */
function grubo(p: Polje, f: number): { s: number; v: number; d: Float32Array } {
  const s = Math.floor(p.sirina / f);
  const v = Math.floor(p.visina / f);
  const d = new Float32Array(s * v);
  for (let y = 0; y < v * f; y++) {
    for (let x = 0; x < s * f; x++) {
      const k = p.kisa[y * p.sirina + x]!;
      if (k > 0) d[Math.floor(y / f) * s + Math.floor(x / f)]! += Math.log1p(k) / (f * f);
    }
  }
  return { s, v, d };
}

/** Kosinusna sličnost a(x) i b(x + d) na preklopu. */
function slicnost(a: Float32Array, b: Float32Array, s: number, v: number, dx: number, dy: number): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  const x0 = Math.max(0, -dx);
  const x1 = Math.min(s, s - dx);
  const y0 = Math.max(0, -dy);
  const y1 = Math.min(v, v - dy);
  for (let y = y0; y < y1; y++) {
    const ra = y * s;
    const rb = (y + dy) * s + dx;
    for (let x = x0; x < x1; x++) {
      const va = a[ra + x]!;
      const vb = b[rb + x]!;
      ab += va * vb;
      aa += va * va;
      bb += vb * vb;
    }
  }
  return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0;
}

function najbolji(
  a: Float32Array,
  b: Float32Array,
  s: number,
  v: number,
  cx: number,
  cy: number,
  r: number,
): { dx: number; dy: number; sl: number } {
  let naj = { dx: cx, dy: cy, sl: -1 };
  for (let dy = cy - r; dy <= cy + r; dy++) {
    for (let dx = cx - r; dx <= cx + r; dx++) {
      const sl = slicnost(a, b, s, v, dx, dy);
      // Kod jednakih, manji pomak (mirna kiša, smetnje koje stoje).
      if (sl > naj.sl + 1e-9 || (Math.abs(sl - naj.sl) <= 1e-9 && Math.hypot(dx, dy) < Math.hypot(naj.dx, naj.dy))) {
        naj = { dx, dy, sl };
      }
    }
  }
  return naj;
}

/**
 * Kretanje kiše između dva snimka istog pravougaonika.
 * @param minuta razmak snimaka
 * @param najvise najveća brzina koja se traži, piksela po minuti
 * @returns null ako nema dovoljno kiše da se kretanje pouzdano odredi
 */
export function kretanje(staro: Polje, novo: Polje, minuta: number, najvise: number): Kretanje | null {
  // Od grubog ka finom: 4×4, pa 2×2, pa puni pikseli. Brzo i na slabijem telefonu.
  const g4a = grubo(staro, 4);
  const g4b = grubo(novo, 4);
  const kisnih = (d: Float32Array): number => d.reduce((n, x) => n + (x > 0.02 ? 1 : 0), 0);
  if (kisnih(g4a.d) < 12 || kisnih(g4b.d) < 12) return null;

  const r4 = Math.ceil((najvise * minuta) / 4);
  const p4 = najbolji(g4a.d, g4b.d, g4a.s, g4a.v, 0, 0, r4);
  if (p4.sl < 0.3) return null;

  const g2a = grubo(staro, 2);
  const g2b = grubo(novo, 2);
  const p2 = najbolji(g2a.d, g2b.d, g2a.s, g2a.v, p4.dx * 2, p4.dy * 2, 2);
  const g1a = grubo(staro, 1);
  const g1b = grubo(novo, 1);
  const p1 = najbolji(g1a.d, g1b.d, g1a.s, g1a.v, p2.dx * 2, p2.dy * 2, 2);
  return { vx: p1.dx / minuta, vy: p1.dy / minuta };
}

export interface Korak {
  /** Minuta od sad. */
  min: number;
  /** 0–1: dio okoline na kojem pada. */
  vjer: number;
  /** Prosjek gdje pada, mm/h. */
  mmh: number;
  snijeg: boolean;
}

export interface PostavkeTacke {
  /** Koliko je zadnji snimak star u trenutku "sad", minuta. */
  kasnjenje: number;
  kmPoPikselu: number;
  korak?: number;
  trajanje?: number;
}

/** Poluprečnik okoline (km): 4 km odmah, pa raste s vremenom jer je pomak sve nesigurniji. */
export const okolinaKm = (minutaUnaprijed: number): number => 4 + 0.15 * minutaUnaprijed;

/**
 * Šta će padati na tački (cx, cy) u polju, svakih `korak` minuta od sad.
 * Bez kretanja (nema dovoljno kiše na radaru): kiša ostaje gdje jeste.
 */
export function prognozaTacke(
  polje: Polje,
  k: Kretanje | null,
  cx: number,
  cy: number,
  { kasnjenje, kmPoPikselu, korak = 5, trajanje = 120 }: PostavkeTacke,
): Korak[] {
  const vx = k?.vx ?? 0;
  const vy = k?.vy ?? 0;
  const koraci: Korak[] = [];
  for (let min = 0; min <= trajanje; min += korak) {
    const unaprijed = kasnjenje + min;
    // Kiša koja će tad biti ovdje je sad uzvodno.
    const sx = cx - vx * unaprijed;
    const sy = cy - vy * unaprijed;
    const r = okolinaKm(unaprijed) / kmPoPikselu;
    let ukupno = 0;
    let kisnih = 0;
    let zbir = 0;
    let snijeg = 0;
    for (let y = Math.ceil(sy - r); y <= Math.floor(sy + r); y++) {
      if (y < 0 || y >= polje.visina) continue;
      for (let x = Math.ceil(sx - r); x <= Math.floor(sx + r); x++) {
        if (x < 0 || x >= polje.sirina || (x - sx) ** 2 + (y - sy) ** 2 > r * r) continue;
        ukupno++;
        const i = y * polje.sirina + x;
        const v = polje.kisa[i]!;
        if (v >= PRAG_MMH) {
          kisnih++;
          zbir += v;
          snijeg += polje.snijeg[i]!;
        }
      }
    }
    koraci.push({
      min,
      vjer: ukupno ? kisnih / ukupno : 0,
      mmh: kisnih ? zbir / kisnih : 0,
      snijeg: kisnih > 0 && snijeg * 2 > kisnih,
    });
  }
  return koraci;
}

/** Ima li kiše na radaru unutar `km` od tačke. */
export function kisaUKrugu(polje: Polje, cx: number, cy: number, km: number, kmPoPikselu: number): boolean {
  const r = km / kmPoPikselu;
  for (let y = Math.max(0, Math.ceil(cy - r)); y <= Math.min(polje.visina - 1, Math.floor(cy + r)); y++) {
    for (let x = Math.max(0, Math.ceil(cx - r)); x <= Math.min(polje.sirina - 1, Math.floor(cx + r)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && polje.kisa[y * polje.sirina + x]! >= PRAG_MMH) return true;
    }
  }
  return false;
}

/**
 * Koraci izračunati prije `proslo` minuta, viđeni iz sada: prošli koraci otpadnu,
 * ostali se pomaknu. Ekran se crta i bez novog radara (aplikacija otvorena satima).
 */
export function odSad(koraci: Korak[], proslo: number): Korak[] {
  const korak = koraci[1] && koraci[0] ? koraci[1].min - koraci[0].min : 5;
  const pomak = Math.max(0, Math.floor(proslo / korak) * korak);
  return koraci.filter((k) => k.min >= pomak).map((k) => ({ ...k, min: k.min - pomak }));
}
