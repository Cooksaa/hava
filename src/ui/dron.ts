import {
  MODELI,
  PODRAZUMIJEVANI,
  presudaDrona,
  zlatniPlavi,
  type DronPresuda,
  type ModelDrona,
  type Ocjena,
  type Svjetlo,
  type Visina,
} from '../logic/dron';
import { NIVOI, zonaRecenica, type Zona } from '../logic/zone';
import type { Mjesto, Prognoza } from '../tipovi';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';

/* Dron: kartica u "aktivnostima" i detalji u listu. Logika je u logic/dron.ts. */

const KLJUC = 'dron:model:v1';
const NIVO: Record<Ocjena, 'moze' | 'pazi' | 'nemoj'> = { zeleno: 'moze', zuto: 'pazi', crveno: 'nemoj' };

/** Izabrani dron. "drugi:9.5" = vlastiti otpor u m/s. */
export function izabraniModel(): ModelDrona {
  try {
    const id = localStorage.getItem(KLJUC);
    if (id?.startsWith('drugi:')) {
      const ms = Number(id.slice(6));
      if (ms >= 3 && ms <= 25) return { id, ime: `Dron do ${String(ms).replace('.', ',')} m/s`, otpor: ms };
    }
    return MODELI.find((m) => m.id === id) ?? PODRAZUMIJEVANI;
  } catch {
    return PODRAZUMIJEVANI;
  }
}

export function izaberiModel(id: string): void {
  try {
    localStorage.setItem(KLJUC, id);
  } catch {
    /* ostaje do kraja sesije: ništa */
  }
}

/** Lokalno "HH:MM" za ms, po pomaku mjesta. */
const satMin = (ms: number, pomakSek: number): string => new Date(ms + pomakSek * 1000).toISOString().slice(11, 16);

/** Zlatni i plavi sat za dan presude. */
function svjetlo(p: Prognoza, m: Mjesto, datum: string): { zlatni: Svjetlo[]; plavi: Svjetlo[] } {
  const ponoc = Date.parse(`${datum}T00:00:00Z`) - p.pomakSek * 1000;
  return zlatniPlavi(ponoc, m.lat, m.lon);
}

/** Sljedeći zlatni sat od sad: "Zlatni sat 15:42–16:40" ili "sutra 6:55–7:50". */
function sljedeciZlatni(p: Prognoza, m: Mjesto): string | null {
  const sad = Date.parse(`${p.sada.vrijeme}:00Z`) - p.pomakSek * 1000;
  for (const [i, d] of p.dani.slice(0, 2).entries()) {
    const z = svjetlo(p, m, d.datum).zlatni.find((x) => x.do > sad);
    if (z) return `Zlatni sat ${i === 1 ? 'sutra ' : ''}${satMin(z.od, p.pomakSek)}–${satMin(z.do, p.pomakSek)}`;
  }
  return null;
}

export interface DronPrikaz {
  presuda: DronPresuda;
  model: ModelDrona;
}

export function dronZaPrikaz(p: Prognoza, visine: Map<string, Visina> | null): DronPrikaz | null {
  const model = izabraniModel();
  const presuda = presudaDrona(p.dani, p.sati, visine ?? new Map(), model, p.sada.vrijeme);
  return presuda ? { presuda, model } : null;
}

function traka(pr: DronPresuda): Sirovo {
  const prvi = pr.sati[0];
  const zadnji = pr.sati[pr.sati.length - 1];
  if (!prvi || !zadnji) return html``;
  const sredina = pr.sati[Math.floor(pr.sati.length / 2)];
  return html`
    <div class="traka dron__traka" aria-hidden="true">
      <div class="traka__sati">${pr.sati.map((s) => html`<i data-o="${s.ocjena}"></i>`)}</div>
      <div class="traka__oznake broj">
        <span>${prvi.sat.sat}h</span>
        ${sredina && pr.sati.length > 2 ? html`<span>${sredina.sat.sat}h</span>` : ''}
        <span>${zadnji.sat.sat + 1}h</span>
      </div>
    </div>
  `;
}

/** Najozbiljnija zona na mjestu, kao kratak red na kartici. */
function zonaRed(naMjestu: Zona[] | null): Sirovo {
  const z = naMjestu?.[0];
  if (!z) return html``;
  return html`<p class="dron__zona"><i style="background:${z.boja}" aria-hidden="true"></i>DJI zona: ${z.ime}, ${NIVOI[z.nivo]!.ime.toLowerCase()}.</p>`;
}

