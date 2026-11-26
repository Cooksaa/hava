import { prskanje, rostilj } from '../logic/aktivnosti';
import type { Ocjena } from '../logic/dron';
import { najbliziVrh, presudaVrha, VRHOVI, type SatVrha, type Vrh } from '../logic/planina';
import type { Mjesto, Prognoza } from '../tipovi';
import { html, type Sirovo } from './html';
import { ikonaUi, type IkonaUi } from './ikone';

/*
 * Aktivnosti ispod Putujem: dron (ui/dron.ts), prskanje, roštilj, planina.
 * Svaka: znak u boji ocjene, jedna rečenica, traka po satima, detalji u listu.
 * Koje se vide bira korisnik ("Uredi aktivnosti"), pamti se u telefonu.
 */

export type IdAktivnosti = 'dron' | 'prskanje' | 'rostilj' | 'planina';

export const AKTIVNOSTI: { id: IdAktivnosti; ime: string; opis: string }[] = [
  { id: 'dron', ime: 'Dron', opis: 'vjetar na visini leta, zone' },
  { id: 'prskanje', ime: 'Prskanje', opis: 'voćnjak i vinograd' },
  { id: 'rostilj', ime: 'Roštilj i vani', opis: 'veče napolju' },
  { id: 'planina', ime: 'Planina', opis: 'prognoza za vrh' },
];

const KLJUC = 'aktivnosti:v1';
const KLJUC_VRH = 'planina:vrh:v1';

export function izabraneAktivnosti(): IdAktivnosti[] {
  try {
    const z = JSON.parse(localStorage.getItem(KLJUC) ?? 'null') as unknown;
    if (Array.isArray(z)) return z.filter((x): x is IdAktivnosti => AKTIVNOSTI.some((a) => a.id === x));
  } catch {
    /* podrazumijevano */
  }
  return AKTIVNOSTI.map((a) => a.id);
}

export function sacuvajAktivnosti(ids: IdAktivnosti[]): void {
  try {
    localStorage.setItem(KLJUC, JSON.stringify(ids));
  } catch {
    /* samo za ovu sesiju */
  }
}

export function izabraniVrh(m: Mjesto): Vrh {
  try {
    const id = localStorage.getItem(KLJUC_VRH);
    const v = VRHOVI.find((x) => x.id === id);
    if (v) return v;
  } catch {
    /* najbliži */
  }
  return najbliziVrh(m.lat, m.lon);
}

export function izaberiVrh(id: string): void {
  try {
    localStorage.setItem(KLJUC_VRH, id);
  } catch {
    /* ništa */
  }
}

const NIVO: Record<Ocjena, string> = { zeleno: 'moze', zuto: 'pazi', crveno: 'nemoj' };
const OCJENA: Record<Ocjena, string> = { zeleno: 'može', zuto: 'pazi', crveno: 'ne' };

interface SatPrikaza {
  sat: { sat: number };
  ocjena: Ocjena;
  razlozi: string[];
}

function traka(sati: SatPrikaza[]): Sirovo {
  const prvi = sati[0];
  const zadnji = sati[sati.length - 1];
  if (!prvi || !zadnji) return html``;
  const sredina = sati[Math.floor(sati.length / 2)];
  return html`
    <div class="traka dron__traka" aria-hidden="true">
      <div class="traka__sati">${sati.map((s) => html`<i data-o="${s.ocjena}"></i>`)}</div>
      <div class="traka__oznake broj">
        <span>${prvi.sat.sat}h</span>
        ${sredina && sati.length > 2 ? html`<span>${sredina.sat.sat}h</span>` : ''}
        <span>${zadnji.sat.sat + 1}h</span>
      </div>
    </div>
  `;
}

function kartica(o: {
  id: IdAktivnosti;
  ikona: IkonaUi;
  naslov: string;
  desno?: string;
  ocjena: Ocjena | null;
  glavno: string;
  sati: SatPrikaza[];
  detalj?: string;
}): Sirovo {
  return html`
    <section class="kartica dron aktivnost" ${o.ocjena ? html`data-nivo="${NIVO[o.ocjena]}"` : ''} aria-labelledby="akt-${o.id}">
      <div class="kartica__vrh">
        <span class="kartica__znak">${ikonaUi(o.ikona)}</span>
        <h2 class="kartica__naslov" id="akt-${o.id}">${o.naslov}</h2>
        ${o.desno ? html`<span class="dron__model">${o.desno}</span>` : ''}
        <button class="kartica__vise" type="button" data-akcija="akt-${o.id}" aria-label="${o.naslov}, detalji" aria-haspopup="dialog">
          ${ikonaUi('strelica')}
        </button>
      </div>
      <p class="kartica__glavno">${o.glavno}</p>
      ${traka(o.sati)}
      ${o.detalj ? html`<p class="kartica__detalj">${o.detalj}</p>` : ''}
    </section>
  `;
}

