import type { ZrakSad } from '../logic/zrak';
import { rasponRecenica, sadaRecenica, stepeni } from '../tekst';
import type { Prognoza } from '../tipovi';
import { html, type Sirovo } from './html';
import { ikonaVremena, ikonaZaKod } from './ikone';

/*
 * "Sada": temperatura i jedna rečenica, direktno na nebu.
 * Raspon za danas uključuje i temperaturu sad: kad je izmjerena na aerodromu (npr. 8°),
 * a model za dan kaže 13–17°, bez toga bi pisalo "8°" i "Danas od 13°".
 */

export function prikaziSada(p: Prognoza, jadran = false, zrak: ZrakSad | null = null): Sirovo {
  const danas = p.dani[0];
  return html`
    <section class="sada" aria-label="Trenutno vrijeme">
      <div class="sada__red">
        <p class="sada__temp broj">${stepeni(p.sada.temp)}</p>
        ${ikonaVremena(ikonaZaKod(p.sada.kod, p.sada.dan), 'sada__ikona')}
      </div>
      <p class="sada__opis">${sadaRecenica(p.sada, jadran)}</p>
      ${danas
        ? html`<p class="sada__raspon broj">
            ${rasponRecenica({
              ...danas,
              tMin: Math.min(danas.tMin, p.sada.temp),
              tMax: Math.max(danas.tMax, p.sada.temp),
            })}
          </p>`
        : ''}
      ${zrak
        ? html`<p class="sada__zrak" data-k="${zrak.kategorija}">
            <i class="sada__tacka" aria-hidden="true"></i>${zrak.recenica}${zrak.savjet ? ` ${zrak.savjet}` : ''}
          </p>`
        : ''}
      ${p.izmjereno ? html`<p class="sada__izvor broj">Izmjereno: ${p.izmjereno.gdje}, ${p.izmjereno.kad}</p>` : ''}
    </section>
  `;
}

export function prikaziSadaKostur(): Sirovo {
  return html`
    <section class="sada" aria-busy="true" aria-label="Učitavam prognozu">
      <div class="kostur kostur--temp"></div>
      <div class="kostur kostur--red"></div>
      <div class="kostur kostur--red kostur--kratak"></div>
    </section>
    <div class="kostur kostur--kartica"></div>
    <div class="kostur kostur--blok"></div>
  `;
}
