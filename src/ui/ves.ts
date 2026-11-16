import { satIz } from '../logic/vrijeme';
import { pregledVesa, procijeniVes, type DanPregled, type VesPresuda } from '../logic/ves';
import { danKratko, vesCinjenice, vesOcjenaKratko, vesRecenica } from '../tekst';
import type { Prognoza } from '../tipovi';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';

/* Veš: kartica na početnom ekranu i detalji u listu. */

interface OpcijeTrake {
  /** Preporučeni prozor [od, do): boji se bojom ocjene. */
  od?: number | null;
  do?: number | null;
  /** Trenutni sat, ako je traka za danas: prošli sati se gase. */
  sad?: number | null;
  /** Ispiši sate ispod trake. */
  oznake?: boolean;
}

function traka(dan: DanPregled, o: OpcijeTrake = {}): Sirovo {
  const prvi = dan.traka[0];
  const zadnji = dan.traka[dan.traka.length - 1];
  if (!prvi || !zadnji) return html``;
  const sredina = dan.traka[Math.floor(dan.traka.length / 2)];

  return html`
    <div class="traka" aria-hidden="true">
      <div class="traka__sati">
        ${dan.traka.map((s) => {
          const uProzoru = o.od != null && o.do != null && s.sat >= o.od && s.sat < o.do;
          const proslo = o.sad != null && s.sat < o.sad;
          const sad = o.sad != null && s.sat === o.sad;
          const klase = [uProzoru ? 'je-prozor' : '', proslo ? 'je-proslo' : '', sad ? 'je-sad' : ''].join(' ');
          return html`<i data-s="${s.stanje}" class="${klase}"></i>`;
        })}
      </div>
      ${o.oznake
        ? html`
            <div class="traka__oznake broj">
              <span>${prvi.sat}h</span>
              ${sredina ? html`<span>${sredina.sat}h</span>` : ''}
              <span>${zadnji.sat + 1}h</span>
            </div>
          `
        : ''}
    </div>
  `;
}

function trakaPresude(p: Prognoza, v: VesPresuda): Sirovo {
  const dan = pregledVesa(p).find((d) => d.datum === v.datum);
  if (!dan) return html``;
  return traka(dan, {
    od: v.prostriOd,
    do: v.suhoDo,
    sad: v.dan === 'danas' ? satIz(p.sada.vrijeme) : null,
    oznake: true,
  });
}

export function prikaziVes(p: Prognoza): Sirovo {
  const v = procijeniVes(p);
  const r = vesRecenica(v);
  return html`
    <section class="staklo kartica ves" data-nivo="${v.nivo}" aria-labelledby="ves-naslov">
      <div class="kartica__vrh">
        <span class="kartica__znak">${ikonaUi('majica')}</span>
        <h2 class="kartica__naslov" id="ves-naslov">Veš</h2>
        <button class="kartica__vise" type="button" data-akcija="ves" aria-label="Veš, detalji" aria-haspopup="dialog">
          ${ikonaUi('strelica')}
        </button>
      </div>
      <p class="kartica__glavno">${r.glavno}</p>
      ${trakaPresude(p, v)}
      <p class="kartica__detalj">${r.detalj}</p>
    </section>
  `;
}

export function prikaziVesDetalje(p: Prognoza): Sirovo {
  const v = procijeniVes(p);
  const r = vesRecenica(v);
  const danas = p.sada.vrijeme.slice(0, 10);
  const sad = satIz(p.sada.vrijeme);
  const dani = pregledVesa(p);

  return html`
    <div class="ves-detalji" data-nivo="${v.nivo}">
      <p class="list__glavno">${r.glavno}</p>
      <p class="list__detalj">${r.detalj}</p>

      ${trakaPresude(p, v)}
      <ul class="legenda" aria-label="Šta boje na traci znače">
        ${v.prostriOd !== null
          ? html`<li><i data-s="suho" class="je-prozor"></i>${v.kod === 'kratak-prozor' ? 'suho, ali prekratko' : 'vrijeme za veš'}</li>`
          : ''}
        <li><i data-s="suho"></i>suho</li>
        <li><i data-s="vlazno"></i>prevlažno</li>
        <li><i data-s="kisa"></i>kiša</li>
      </ul>

      <dl class="cinjenice">
        ${vesCinjenice(v).map(([sta, koliko]) => html`<div><dt>${sta}</dt><dd class="broj">${koliko}</dd></div>`)}
      </dl>

      <h3 class="list__podnaslov">Narednih dana</h3>
      <ul class="ves-dani">
        ${dani.map((d) => {
          const jeDanas = d.datum === danas;
          // Za danas vrijedi presuda (zna koliko je sati), za ostale dane ocjena cijelog dana.
          const nivo = jeDanas ? (v.dan === 'danas' ? v.nivo : null) : d.nivo;
          return html`
            <li class="ves-dan">
              <span class="ves-dan__ime">${jeDanas ? 'Danas' : danKratko(d.datum)}</span>
              ${traka(d, { sad: jeDanas ? sad : null })}
              <span class="ves-dan__ocjena" data-nivo="${nivo ?? 'kasno'}">${vesOcjenaKratko(nivo)}</span>
            </li>
          `;
        })}
      </ul>
    </div>
  `;
}
