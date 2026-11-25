import type { Ruta } from '../api/put';
import { opisUslova, putRecenica, type Polazak, type TackaPuta } from '../logic/put';
import { lokalno } from '../logic/sarajevo';
import { nivoIme, type Upozorenje } from '../logic/upozorenja';
import { MJESTA } from '../mjesta';
import type { Mjesto } from '../tipovi';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';

/* Putujem: odredište, polazak i vrijeme duž puta (u kartici Putujem i u listu). */

export interface StanjePuta {
  odrediste: Mjesto;
  polazak: Polazak;
  status: 'ucitava' | 'spremno' | 'greska';
  ruta?: Ruta;
  tacke?: TackaPuta[];
  /** Službena upozorenja za regije na putu (Android). */
  upozorenja?: Upozorenje[];
}

const POLASCI: [Polazak, string][] = [
  ['sad', 'Sad'],
  ['za-sat', 'Za sat'],
  ['sutra', 'Sutra 7h'],
];

const genitiv = (ime: string): string | null => MJESTA.find((m) => m.ime === ime)?.genitiv ?? null;

const sat = (ms: number): string => {
  const l = lokalno(ms);
  return `${l.sat}:${String(l.minut).padStart(2, '0')}`;
};

function trajanje(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round((min % 60) / 5) * 5;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

export function recenicaPuta(p: StanjePuta): string {
  return putRecenica(p.tacke ?? [], { ime: p.odrediste.ime, genitiv: genitiv(p.odrediste.ime) });
}

function traka(tacke: TackaPuta[], od: string, do_: string): Sirovo {
  return html`
    <div class="traka put__traka" aria-hidden="true">
      <div class="traka__sati">${tacke.map((t) => html`<i data-u="${t.uslov}"></i>`)}</div>
      <div class="traka__oznake"><span>${od}</span><span>${do_}</span></div>
    </div>
  `;
}

/** Dio kartice Putujem iznad liste gradova. */
export function prikaziPut(p: StanjePuta | null, od: Mjesto): Sirovo {
  if (!p) {
    return html`
      <button class="put-polje" type="button" data-akcija="put-odrediste">
        ${ikonaUi('lupa')}<span>Kuda putuješ?</span>
      </button>
    `;
  }
  const izbor = html`
    <div class="put__polazak" role="group" aria-label="Polazak">
      ${POLASCI.map(
        ([v, t]) => html`<button type="button" data-polazak="${v}" aria-pressed="${p.polazak === v}">${t}</button>`
      )}
    </div>
  `;
  return html`
    <div class="put">
      <div class="put__vrh">
        <button class="put__kuda" type="button" data-akcija="put-odrediste">
          <span class="put__od">${od.ime} →</span> <strong>${p.odrediste.ime}</strong>
        </button>
        <button class="put__ukloni" type="button" data-akcija="put-ukloni" aria-label="Ukloni odredište">
          ${ikonaUi('zatvori')}
        </button>
      </div>
      ${izbor}
      ${p.status === 'ucitava'
        ? html`<div class="kostur kostur--red put__kostur"></div>`
        : p.status === 'greska' || !p.tacke || !p.ruta
        ? html`<p class="kartica__detalj">Ne mogu naći put. Provjeri internet ili probaj drugo mjesto.</p>`
        : html`
            <button class="put__rezultat" type="button" data-akcija="put" aria-haspopup="dialog">
              <span class="put__glavno">${recenicaPuta(p)}</span>
              ${traka(p.tacke, od.ime, p.odrediste.ime)}
              <span class="put__detalj broj">
                ${Math.round(p.ruta.km)} km, oko
                ${trajanje(p.ruta.min)}${p.upozorenja?.length
                  ? html` · <span class="put__upozorenje">${nivoIme(p.upozorenja[0]!.nivo)} upozorenje na putu</span>`
                  : ''}
              </span>
            </button>
          `}
    </div>
  `;
}

/** Ime u listi: isto mjesto kao prethodna tačka postaje "iza Konjica", bez imena "75. km". */
function imeTacke(t: TackaPuta, prije: TackaPuta | undefined): string {
  if (!t.ime) return `${Math.round(t.km)}. km`;
  if (prije?.ime === t.ime && t.genitiv) return `iza ${t.genitiv}`;
  return t.ime;
}

export function prikaziPutDetalje(p: StanjePuta, od: Mjesto, imaMapu: boolean): Sirovo {
  const tacke = p.tacke ?? [];
  return html`
    <div class="put-detalji">
      <p class="list__glavno">${recenicaPuta(p)}</p>
      ${p.ruta
        ? html`<p class="list__detalj broj">
            ${od.ime} → ${p.odrediste.ime}: ${Math.round(p.ruta.km)} km, oko ${trajanje(p.ruta.min)} vožnje.
          </p>`
        : ''}
      ${p.upozorenja?.length
        ? html`
            <h3 class="list__podnaslov">Službena upozorenja na putu</h3>
            ${p.upozorenja.map(
              (u) =>
                html`<p class="list__detalj put__u" data-nivo="${u.nivo}">
                  <i aria-hidden="true"></i>${nivoIme(u.nivo)}: ${u.vrsta}, ${u.regija}
                </p>`
            )}
          `
        : ''}
      <h3 class="list__podnaslov">Usput</h3>
      <ol class="put-tacke broj">
        ${tacke.map(
          (t, i) => html`
            <li data-u="${t.uslov}">
              <span class="put-tacke__sat">${sat(t.kad)}</span>
              <span class="put-tacke__gdje">
                ${i === 0 ? od.ime : i === tacke.length - 1 ? p.odrediste.ime : imeTacke(t, tacke[i - 1])}
              </span>
              <span class="put-tacke__uslov"><i aria-hidden="true"></i>${opisUslova(t.uslov)}</span>
              <span class="put-tacke__temp">${Math.round(t.v.temp)}°</span>
            </li>
          `
        )}
      </ol>
      ${imaMapu
        ? html`<button class="dugme" type="button" data-put-mapa>
            ${ikonaUi('mapa')}<span>Put na mapi s radarom</span>
          </button>`
        : ''}
      <p class="list__detalj put-napomena">
        Vrijeme je za čas kad si tu, po prosječnoj brzini. Ruta: OpenStreetMap (OSRM).
      </p>
    </div>
  `;
}
