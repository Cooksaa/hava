import { danKratko, stepeni } from '../tekst';
import type { Prognoza } from '../tipovi';
import { html, type Sirovo } from './html';
import { ikonaUi, ikonaVremena, ikonaZaKod } from './ikone';
import { PRAG_KISE } from './sati';

/* Sedam dana. Crtica pokazuje gdje je raspon tog dana u rasponu cijele sedmice. */

export function prikaziDane(p: Prognoza): Sirovo {
  const dani = p.dani.slice(0, 7);
  if (!dani.length) return html``;

  const min = Math.min(...dani.map((d) => d.tMin));
  const max = Math.max(...dani.map((d) => d.tMax));
  const raspon = Math.max(1, max - min);
  const posto = (t: number): string => `${(((t - min) / raspon) * 100).toFixed(1)}%`;

  return html`
    <section class="blok" aria-labelledby="dani-naslov">
      <h2 class="blok__naslov" id="dani-naslov">7 dana</h2>
      <ul class="dani">
        ${dani.map(
          (d, i) => html`
            <li class="dan">
              <span class="dan__ime">${i === 0 ? 'Danas' : danKratko(d.datum)}</span>
              ${ikonaVremena(ikonaZaKod(d.kod, true), 'dan__ikona')}
              <span class="dan__kisa broj">
                ${d.kisaVjerMax >= PRAG_KISE ? html`${ikonaUi('kap', 'kap')}${Math.round(d.kisaVjerMax)}%` : ''}
              </span>
              <span class="dan__min broj">${stepeni(d.tMin)}</span>
              <span class="dan__raspon" aria-hidden="true">
                <i style="--od:${posto(d.tMin)};--do:${posto(d.tMax)}"></i>
              </span>
              <span class="dan__max broj">${stepeni(d.tMax)}</span>
            </li>
          `,
        )}
      </ul>
    </section>
  `;
}
