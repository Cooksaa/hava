import { danKratko, stepeni } from '../tekst';
import { vrijediUdare } from '../logic/vjetar';
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
    vjetar: sada.vjetar,
    udari: sada.udari,
    ...(sada.smjer !== undefined ? { smjer: sada.smjer } : {}),
    kisaVjer: sada.kisaMm > 0 ? 100 : prvi.kisaVjer,
  };
  return sati;
}

/** Vjetar u satima pokazujemo tek kad se osjeti; tih sat ostaje čist. */
const PRAG_VJETRA = 20;
const vjetrovito = (s: Sat): boolean => s.vjetar >= PRAG_VJETRA || vrijediUdare(s.vjetar, s.udari);

/** Strelica pokazuje kuda vjetar nosi (suprotno od "odakle"); ikona sama gleda gore-lijevo (315°). */
function vjetarSata(s: Sat): Sirovo {
  if (!vjetrovito(s)) return html``;
  const okret = s.smjer === undefined ? null : Math.round(s.smjer + 180 - 315);
  return html`${okret === null ? '' : html`<span class="sat__smjer" style="--okret:${okret}deg">${ikonaUi('smjer')}</span>`}${Math.round(s.vjetar)}`;
}

/** Sama lista. Prvi sat je "Sad", ponoć nosi ime dana. */
export function listaSati(sati: Sat[], opis: string): Sirovo {
  const imaVjetra = sati.some(vjetrovito);
  return html`
    <ul class="sati ${imaVjetra ? 'sati--vjetar' : ''}" tabindex="0" aria-label="${opis}">
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
            ${imaVjetra ? html`<span class="sat__vjetar broj">${vjetarSata(s)}</span>` : ''}
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
