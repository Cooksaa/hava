/*
 * DJI zone za dron (GEO zones). DJI nema javni API; koristimo isti nedokumentovani
 * kao njihova mapa (www-api.dji.com/api/geo/areas), preko Androidovog HTTP-a.
 * Može prestati raditi bez najave, pa: keš, i uvijek "provjeri u DJI Fly".
 *
 * Nivoi (DJI):
 *   0 upozorenje          smiješ letjeti, DJI Fly samo upozori
 *   3 pojačano upozorenje  DJI Fly traži da potvrdiš (samootključavanje)
 *   1 odobrenje            treba otključavanje s DJI računom
 *   2 zabranjeno           ne može se poletjeti
 *   4 regulatorna zabrana  ne može se poletjeti
 *   6 visinsko ograničenje do `visina` m
 *   7 preporučeno          (zelena) dozvoljeno, preporučeno mjesto
 */

export interface DjiPodzona {
  color?: string;
  height?: number;
  level?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  polygon_points?: number[][][] | null;
}

export interface DjiZona {
  area_id?: number;
  name?: string;
  level?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  height?: number;
  color?: string;
  begin_at?: number;
  end_at?: number;
  polygon_points?: number[][][] | null;
  sub_areas?: DjiPodzona[] | null;
}

export interface Zona {
  id: string;
  ime: string;
  nivo: number;
  boja: string;
  /** Najveća dozvoljena visina (m) kod visinskih zona; 0 = nema. */
  visina: number;
  /** Prsten [lon, lat]: krugovi su pretvoreni u mnogougao. */
  prsten: [number, number][];
}

/** Bosanska imena i šta znače za pilota. Redoslijed = koliko je ozbiljno (prvo najgore). */
export const NIVOI: Record<number, { ime: string; znaci: string; red: number }> = {
  2: { ime: 'Zabranjeno', znaci: 'ne može se poletjeti', red: 0 },
  4: { ime: 'Zabranjeno propisom', znaci: 'ne može se poletjeti', red: 1 },
  1: { ime: 'Treba odobrenje', znaci: 'treba otključavanje s DJI računom', red: 2 },
  3: { ime: 'Pojačano upozorenje', znaci: 'DJI Fly traži da potvrdiš let', red: 3 },
  6: { ime: 'Ograničena visina', znaci: 'leti se do ograničene visine', red: 4 },
  0: { ime: 'Upozorenje', znaci: 'smiješ letjeti, DJI Fly samo upozori', red: 5 },
  7: { ime: 'Preporučeno', znaci: 'dozvoljeno', red: 6 },
};

const BOJE: Record<number, string> = {
  0: '#FFCC00',
  1: '#1088F2',
  2: '#DE4329',
  3: '#EE8815',
  4: '#37C4DB',
  6: '#979797',
  7: '#00BE00',
};

/** Krug (centar, poluprečnik u m) kao mnogougao od 48 tačaka. */
export function krug(lat: number, lon: number, m: number, tacaka = 48): [number, number][] {
  const dLat = m / 111_320;
  const dLon = m / (111_320 * Math.cos((lat * Math.PI) / 180));
  const p: [number, number][] = [];
  for (let i = 0; i <= tacaka; i++) {
    const a = (i / tacaka) * 2 * Math.PI;
    p.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return p;
}

/** DJI odgovor → ravna lista zona (svaka podzona posebno), bez nepoznatih nivoa i isteklih. */
export function procitajZone(odgovor: unknown, sad = Date.now()): Zona[] {
  const areas = (odgovor as { areas?: DjiZona[] } | null)?.areas;
  if (!Array.isArray(areas)) return [];
  const out: Zona[] = [];
  for (const a of areas) {
    // Privremene zone (događaji): begin_at/end_at u sekundama; 0 = stalna.
    if (a.end_at && a.end_at * 1000 < sad) continue;
    const dijelovi: DjiPodzona[] = a.sub_areas?.length ? a.sub_areas : [a];
    dijelovi.forEach((d, i) => {
      const nivo = d.level ?? a.level;
      if (nivo === undefined || !(nivo in NIVOI)) return;
      let prsten: [number, number][] | null = null;
      const p = d.polygon_points?.[0];
      if (p && p.length >= 3) prsten = p.map((t) => [t[0]!, t[1]!] as [number, number]);
      else if (d.lat !== undefined && d.lng !== undefined && d.radius) prsten = krug(d.lat, d.lng, d.radius);
      if (!prsten) return;
      out.push({
        id: `${a.area_id ?? a.name}-${i}`,
        ime: a.name?.trim() || 'Zona',
        nivo,
        boja: d.color ?? a.color ?? BOJE[nivo] ?? '#FFCC00',
        visina: d.height ?? a.height ?? 0,
        prsten,
      });
    });
  }
  return out;
}

/** Je li tačka u mnogouglu (ray casting). */
function unutra(lon: number, lat: number, p: [number, number][]): boolean {
  let u = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]!;
    const [xj, yj] = p[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) u = !u;
  }
  return u;
}

/** Zone u kojima je tačka, najozbiljnija prva, jedna po imenu i nivou. */
export function zoneNaTacki(zone: Zona[], lat: number, lon: number): Zona[] {
  const vidjeno = new Set<string>();
  return zone
    .filter((z) => unutra(lon, lat, z.prsten))
    .sort((a, b) => (NIVOI[a.nivo]?.red ?? 9) - (NIVOI[b.nivo]?.red ?? 9))
    .filter((z) => {
      const k = `${z.ime}|${z.nivo}`;
      if (vidjeno.has(k)) return false;
      vidjeno.add(k);
      return true;
    });
}

/** "Ovdje je zona Mostar International Airport: pojačano upozorenje, DJI Fly traži da potvrdiš let." */
export function zonaRecenica(naTacki: Zona[]): string | null {
  const z = naTacki[0];
  if (!z) return null;
  const n = NIVOI[z.nivo]!;
  const visina = z.nivo === 6 && z.visina ? ` (do ${z.visina} m)` : '';
  return `Ovdje je zona ${z.ime}: ${n.ime.toLowerCase()}${visina}, ${n.znaci}.`;
}
