import { GRADOVI } from '../config';
import { stanjeNeba } from '../logic/nebo';
import { uskladiSaSatom } from '../logic/svjeze';
import type { Skladiste, Stanje } from '../state';
import { greskaRecenica, osvjezenoRecenica } from '../tekst';
import type { Prognoza } from '../tipovi';
import { prikaziDane } from './dani';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';
import { stvoriList } from './list';
import { postaviNebo } from './pozadina';
import { stvoriPretragu } from './pretraga';
import { prikaziDron, prikaziGradDetalje, prikaziPutujem } from './putujem';
import { prikaziSada, prikaziSadaKostur } from './sada';
import { prikaziSate } from './sati';
import { prikaziVes, prikaziVesDetalje } from './ves';

/* Sastavlja ekran i ponovo iscrta samo dio čije se stanje promijenilo. */

/**
 * Samo u razvoju: ?kod=63&vrijeme=19:40 glumi drugo vrijeme i doba dana,
 * da se sva stanja neba mogu pogledati bez čekanja na kišu.
 */
function zaRazvoj(p: Prognoza): Prognoza {
  if (!import.meta.env.DEV) return p;
  const q = new URLSearchParams(location.search);
  const kod = q.get('kod');
  const vrijeme = q.get('vrijeme');
  if (kod === null && vrijeme === null) return p;

  const novoVrijeme = vrijeme ? `${p.sada.vrijeme.slice(0, 10)}T${vrijeme}` : p.sada.vrijeme;
  const danas = p.dani[0];
  const dan = danas ? novoVrijeme >= danas.izlazak && novoVrijeme < danas.zalazak : p.sada.dan;
  return {
    ...p,
    sada: { ...p.sada, kod: kod !== null ? Number(kod) : p.sada.kod, vrijeme: novoVrijeme, dan },
  };
}

/** Prognoza kakvu treba prikazati sad: usklađena s tekućim satom, ili null ako je nema. */
function zaPrikaz(s: Stanje): Prognoza | null {
  if (!s.prognoza) return null;
  const p = uskladiSaSatom(s.prognoza, s.spremljeno ?? Date.now(), Date.now());
  return p ? zaRazvoj(p) : null;
}

function prognoza(s: Stanje): Sirovo {
  const p = zaPrikaz(s);
  if (s.status === 'greska' || !p) {
    if (s.status === 'ucitava') return prikaziSadaKostur();
    // Ima prognozu, ali toliko staru da više ne pokriva sadašnji sat.
    const prestara = s.prognoza !== null && !p;
    return html`
      <section class="poruka" role="alert">
        <p class="poruka__tekst">${greskaRecenica(s.greska, prestara)}</p>
        <button class="dugme" type="button" data-akcija="osvjezi">
          ${ikonaUi('osvjezi')}<span>Pokušaj ponovo</span>
        </button>
      </section>
    `;
  }

  return html`
    ${s.zastarjelo && s.spremljeno
      ? html`<p class="napomena" role="status">${osvjezenoRecenica(s.spremljeno)}</p>`
      : ''}
    ${prikaziSada(p)} ${prikaziVes(p)}
    <div class="podloga prognoza">${prikaziSate(p)} ${prikaziDane(p)}</div>
  `;
}

/** Pokrenuto kao Android aplikacija (build s "--mode android"), ne kao web stranica. */
const APLIKACIJA = import.meta.env.MODE === 'android';

export interface Aplikacija {
  osvjeziPrikaz(): void;
  pokaziNovuVerziju(verzija: string, link: string): void;
}