export function prikaziDron(
  p: Prognoza | null,
  m: Mjesto,
  visine: Map<string, Visina> | null,
  naMjestu: Zona[] | null = null,
): Sirovo {
  const d = p ? dronZaPrikaz(p, visine) : null;
  if (!p || !d) {
    return html`
      <section class="kartica dron" aria-labelledby="dron-naslov">
        <div class="kartica__vrh">
          <span class="kartica__znak">${ikonaUi('dron')}</span>
          <h2 class="kartica__naslov" id="dron-naslov">Dron</h2>
        </div>
        <p class="kartica__detalj">Ocjena po satima stiže s prognozom.</p>
      </section>
    `;
  }
  const { presuda, model } = d;
  const prvi = presuda.sati[0]!;
  const zlatni = sljedeciZlatni(p, m);
  return html`
    <section class="kartica dron" data-nivo="${NIVO[presuda.ocjena]}" aria-labelledby="dron-naslov">
      <div class="kartica__vrh">
        <span class="kartica__znak">${ikonaUi('dron')}</span>
        <h2 class="kartica__naslov" id="dron-naslov">Dron</h2>
        <span class="dron__model">${model.ime}</span>
        <button class="kartica__vise" type="button" data-akcija="dron" aria-label="Dron, detalji" aria-haspopup="dialog">
          ${ikonaUi('strelica')}
        </button>
      </div>
      <p class="kartica__glavno">${presuda.glavno}</p>
      ${traka(presuda)}
      <p class="kartica__detalj broj">
        ${presuda.dan === 'danas' ? 'Sad' : `Sutra u ${prvi.sat.sat}h`} na visini ${Math.round(prvi.visina)} km/h, udari
        ${Math.round(prvi.udari)} km/h.${zlatni ? ` ${zlatni}.` : ''}
      </p>
      ${zonaRed(naMjestu)}
    </section>
  `;
}

const OCJENA: Record<Ocjena, string> = { zeleno: 'može', zuto: 'pazi', crveno: 'ne' };

export function prikaziDronDetalje(
  p: Prognoza,
  m: Mjesto,
  visine: Map<string, Visina> | null,
  naMjestu: Zona[] | null = null,
  imaZone = false,
): Sirovo {
  const d = dronZaPrikaz(p, visine);
  if (!d) return html`<p class="list__glavno">Nema prognoze za dron.</p>`;
  const { presuda, model } = d;
  const datum = presuda.sati[0]?.sat.datum ?? p.dani[0]!.datum;
  const s = svjetlo(p, m, datum);
  const raspon = (x: Svjetlo | undefined): string =>
    x ? `${satMin(x.od, p.pomakSek)}–${satMin(x.do, p.pomakSek)}` : '—';
  const drugi = model.id.startsWith('drugi:');

  return html`
    <div class="dron-detalji" data-nivo="${NIVO[presuda.ocjena]}">
      <p class="list__glavno">${presuda.glavno}</p>

      <label class="dron-model">
        <span>Dron</span>
        <select data-dron-model>
          ${MODELI.map(
            (x) =>
              html`<option value="${x.id}" ${x.id === model.id ? 'selected' : ''}>
                ${x.ime} · ${String(x.otpor).replace('.', ',')} m/s
              </option>`,
          )}
          <option value="drugi" ${drugi ? 'selected' : ''}>Drugi, upiši otpor</option>
        </select>
      </label>
      ${drugi || model.id === 'drugi'
        ? html`<label class="dron-model">
            <span>Otpor na vjetar, m/s</span>
            <input data-dron-otpor type="text" inputmode="decimal" value="${String(model.otpor).replace('.', ',')}" />
          </label>`
        : ''}

      <h3 class="list__podnaslov">${presuda.dan === 'danas' ? 'Danas' : 'Sutra'}, po satima</h3>
      <p class="list__detalj">Vjetar na visini leta (80–120 m) i udari, km/h.</p>
      <ol class="dron-sati broj">
        ${presuda.sati.map(
          (x) => html`
            <li data-o="${x.ocjena}">
              <span class="dron-sati__sat">${x.sat.sat}h</span>
              <span class="dron-sati__ocjena"><i aria-hidden="true"></i>${OCJENA[x.ocjena]}</span>
              <span class="dron-sati__vjetar">${Math.round(x.visina)} / ${Math.round(x.udari)}</span>
              <span class="dron-sati__zasto">${x.razlozi[0] ?? ''}</span>
            </li>
          `,
        )}
      </ol>

      <h3 class="list__podnaslov">Svjetlo za snimanje</h3>
      <p class="list__detalj broj">
        Jutro: plavi sat ${raspon(s.plavi[0])}, zlatni ${raspon(s.zlatni[0])}.<br />
        Veče: zlatni sat ${raspon(s.zlatni[1])}, plavi ${raspon(s.plavi[1])}.
      </p>

      ${imaZone
        ? html`<h3 class="list__podnaslov">Zone za dron</h3>
            <p class="list__detalj">
              ${naMjestu === null ? 'Zone se učitavaju.' : (zonaRecenica(naMjestu) ?? `Na mjestu ${m.ime} nema DJI zone.`)}
            </p>
            <button class="dugme" type="button" data-zone-mapa>${ikonaUi('mapa')}<span>Zone na mapi</span></button>`
        : ''}

      <p class="list__detalj dron-napomena">
        Ovo je prognoza, ne dozvola za let. Prije leta provjeri zone i ograničenja u DJI Fly aplikaciji.
      </p>
    </div>
  `;
}
