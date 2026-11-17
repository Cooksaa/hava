import { danKratko, stepeni } from '../tekst';
import type { Prognoza, Sat } from '../tipovi';
import { html, type Sirovo } from './html';
import { ikonaUi, ikonaVremena, ikonaZaKod } from './ikone';

/* Sati: lista koja se vuče u stranu. Koristi je početni ekran i detalji grada. */

/** Ispod ove vjerovatnoće (%) kišu ne pominjemo: samo bi pravila šum. */
export const PRAG_KISE = 20;

export function narednaDvadesetCetiri(p: Prognoza): Sat[] {
  const kljuc = p.sada.vrijeme.slice(0, 13);
  const od = Math.max(
    0,
    p.sati.findIndex((s) => s.vrijeme.slice(0, 13) === kljuc),
  );
  const sati = p.sati.slice(od, od + 24);
  const prvi = sati[0];
  if (!prvi) return sati;
  // "Sad" mora reći isto što i veliki broj gore: trenutno mjerenje, ne prognozu za taj sat.
  // Ako baš sad pada, vjerovatnoća za ovaj sat nema smisla, pada.
  const { sada } = p;
  sati[0] = {
    ...prvi,
    temp: sada.temp,
    kod: sada.kod,
    dan: sada.dan,
    kisaVjer: sada.kisaMm > 0 ? 100 : prvi.kisaVjer,
  };
  return sati;
}

/** Sama lista. Prvi sat je "Sad", ponoć nosi ime dana. */
export function listaSati(sati: Sat[], opis: string): Sirovo {
  return html`
    <ul class="sati" tabindex="0" aria-label="${opis}">
      ${sati.map((s, i) => {
        const kad = i === 0 ? 'Sad' : s.sat === 0 ? danKratko(s.datum) : `${s.sat}h`;
        const istaknuto = i === 0 || s.sat === 0;
        return html`
          <li class="sat">
            <span class="sat__kad ${istaknuto ? 'sat__kad--jako' : ''} broj">${kad}</span>
            ${ikonaVremena(ikonaZaKod(s.kod, s.dan), 'sat__ikona')}
            <span class="sat__temp broj">${stepeni(s.temp)}</span>
            <span class="sat__kisa broj">
              ${s.kisaVjer >= PRAG_KISE ? html`${ikonaUi('kap', 'kap')}${Math.round(s.kisaVjer)}%` : ''}
            </span>
          </li>
        `;
      })}
    </ul>
  `;
}

export function prikaziSate(p: Prognoza): Sirovo {
  const sati = narednaDvadesetCetiri(p);
  if (!sati.length) return html``;
  return html`
    <section class="blok" aria-labelledby="sati-naslov">
      <h2 class="blok__naslov" id="sati-naslov">Narednih 24 sata</h2>
      ${listaSati(sati, 'Narednih 24 sata')}
    </section>
  `;
}
