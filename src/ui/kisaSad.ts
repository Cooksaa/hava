import type { Radar } from '../api/radar';
import { KISA, kisaSad, type KisaSad } from '../logic/kisaSad';
import { odSad, type Korak } from '../logic/nowcast';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';

/*
 * Kiša u naredna 2 sata (radar), odmah ispod "Sada".
 * Pokazuje se samo kad ima kiše blizu: inače je to samo još jedan red teksta.
 */

/** Poslije ovoliko minuta bez novog radara prikaz se skloni (ništa umjesto pogrešnog). */
const NAJSTARIJE = 30;

/** Kiša za prikaz sada, ili null kad je nema smisla pokazati. */
export function kisaZaPrikaz(radar: Radar | null, sad: number): { kisa: KisaSad; koraci: Korak[] } | null {
  if (!radar) return null;
  const proslo = (sad - radar.izracunato) / 60_000;
  if (proslo > NAJSTARIJE || proslo < -1) return null;
  const koraci = odSad(radar.koraci, proslo);
  const kisa = kisaSad(koraci, sad);
  if (kisa.vrsta === 'suho' && !radar.blizu) return null;
  return { kisa, koraci };
}

/** Visina stupca po jačini: slaba, umjerena, jaka. */
const visina = (k: Korak): number => (k.mmh < 1 ? 7 : k.mmh < 4 ? 11 : 16);

function traka(koraci: Korak[]): Sirovo {
  // 2 sata u 24 stupca po 5 minuta; na kraju se lista skrati za proteklo vrijeme.
  const stupci: (Korak | null)[] = koraci.slice(0, 24);
  while (stupci.length < 24) stupci.push(null);
  return html`
    <div class="kisa-sad__traka" aria-hidden="true">
      <div class="kisa-sad__stupci">
        ${stupci.map((k) => {
          if (!k) return html`<i class="je-nepoznato"></i>`;
          // Rub kiše (moguća): tanka crtica, jasno drugačija od kiše koja će pasti.
          if (k.vjer < KISA) return html`<i class="${k.vjer >= 0.15 ? 'je-moguce' : 'je-suho'}"></i>`;
          const sigurnost = 0.75 + 0.25 * Math.min(1, (k.vjer - KISA) / 0.4);
          return html`<i
            class="${k.snijeg ? 'je-snijeg' : ''}"
            style="height:${visina(k)}px;opacity:${sigurnost.toFixed(2)}"
          ></i>`;
        })}
      </div>
      <div class="kisa-sad__oznake broj"><span>sad</span><span>30 min</span><span>1 h</span><span>1,5 h</span><span>2 h</span></div>
    </div>
  `;
}

export function prikaziKisuSad(p: { kisa: KisaSad; koraci: Korak[] }): Sirovo {
  const { kisa, koraci } = p;
  return html`
    <section class="podloga kisa-sad" data-vrsta="${kisa.vrsta}" aria-label="Kiša u naredna 2 sata">
      <p class="kisa-sad__recenica">
        <span class="kisa-sad__znak">${ikonaUi('kap')}</span>${kisa.recenica}
      </p>
      ${kisa.vrsta === 'suho' ? '' : traka(koraci)}
    </section>
  `;
}
