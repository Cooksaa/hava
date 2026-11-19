import { GRADOVI } from '../config';
import { primijeniMjerenje, type Mjerenje } from '../logic/mjerenje';
import { stanjeNeba } from '../logic/nebo';
import { opisAzuriranja, type StanjeAzuriranja } from '../logic/stanjeAzuriranja';
import { uskladiSaSatom } from '../logic/svjeze';
import { regijaZa, upozorenjaZa, type MaZapis, type Upozorenje } from '../logic/upozorenja';
import { jadranskiKraj } from '../logic/vjetar';
import { zrakSad } from '../logic/zrak';
import type { Skladiste, Stanje, StanjeGradova } from '../state';
import { greskaRecenica, osvjezenoRecenica, stepeni } from '../tekst';
import type { Prognoza } from '../tipovi';
import { stvoriAtmosferu } from './atmosfera';
import { prikaziDane } from './dani';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';
import { stvoriList } from './list';
import { pokaziNovosti } from './novosti';
import { postaviNebo } from './pozadina';
import { povuciZaOsvjezi } from './povuci';
import { stvoriPretragu } from './pretraga';
import { prikaziDron, prikaziGradDetalje, prikaziPutujem } from './putujem';
import { prikaziSada, prikaziSadaKostur } from './sada';
import { prikaziSate } from './sati';
import { prikaziUpozorenja, upozorenjaDetalji } from './upozorenja';
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

/** Zadnja mjerenja sa stanica (samo Android aplikacija ih dohvata, vidi android.ts). */
let mjerenja: Mjerenje[] = [];

/*
 * Službena upozorenja (MeteoAlarm), sirovi zapisi za cijelu BiH. Dohvata ih samo Android
 * aplikacija (android.ts); pamte se, da se upozorenje vidi i odmah pri otvaranju, bez mreže.
 */
const KLJUC_UPOZORENJA = 'upozorenja:v1';
let upozorenjaZapisi: MaZapis[] = (() => {
  try {
    const z: unknown = JSON.parse(localStorage.getItem(KLJUC_UPOZORENJA) ?? '[]');
    return Array.isArray(z) ? (z as MaZapis[]) : [];
  } catch {
    return [];
  }
})();

function upozorenjaZaMjesto(m: Stanje['mjesto'], sad: number): Upozorenje[] {
  if (m.bih === false) return [];
  const regija = regijaZa(m.lat, m.lon);
  return regija ? upozorenjaZa(upozorenjaZapisi, regija, sad) : [];
}

/** Prognoza kakvu treba prikazati sad: usklađena s tekućim satom i mjerenjem, ili null ako je nema. */
function zaPrikaz(s: Stanje): Prognoza | null {
  if (!s.prognoza) return null;
  const sad = Date.now();
  const p = uskladiSaSatom(s.prognoza, s.spremljeno ?? sad, sad);
  return p ? zaRazvoj(primijeniMjerenje(p, s.mjesto, mjerenja, sad)) : null;
}

