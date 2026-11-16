import { describe, expect, it } from 'vitest';
import { ODSJAJ_A, PALETE, TIHI_A, kontrast, prekrij, rgb, type Rgb } from './palete';

/*
 * Kontrast teksta za svako stanje neba. Račun je običan alfa-blend, bez
 * blura i saturacije koje dodaje backdrop-filter, pa je ostavljena mala rezerva.
 */

const BIJELA: Rgb = [255, 255, 255];
const AA = 4.5;
const AA_VELIKI = 3;

describe('kontrast po stanju neba', () => {
  for (const [ime, p] of Object.entries(PALETE)) {
    const nebo = p.nebo.map(rgb) as [Rgb, Rgb, Rgb];
    // Odsjaj sunca posvjetljuje ton neba uz koji stoji: vrh, sredinu ili dno.
    const tonSjaja = p.sjajY < 33 ? 0 : p.sjajY < 77 ? 1 : 2;
    const saSjajem = (i: number): Rgb =>
      i === tonSjaja ? prekrij(nebo[i] as Rgb, rgb(p.sjaj), p.sjajA) : (nebo[i] as Rgb);

    describe(ime, () => {
      it('tekst direktno na nebu (gornji dio ekrana)', () => {
        expect(kontrast(BIJELA, nebo[0])).toBeGreaterThanOrEqual(AA);
        expect(kontrast(BIJELA, nebo[1])).toBeGreaterThanOrEqual(AA);
      });

      it('velika temperatura preko odsjaja sunca', () => {
        expect(kontrast(BIJELA, saSjajem(0))).toBeGreaterThanOrEqual(AA_VELIKI);
      });

      it('tekst na staklu, i nad najsvjetlijim dijelom neba', () => {
        for (const i of [0, 1, 2]) {
          for (const ton of [nebo[i] as Rgb, saSjajem(i)]) {
            const staklo = prekrij(ton, rgb(p.staklo), p.stakloA);
            // Naslov kartice stoji pod odsjajem na vrhu stakla.
            expect(kontrast(BIJELA, prekrij(staklo, BIJELA, ODSJAJ_A))).toBeGreaterThanOrEqual(AA);
            // Sporedni tekst je niže, gdje odsjaja nema.
            expect(kontrast(prekrij(staklo, BIJELA, TIHI_A), staklo)).toBeGreaterThanOrEqual(AA);
          }
        }
      });
    });
  }
});
