import { GRADOVI, type Grad } from '../config';
import { procijeniKisu } from '../logic/kisa';
import { jadranskiKraj } from '../logic/vjetar';
import type { StanjeGradova } from '../state';
import { gradDetalj, kisaKratko, kisaRecenica } from '../tekst';
import type { Prognoza } from '../tipovi';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';
import { listaSati, narednaDvadesetCetiri } from './sati';

/*
 * Putujem, faza 1: "Pada li u…?" za šest gradova, svi odjednom.
 * Odredište, ruta i radar dolaze u fazi 3.
 */

export function prikaziPutujem(g: StanjeGradova): Sirovo {
  return html`
    <section class="kartica putujem" aria-labelledby="putujem-naslov">
      <div class="kartica__vrh">
        <span class="kartica__znak">${ikonaUi('auto')}</span>
        <h2 class="kartica__naslov" id="putujem-naslov">Putujem</h2>
      </div>
      ${g.status === 'greska' && !g.prognoze.length
        ? html`
            <p class="kartica__detalj">Ne mogu provjeriti gradove bez interneta.</p>
            <button class="dugme dugme--malo" type="button" data-akcija="osvjezi-gradove">
              ${ikonaUi('osvjezi')}<span>Pokušaj ponovo</span>
            </button>
          `
        : html`
            <ul class="gradovi" aria-busy="${g.status === 'ucitava'}">
              ${GRADOVI.map((grad, i) => red(grad, g.prognoze[i], i))}
            </ul>
          `}
    </section>
  `;
}

function red(grad: Grad, p: Prognoza | undefined, i: number): Sirovo {
  if (!p) {
    return html`
      <li class="grad grad--ceka">
        <span class="grad__ime">${grad.ime}</span>
        <span class="kostur kostur--stanje"></span>
      </li>
    `;
  }
  const k = procijeniKisu(p);
  return html`
    <li>
      <button class="grad" type="button" data-akcija="grad" data-i="${i}" aria-haspopup="dialog">
        <span class="grad__ime">${grad.ime}</span>
        <span class="grad__stanje broj">${k.kod === 'suho' ? '' : ikonaUi('kap', 'kap')}${kisaKratko(k)}</span>
        ${ikonaUi('strelica', 'grad__strelica')}
      </button>
    </li>
  `;
}

export function prikaziGradDetalje(grad: Grad, p: Prognoza): Sirovo {
  return html`
    <div class="grad-detalji">
      <p class="list__glavno">${kisaRecenica(grad, procijeniKisu(p))}</p>
      <p class="list__detalj">${gradDetalj(p.sada, jadranskiKraj(grad.lat, grad.lon))}</p>
      <h3 class="list__podnaslov">Narednih 12 sati</h3>
      ${listaSati(narednaDvadesetCetiri(p).slice(0, 12), 'Narednih 12 sati')}
    </div>
  `;
}