function gradoviZaPrikaz(g: StanjeGradova): StanjeGradova {
  if (!mjerenja.length) return g;
  const sad = Date.now();
  return {
    ...g,
    prognoze: g.prognoze.map((p, i) => {
      const grad = GRADOVI[i];
      return grad ? primijeniMjerenje(p, grad, mjerenja, sad) : p;
    }),
  };
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
    ${prikaziSada(p, jadranskiKraj(s.mjesto.lat, s.mjesto.lon), s.zrak ? zrakSad(s.zrak, p.sada.vrijeme) : null)}
    ${prikaziVes(p)}
    <div class="podloga prognoza">${prikaziSate(p)} ${prikaziDane(p)}</div>
  `;
}

/** Broj temperature pređe sa starog na novi (300 ms), umjesto da samo skoči. */
function prevrni(el: Element | null, od: number, do_: number): void {
  if (!el) return;
  const pocetak = performance.now();
  const trajanje = 300;
  const korak = (t: number): void => {
    const x = Math.min(1, (t - pocetak) / trajanje);
    const blago = 1 - (1 - x) ** 3;
    el.textContent = stepeni(Math.round(od + (do_ - od) * blago));
    if (x < 1 && el.isConnected) requestAnimationFrame(korak);
  };
  requestAnimationFrame(korak);
}

/** Pokrenuto kao Android aplikacija (build s "--mode android"), ne kao web stranica. */
const APLIKACIJA = import.meta.env.MODE === 'android';

export interface Aplikacija {
  osvjeziPrikaz(): void;
  pokaziNovuVerziju(verzija: string, link: string): void;
  postaviMjerenja(m: Mjerenje[]): void;
  postaviUpozorenja(z: MaZapis[]): void;
  postaviAzuriranje(a: Azuriranje): void;
}

/** Android: stanje ažuriranja i ručna provjera (android.ts). */
export interface Azuriranje {
  stanje(): StanjeAzuriranja;
  provjeri(): Promise<void>;
}

/** Krug na dugmetu se vrti bar ovoliko, i kad GitHub odgovori odmah. */
const NAJMANJE_PROVJERAVA_MS = 700;

function azuriranjeDetalji(a: Azuriranje): Sirovo {
  const { glavno, detalji } = opisAzuriranja(a.stanje(), __VERSIJA__, Date.now());
  return html`
    <p class="list__glavno">${glavno}</p>
    ${detalji.map((d) => html`<p class="list__detalj">${d}</p>`)}
    <button class="dugme" type="button" data-provjeri>${ikonaUi('osvjezi')}<span>Provjeri sad</span></button>
  `;
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
      <div data-dio="upozorenja"></div>
      <div data-dio="novo"></div>
      <main>
        <div data-dio="prognoza"></div>
        <div class="podloga aktivnosti">
          <div data-dio="putujem"></div>
          ${prikaziDron()}
        </div>
      </main>
      <div data-dio="azuriranje"></div>
      <footer class="izvor">
        ${APLIKACIJA
          ? html`<button class="izvor__verzija" type="button" data-akcija="verzija" aria-haspopup="dialog">
              Hava ${__VERSIJA__}
            </button>`
          : ''}
        <span>
          Podaci:
          <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>,
          ICON-2I, CAMS${APLIKACIJA
            ? html`, <a href="https://meteoalarm.org/" target="_blank" rel="noopener">MeteoAlarm</a>`
            : ''}
        </span>
      </footer>
    </div>
  `.html;

  const dio = (ime: string): HTMLElement => {
    const el = korijen.querySelector<HTMLElement>(`[data-dio="${ime}"]`);
    if (!el) throw new Error(`Nema dijela "${ime}".`);
    return el;
  };
  const atmosfera = stvoriAtmosferu(korijen.querySelector('.nebo') as HTMLElement);
  const mjestoEl = dio('mjesto');
  const prognozaEl = dio('prognoza');
  const putujemEl = dio('putujem');
  const upozorenjaEl = dio('upozorenja');
  /** Šta je zadnje iscrtano, da se traka ne crta ponovo bez promjene. */
  let prikazanaUpozorenja = '';
  const iscrtajUpozorenja = (s: Stanje): void => {
    const sad = Date.now();
    const sadrzaj = prikaziUpozorenja(upozorenjaZaMjesto(s.mjesto, sad), sad).html;
    if (sadrzaj !== prikazanaUpozorenja) upozorenjaEl.innerHTML = prikazanaUpozorenja = sadrzaj;
  };

  const list = stvoriList();
  let azuriranje: Azuriranje | null = null;
  pokaziNovosti(dio('novo'), list);
  const pretraga = stvoriPretragu((m) => {
    window.scrollTo({ top: 0 });
    void skladiste.ucitaj(m);
  });

  let prije: Stanje | null = null;
  /** Temperatura koja je zadnja prikazana (zaokružena), da promjena može "prevrnuti" broj. */
  let prikazanaTemp: number | null = null;
  let uslo = false;
  const ekranEl = korijen.querySelector('.ekran') as HTMLElement;
  const mirno = matchMedia('(prefers-reduced-motion: reduce)');

  const iscrtaj = (s: Stanje): void => {
    mjestoEl.textContent = s.mjesto.ime;
    iscrtajUpozorenja(s);

    // Gradovi stižu poslije prognoze: bez ovoga bi lista sati skočila na početak.
    const promijenjenaPrognoza =
      !prije ||
      prije.prognoza !== s.prognoza ||
      prije.status !== s.status ||
      prije.zastarjelo !== s.zastarjelo ||
      prije.zrak !== s.zrak;
    if (promijenjenaPrognoza) {
      prognozaEl.innerHTML = prognoza(s).html;
      const p = zaPrikaz(s);
      if (p && s.status !== 'greska') {
        // Prvi put kad prognoza stigne: kartice uđu jedna za drugom (styles/stanja.css).
        if (!uslo) {
          uslo = true;
          ekranEl.classList.add('ulazi');
          setTimeout(() => ekranEl.classList.remove('ulazi'), 1200);
        }
        const nova = Math.round(p.sada.temp);
        if (prikazanaTemp !== null && prikazanaTemp !== nova && !mirno.matches) {
          prevrni(prognozaEl.querySelector('.sada__temp'), prikazanaTemp, nova);
        }
        prikazanaTemp = nova;
      }
      const danas = p?.dani[0];
      if (p && danas) {
        const nebo = stanjeNeba({
          kod: p.sada.kod,
          vrijeme: p.sada.vrijeme,
          izlazak: danas.izlazak,
          zalazak: danas.zalazak,
        });
        postaviNebo(nebo);
        atmosfera.postavi(p.sada.kod, nebo.doba === 'noc');
      }
    }

    if (!prije || prije.gradovi !== s.gradovi) {
      putujemEl.innerHTML = prikaziPutujem(gradoviZaPrikaz(s.gradovi)).html;
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
      case 'upozorenja': {
        const sad = Date.now();
        const lista = upozorenjaZaMjesto(s.mjesto, sad);
        if (lista.length) list.otvori(lista.length > 1 ? 'Upozorenja' : 'Upozorenje', upozorenjaDetalji(lista, sad));
        break;
      }
      case 'ves': {
        const p = zaPrikaz(s);
        if (p) list.otvori(`Veš, ${s.mjesto.ime}`, prikaziVesDetalje(p));
        break;
      }
      case 'grad': {
        const i = Number(cilj.dataset.i);
        const grad = GRADOVI[i];
        const p = gradoviZaPrikaz(s.gradovi).prognoze[i];
        if (grad && p) list.otvori(grad.ime, prikaziGradDetalje(grad, p));
        break;
      }
      case 'verzija':
        if (azuriranje) list.otvori(`Hava ${__VERSIJA__}`, azuriranjeDetalji(azuriranje));
        break;
    }
  });

  // "Provjeri sad" je u listu, a list nije unutar korijena.
  document.addEventListener('click', (e) => {
    const dugme = (e.target as Element).closest<HTMLButtonElement>('[data-provjeri]');
    if (!dugme || !azuriranje || dugme.disabled) return;
    const a = azuriranje;
    dugme.disabled = true;
    dugme.classList.add('dugme--radi');
    dugme.querySelector('span')!.textContent = 'Provjeravam';
    const cekaj = new Promise((r) => setTimeout(r, NAJMANJE_PROVJERAVA_MS));
    void Promise.all([a.provjeri(), cekaj]).finally(() => {
      if (dugme.isConnected) list.otvori(`Hava ${__VERSIJA__}`, azuriranjeDetalji(a));
    });
  });

  povuciZaOsvjezi(() => {
    // Povlačenje provjeri i novu verziju, bez čekanja na nju.
    void azuriranje?.provjeri();
    return skladiste.osvjezi();
  });

  skladiste.prati(iscrtaj);
  iscrtaj(skladiste.daj());

  return {
    // Bez promjene stanja: samo ponovo izračunaj "sad" (app otvoren, a nema mreže).
    osvjeziPrikaz() {
      prije = null;
      iscrtaj(skladiste.daj());
    },
    postaviUpozorenja(z: MaZapis[]) {
      // Pamte se samo ona koja još nisu istekla: feed nosi i sedmicu starih.
      const sad = Date.now();
      upozorenjaZapisi = z.filter((x) => x.alert?.info?.some((i) => !i.expires || Date.parse(i.expires) > sad));
      try {
        localStorage.setItem(KLJUC_UPOZORENJA, JSON.stringify(upozorenjaZapisi));
      } catch {
        // Bez pamćenja: vidi se dok je aplikacija otvorena.
      }
      iscrtajUpozorenja(skladiste.daj());
    },
    postaviMjerenja(m: Mjerenje[]) {
      mjerenja = m;
      prije = null;
      iscrtaj(skladiste.daj());
    },
    postaviAzuriranje(a: Azuriranje) {
      azuriranje = a;
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
