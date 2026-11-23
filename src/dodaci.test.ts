import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * android.ts provjerava da li dodatak postoji po imenu. Pogrešno ime = tiho ništa
 * (tako je 0.6.0 sakrila obavijesti), pa ime poredimo s onim pod kojim se dodatak registruje.
 */
describe('imena dodataka', () => {
  it('obavijesti: isto ime kao registerPlugin u @capacitor/background-runner', () => {
    const dodatak = readFileSync('node_modules/@capacitor/background-runner/dist/esm/index.js', 'utf8');
    const ime = /registerPlugin\('([^']+)'/.exec(dodatak)?.[1];
    const android = readFileSync('src/android.ts', 'utf8');
    expect(ime).toBeTruthy();
    expect(android).toContain(`DODATAK_OBAVIJESTI = '${ime}'`);
  });
});