export function pokreniApp(korijen: HTMLElement, skladiste: Skladiste): Aplikacija {
  korijen.innerHTML = html`
    <div class="nebo" aria-hidden="true"></div>
    <div class="ekran">
      <header class="vrh">
        <h1 class="mjesto" data-dio="mjesto"></h1>
        <button
          class="okruglo"
          type="button"
          data-akcija="pretraga"
          aria-label="Promijeni mjesto"
          aria-haspopup="dialog"
        >
          ${ikonaUi('lupa')}
        </button>
      </header>
      <main>
        <div data-dio="prognoza"></div>
        <div class="podloga aktivnosti">
          <div data-dio="putujem"></div>
          ${prikaziDron()}
        </div>
      </main>
      <div data-dio="azuriranje"></div>
      <footer class="izvor">
        ${APLIKACIJA ? html`<span class="izvor__verzija">Hava ${__VERSIJA__}</span>` : ''}
        <span>
          Podaci:
          <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>
        </span>
      </footer>
    </div>
  `.html;

  const dio = (ime: string): HTMLElement => {
    const el = korijen.querySelector<HTMLElement>(`[data-dio="${ime}"]`);
    if (!el) throw new Error(`Nema dijela "${ime}".`);
    return el;
  };
  const mjestoEl = dio('mjesto');
  const prognozaEl = dio('prognoza');
  const putujemEl = dio('putujem');

  const list = stvoriList();
  const pretraga = stvoriPretragu((m) => {
    window.scrollTo({ top: 0 });
    void skladiste.ucitaj(m);
  });

  let prije: Stanje | null = null;

  const iscrtaj = (s: Stanje): void => {
    mjestoEl.textContent = s.mjesto.ime;

    // Gradovi stižu poslije prognoze: bez ovoga bi lista sati skočila na početak.
    const promijenjenaPrognoza =
      !prije ||
      prije.prognoza !== s.prognoza ||
      prije.status !== s.status ||
      prije.zastarjelo !== s.zastarjelo;
    if (promijenjenaPrognoza) {
      prognozaEl.innerHTML = prognoza(s).html;
      const p = zaPrikaz(s);
      const danas = p?.dani[0];
      if (p && danas) {
        postaviNebo(
          stanjeNeba({
            kod: p.sada.kod,
            vrijeme: p.sada.vrijeme,
            izlazak: danas.izlazak,
            zalazak: danas.zalazak,
          }),
        );
      }
    }

    if (!prije || prije.gradovi !== s.gradovi) {
      putujemEl.innerHTML = prikaziPutujem(s.gradovi).html;
    }

    prije = s;
  };

  korijen.addEventListener('click', (e) => {
    const cilj = (e.target as Element).closest<HTMLElement>('[data-akcija]');
    if (!cilj) return;
    const s = skladiste.daj();

    switch (cilj.dataset.akcija) {
      case 'osvjezi':
        void skladiste.osvjezi();
        break;
      case 'osvjezi-gradove':
        void skladiste.ucitajGradove();
        break;
      case 'pretraga':
        pretraga.otvori();
        break;
      case 'ves': {
        const p = zaPrikaz(s);
        if (p) list.otvori(`Veš, ${s.mjesto.ime}`, prikaziVesDetalje(p));
        break;
      }
      case 'grad': {
        const i = Number(cilj.dataset.i);
        const grad = GRADOVI[i];
        const p = s.gradovi.prognoze[i];
        if (grad && p) list.otvori(grad.ime, prikaziGradDetalje(grad, p));
        break;
      }
    }
  });

  skladiste.prati(iscrtaj);
  iscrtaj(skladiste.daj());

  return {
    // Bez promjene stanja: samo ponovo izračunaj "sad" (app otvoren, a nema mreže).
    osvjeziPrikaz() {
      prije = null;
      iscrtaj(skladiste.daj());
    },
    // Android, kad treba novi APK: tiha linija na dnu. Bez pop-upa.
    pokaziNovuVerziju(verzija: string, link: string) {
      dio('azuriranje').innerHTML = html`
        <a class="podloga azuriranje" href="${link}">
          <span>Nova verzija ${verzija}</span>
          <span class="azuriranje__akcija">Preuzmi</span>
        </a>
      `.html;
    },
  };
}
