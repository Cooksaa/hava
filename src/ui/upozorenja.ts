import { kadRecenica, nivoIme, type Upozorenje } from '../logic/upozorenja';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';

/*
 * Službeno upozorenje: traka ispod imena mjesta, obojena po nivou (žuto, narandžasto,
 * crveno). Prikazuje najvažnije; dodir otvara list sa svim upozorenjima i punim tekstom.
 * Bez upozorenja nema ničega.
 */

const naslov = (u: Upozorenje): string => `${nivoIme(u.nivo)} upozorenje: ${u.vrsta}`;

/** Prvo slovo veliko: "traje do 20h" → "Traje do 20h". */
const recenica = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function prikaziUpozorenja(lista: Upozorenje[], sad: number): Sirovo {
  const prvo = lista[0];
  if (!prvo) return html``;
  // Ostale vrste (bez ponavljanja iste vrste za drugi dan).
  const jos = [...new Set(lista.slice(1).map((u) => u.vrsta))].filter((v) => v !== prvo.vrsta);
  return html`
    <button class="podloga upozorenje" type="button" data-akcija="upozorenja" data-nivo="${prvo.nivo}" aria-haspopup="dialog">
      <span class="upozorenje__znak">${ikonaUi('upozorenje')}</span>
      <span class="upozorenje__tekst">
        <span class="upozorenje__naslov">${naslov(prvo)}</span>
        <span class="upozorenje__kad">${recenica(kadRecenica(prvo, sad))}${jos.length ? html`. Još: ${jos.join(', ')}` : ''}</span>
      </span>
      ${ikonaUi('strelica', 'upozorenje__strelica')}
    </button>
  `;
}

export function upozorenjaDetalji(lista: Upozorenje[], sad: number): Sirovo {
  const izvori = [...new Set(lista.map((u) => u.izvor).filter(Boolean))];
  return html`
    ${lista.map(
      (u) => html`
        <section class="upozorenje-detalj" data-nivo="${u.nivo}">
          <h3 class="upozorenje-detalj__naslov">${naslov(u)}</h3>
          <p class="list__detalj">${recenica(kadRecenica(u, sad))}, regija ${u.regija}.</p>
          ${u.opis ? html`<p class="upozorenje-detalj__opis">${u.opis}</p>` : ''}
          ${u.uputa ? html`<p class="list__detalj">${u.uputa}</p>` : ''}
        </section>
      `,
    )}
    <p class="upozorenje-izvor">
      ${izvori.join(', ')}${izvori.length ? ', preko ' : 'Izvor: '}<a
        href="https://meteoalarm.org/"
        target="_blank"
        rel="noopener"
        >MeteoAlarm</a
      >.
    </p>
  `;
}