export function prikaziAktivnosti(
  ids: IdAktivnosti[],
  p: Prognoza | null,
  m: Mjesto,
  vrh: { vrh: Vrh; sati: SatVrha[] | null },
): Sirovo {
  if (!p) return html``;
  const dijelovi: Sirovo[] = [];
  if (ids.includes('prskanje')) {
    const r = prskanje(p);
    if (r) dijelovi.push(kartica({ id: 'prskanje', ikona: 'biljka', naslov: 'Prskanje', ocjena: r.ocjena, glavno: r.glavno, sati: r.sati }));
  }
  if (ids.includes('rostilj')) {
    const r = rostilj(p);
    if (r) dijelovi.push(kartica({ id: 'rostilj', ikona: 'vatra', naslov: 'Roštilj i vani', ocjena: r.ocjena, glavno: r.glavno, sati: r.sati }));
  }
  if (ids.includes('planina')) {
    const r = vrh.sati ? presudaVrha(vrh.vrh, vrh.sati, p.sada.vrijeme) : null;
    dijelovi.push(
      kartica({
        id: 'planina',
        ikona: 'planina',
        naslov: 'Planina',
        desno: `${vrh.vrh.ime}, ${vrh.vrh.visina} m`,
        ocjena: r?.ocjena ?? null,
        glavno: r?.glavno ?? (vrh.sati ? 'Nema prognoze za vrh.' : 'Učitavam prognozu za vrh.'),
        sati: r?.sati ?? [],
      }),
    );
  }
  void m;
  return html`${dijelovi}`;
}

function listaSati(sati: SatPrikaza[], dodatno?: (i: number) => string): Sirovo {
  return html`
    <ol class="dron-sati broj">
      ${sati.map(
        (x, i) => html`
          <li data-o="${x.ocjena}">
            <span class="dron-sati__sat">${x.sat.sat}h</span>
            <span class="dron-sati__ocjena"><i aria-hidden="true"></i>${OCJENA[x.ocjena]}</span>
            <span class="dron-sati__vjetar">${dodatno ? dodatno(i) : ''}</span>
            <span class="dron-sati__zasto">${x.razlozi[0] ?? ''}</span>
          </li>
        `,
      )}
    </ol>
  `;
}

export function aktivnostDetalji(id: IdAktivnosti, p: Prognoza, m: Mjesto, vrh: { vrh: Vrh; sati: SatVrha[] | null }): Sirovo | null {
  if (id === 'prskanje') {
    const r = prskanje(p);
    if (!r) return null;
    return html`
      <div class="dron-detalji" data-nivo="${NIVO[r.ocjena]}">
        <p class="list__glavno">${r.glavno}</p>
        <h3 class="list__podnaslov">${r.dan === 'danas' ? 'Danas' : 'Sutra'}, po satima</h3>
        ${listaSati(r.sati, (i) => `${Math.round(r.sati[i]!.sat.vjetar)} km/h`)}
        <p class="list__detalj dron-napomena">
          Dobro: vjetar do 10 km/h (do 15 pazi), bez kiše 6 sati poslije, 8–25°. Uvijek se drži uputstva na
          sredstvu.
        </p>
      </div>
    `;
  }
  if (id === 'rostilj') {
    const r = rostilj(p);
    if (!r) return null;
    return html`
      <div class="dron-detalji" data-nivo="${NIVO[r.ocjena]}">
        <p class="list__glavno">${r.glavno}</p>
        <h3 class="list__podnaslov">${r.dan === 'danas' ? 'Večeras' : 'Sutra uveče'}, po satima</h3>
        ${listaSati(r.sati, (i) => `${Math.round(r.sati[i]!.sat.temp)}°`)}
      </div>
    `;
  }
  if (id === 'planina') {
    const r = vrh.sati ? presudaVrha(vrh.vrh, vrh.sati, p.sada.vrijeme) : null;
    return html`
      <div class="dron-detalji" ${r ? html`data-nivo="${NIVO[r.ocjena]}"` : ''}>
        <p class="list__glavno">${r?.glavno ?? 'Prognoza za vrh se učitava.'}</p>
        <label class="dron-model">
          <span>Vrh</span>
          <select data-vrh>
            ${VRHOVI.map(
              (v) => html`<option value="${v.id}" ${v.id === vrh.vrh.id ? 'selected' : ''}>${v.planina}: ${v.ime}, ${v.visina} m</option>`,
            )}
          </select>
        </label>
        ${r
          ? html`
              <h3 class="list__podnaslov">${r.dan === 'danas' ? 'Danas' : 'Sutra'} na vrhu, po satima</h3>
              <p class="list__detalj">Temperatura i udari vjetra na ${vrh.vrh.visina} m.</p>
              ${listaSati(r.sati, (i) => `${Math.round(r.sati[i]!.sat.temp)}° · ${Math.round(r.sati[i]!.sat.udari)}`)}
            `
          : ''}
        <p class="list__detalj dron-napomena">
          Na grebenu vjetar zna biti jači od prognoze. Ljeti krenite rano: grmljavina je najčešće popodne.
        </p>
      </div>
    `;
  }
  void m;
  return null;
}

export function urediAktivnosti(ids: IdAktivnosti[]): Sirovo {
  return html`
    <p class="list__detalj">Izaberi šta da Hava prati. Veš je uvijek tu.</p>
    <div class="aktivnosti-izbor">
      ${AKTIVNOSTI.map(
        (a) => html`
          <label class="aktivnosti-izbor__red">
            <input type="checkbox" data-aktivnost="${a.id}" ${ids.includes(a.id) ? 'checked' : ''} />
            <span><strong>${a.ime}</strong> ${a.opis}</span>
          </label>
        `,
      )}
    </div>
  `;
}
