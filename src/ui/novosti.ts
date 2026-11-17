import { staJeNovo, type Novost } from '../logic/novosti';
import { NOVOSTI } from '../novosti';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';
import type { List } from './list';

/*
 * Poslije ažuriranja, ispod imena mjesta: "Ažurirano na 0.3.1 · Šta je novo".
 * Pokaže se samo pri prvom otvaranju nove verzije. Dodir otvara list s novostima,
 * × je sklanja. Bez pop-upa, ništa ne iskače preko prognoze.
 */

const KLJUC = 'novosti:vidjeno';
/** Spremljena prognoza znači da aplikacija nije tek instalirana (api/cache.ts). */
const KLJUC_PROGNOZA = 'prognoza:v2';
/**
 * Verzije prije 0.3.1 nisu pamtile šta je viđeno. Ko ima spremljenu prognozu, a nema
 * zapisa, došao je s 0.3.0 ili starije: pokaži novosti od 0.3.0 nadalje.
 */
const PRIJE_PAMCENJA = '0.2.99';

function citaj(kljuc: string): string | null {
  try {
    return localStorage.getItem(kljuc);
  } catch {
    return null;
  }
}

function sadrzaj(novosti: Novost[]): Sirovo {
  const jedna = novosti.length === 1;
  return html`
    ${novosti.map(
      (n) => html`
        ${jedna ? '' : html`<h3 class="list__podnaslov broj">Verzija ${n.verzija}</h3>`}
        <ul class="novosti">
          ${n.stavke.map((s) => html`<li>${s}</li>`)}
        </ul>
      `,
    )}
  `;
}

export function pokaziNovosti(mjesto: HTMLElement, list: List): void {
  const vidjena = citaj(KLJUC) ?? (citaj(KLJUC_PROGNOZA) !== null ? PRIJE_PAMCENJA : null);
  const novosti = staJeNovo(NOVOSTI, __VERSIJA__, vidjena);
  try {
    localStorage.setItem(KLJUC, __VERSIJA__);
  } catch {
    // Bez pamćenja: novosti se ne pokazuju (prvo pokretanje svaki put).
  }
  if (!novosti.length) return;

  mjesto.innerHTML = html`
    <div class="novo">
      <button class="novo__otvori" type="button" aria-haspopup="dialog">
        <span>Ažurirano na <span class="broj">${__VERSIJA__}</span></span>
        <span class="novo__akcija">Šta je novo</span>
      </button>
      <button class="novo__zatvori" type="button" aria-label="Skloni">${ikonaUi('zatvori')}</button>
    </div>
  `.html;

  const skloni = (): void => {
    mjesto.innerHTML = '';
  };
  mjesto.querySelector('.novo__otvori')?.addEventListener('click', () => {
    list.otvori('Šta je novo', sadrzaj(novosti));
    skloni();
  });
  mjesto.querySelector('.novo__zatvori')?.addEventListener('click', skloni);
}
