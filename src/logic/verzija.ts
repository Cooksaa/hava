/* Poređenje verzija oblika "0.2.1" ili "v0.2.1". */

function dijelovi(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Je li `nova` novija od `trenutna`. Nepoznat oblik nikad nije noviji. */
export function jeNovija(nova: string, trenutna: string): boolean {
  const a = dijelovi(nova);
  const b = dijelovi(trenutna);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!;
  }
  return false;
}

/**
 * Android versionCode iz verzije: mora rasti sa svakom verzijom.
 * 1.2.3 → 10203. Dovoljno za 99 manjih i 99 zakrpa po verziji.
 */
export function versionCode(v: string): number | null {
  const d = dijelovi(v);
  if (!d || d[1] > 99 || d[2] > 99) return null;
  return d[0] * 10000 + d[1] * 100 + d[2];
}
