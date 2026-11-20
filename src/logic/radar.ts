/*
 * Radar: od piksela slike do kiše u mm/h.
 *
 * RainViewer daje slike (kvadrate karte) u boji "Universal Blue": svaka boja je jedna
 * vrijednost odraza (dBZ). Tabela je s rainviewer.com/files/rainviewer_api_colors_table.csv,
 * ovdje samo neprozirne boje: prozirne su sitni odrazi (rosulja, smetnje), za nas = ništa.
 * Snijeg ima svoje boje (opcija snow=1 u adresi), pa se zna i šta pada.
 */

// boja (RGB), dBZ
const KISA = [
  0x88ddee, 15, 0x6cd1eb, 16, 0x51c5e8, 17, 0x36bae5, 18, 0x1baee2, 19, 0x00a3e0, 20, 0x009ad5, 21, 0x0091ca, 22,
  0x0088bf, 23, 0x007fb4, 24, 0x0077aa, 25, 0x0070a3, 26, 0x00699c, 27, 0x006295, 28, 0x005b8e, 29, 0x005588, 30,
  0x005180, 31, 0x004e78, 32, 0x004a70, 33, 0x004768, 34, 0xffee00, 35, 0xffe000, 36, 0xffd200, 37, 0xffc500, 38,
  0xffb700, 39, 0xffaa00, 40, 0xff9f00, 41, 0xff9500, 42, 0xff8b00, 43, 0xff8100, 44, 0xff4400, 45, 0xf23600, 46,
  0xe62800, 47, 0xd91b00, 48, 0xcd0d00, 49, 0xc10000, 50, 0xa80000, 51, 0x8f0000, 52, 0x760000, 53, 0x5d0000, 54,
  0xffaaff, 55, 0xff9fff, 56, 0xff95ff, 57, 0xff8bff, 58, 0xff81ff, 59, 0xff77ff, 60, 0xff6cff, 61, 0xff62ff, 62,
  0xff58ff, 63, 0xff4eff, 64, 0xffffff, 65, 0x00ff00, 75,
];
const SNIJEG = [
  0xbfffff, 10, 0xb8f8ff, 11, 0xb2f2ff, 12, 0xabebff, 13, 0xa5e5ff, 14, 0x9fdfff, 15, 0x98d8ff, 16, 0x92d2ff, 17,
  0x8bcbff, 18, 0x85c5ff, 19, 0x7fbfff, 20, 0x78b8ff, 21, 0x72b2ff, 22, 0x6babff, 23, 0x65a5ff, 24, 0x5f9fff, 25,
  0x5b9bff, 26, 0x5898ff, 27, 0x5595ff, 28, 0x5292ff, 29, 0x4f8fff, 30, 0x4b8bff, 31, 0x4888ff, 32, 0x4585ff, 33,
  0x4282ff, 34, 0x3f7fff, 35, 0x3b7bff, 36, 0x3878ff, 37, 0x3575ff, 38, 0x3272ff, 39, 0x2f6fff, 40, 0x2b6bff, 41,
  0x2868ff, 42, 0x2565ff, 43, 0x2262ff, 44, 0x1f5fff, 45, 0x1b5bff, 46, 0x1858ff, 47, 0x1555ff, 48, 0x1252ff, 49,
  0x0f4fff, 50, 0x0c4bff, 51, 0x0948ff, 52, 0x0645ff, 53, 0x0242ff, 54, 0x003fff, 55, 0x003bff, 56, 0x0038ff, 57,
  0x0035ff, 58, 0x0032ff, 59, 0x002fff, 60, 0x002bff, 61, 0x0028ff, 62, 0x0025ff, 63, 0x0022ff, 64, 0x001fff, 65,
  0x001bff, 66, 0x0018ff, 67, 0x0015ff, 68, 0x0012ff, 69, 0x000fff, 70, 0x000cff, 71, 0x0009ff, 72, 0x0006ff, 73,
  0x0002ff, 74, 0x0000ff, 75,
];

/** Marshall–Palmer (Z = 200·R^1.6): dBZ → mm/h. 20 dBZ ≈ 0,6 mm/h, 35 ≈ 5,6, 45 ≈ 24. */
export const mmh = (dbz: number): number => (10 ** (dbz / 10) / 200) ** (1 / 1.6);

/** RGB → mm/h; negativno = snijeg (−mm/h vode). */
const BOJE = new Map<number, number>();
for (let i = 0; i < KISA.length; i += 2) BOJE.set(KISA[i]!, mmh(KISA[i + 1]!));
for (let i = 0; i < SNIJEG.length; i += 2) BOJE.set(SNIJEG[i]!, -mmh(SNIJEG[i + 1]!));

/** Polje kiše na pravougaoniku karte (pikseli Web Mercator, zoom iz api/radar.ts). */
export interface Polje {
  sirina: number;
  visina: number;
  /** mm/h po pikselu, red po red. 0 = suho. */
  kisa: Float32Array;
  /** 1 gdje je snijeg. */
  snijeg: Uint8Array;
}

export function prazno(sirina: number, visina: number): Polje {
  return { sirina, visina, kisa: new Float32Array(sirina * visina), snijeg: new Uint8Array(sirina * visina) };
}

/**
 * Upiše RGBA piksele jedne slike u polje, počevši od (x0, y0) u polju.
 * Dijelovi slike van polja se preskoče.
 */
export function upisi(polje: Polje, rgba: Uint8ClampedArray | Uint8Array, sirinaSlike: number, x0: number, y0: number): void {
  const visinaSlike = rgba.length / 4 / sirinaSlike;
  for (let y = 0; y < visinaSlike; y++) {
    const py = y0 + y;
    if (py < 0 || py >= polje.visina) continue;
    for (let x = 0; x < sirinaSlike; x++) {
      const px = x0 + x;
      if (px < 0 || px >= polje.sirina) continue;
      const i = (y * sirinaSlike + x) * 4;
      if (rgba[i + 3]! < 250) continue;
      const v = BOJE.get((rgba[i]! << 16) | (rgba[i + 1]! << 8) | rgba[i + 2]!);
      if (v === undefined) continue;
      const j = py * polje.sirina + px;
      polje.kisa[j] = Math.abs(v);
      polje.snijeg[j] = v < 0 ? 1 : 0;
    }
  }
}
