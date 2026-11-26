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
import type { Mjesto, Prognoza } from '../tipovi';
import { stvoriAtmosferu } from './atmosfera';
import { prikaziDane } from './dani';
import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';
import { stvoriList } from './list';
import { pokaziNovosti } from './novosti';
import { postaviNebo } from './pozadina';
import { povuciZaOsvjezi } from './povuci';
import { stvoriPretragu } from './pretraga';
import { prikaziGradDetalje, prikaziPutujem } from './putujem';
import { izaberiModel, prikaziDron, prikaziDronDetalje } from './dron';
import {
  aktivnostDetalji,
  izaberiVrh,
  izabraneAktivnosti,
  izabraniVrh,
  prikaziAktivnosti,
  sacuvajAktivnosti,
  urediAktivnosti,
  type IdAktivnosti,
} from './aktivnosti';
import { dohvatiVrh } from '../api/planina';
import type { SatVrha, Vrh } from '../logic/planina';
import { dohvatiZone, imaZone } from '../api/zone';
import { zoneNaTacki, type Zona } from '../logic/zone';
import { prikaziSada, prikaziSadaKostur } from './sada';
import { prikaziSate } from './sati';
import { prikaziUpozorenja, upozorenjaDetalji } from './upozorenja';
import { prikaziVes, prikaziVesDetalje } from './ves';
import { kisaZaPrikaz, prikaziKisuSad } from './kisaSad';
import { stvoriRadarMapu } from './radarMapa';
import { kadroviWidgeta, satiIzPrognoze, type PodaciWidgeta } from '../logic/widget';
import { procijeniVes } from '../logic/ves';
import { vesRecenica } from '../tekst';
import { dohvatiRutu, vrijemeNaRuti } from '../api/put';
import { vrijemePolaska, type Polazak } from '../logic/put';
import { prikaziPut, prikaziPutDetalje, type StanjePuta } from './put';
import { apkVerzija, obrisi, prati as pratiDnevnik, sviZapisi } from '../dnevnik';
import { brojGresaka, izvjestaj, uredjaj } from '../logic/dnevnik';

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

  const kisa = kisaZaPrikaz(s.radar, Date.now());
  return html`
    ${s.zastarjelo && s.spremljeno
      ? html`<p class="napomena" role="status">${osvjezenoRecenica(s.spremljeno)}</p>`
      : ''}
    ${prikaziSada(p, jadranskiKraj(s.mjesto.lat, s.mjesto.lon), s.zrak ? zrakSad(s.zrak, p.sada.vrijeme) : null)}
    ${kisa ? prikaziKisuSad(kisa) : ''}
    ${prikaziVes(p, kisa?.kisa ?? null)}
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
  postaviObavijesti(o: Obavijesti): void;
  /** Android: widget dobija podatke kad stigne nova prognoza. */
  postaviWidget(fn: (p: PodaciWidgeta) => void): void;
}

export type StanjeObavijesti = 'nije-birano' | 'ukljuceno' | 'iskljuceno' | 'odbijeno';

/** Android: obavijesti za baš jako vrijeme (android.ts, src/pozadina). */
export interface Obavijesti {
  stanje(): StanjeObavijesti;
  ukljuci(m: Mjesto): Promise<'ukljuceno' | 'odbijeno'>;
  iskljuci(m: Mjesto): void;
  /** Mjesto se promijenilo: provjera u pozadini gleda novo. */
  mjesto(m: Mjesto): void;
}

/** Kartica pri dnu dok korisnik nije izabrao; poslije se obavijesti mijenjaju u "Hava X.Y" listu. */
function obavijestiPoziv(stanje: StanjeObavijesti, mjesto: string): Sirovo {
  if (stanje === 'nije-birano') {
    return html`
      <section class="podloga kartica obavijesti-poziv" aria-labelledby="obavijesti-naslov">
        <div class="kartica__vrh">
          <span class="kartica__znak">${ikonaUi('zvono')}</span>
          <h2 class="kartica__naslov" id="obavijesti-naslov">Obavijesti</h2>
        </div>
        <p class="obavijesti-poziv__glavno">Javi kad dolazi baš jaka kiša ili vjetar</p>
        <p class="kartica__detalj">Za mjesto ${mjesto}, i kad je aplikacija zatvorena. Samo kad je ozbiljno, ne svaki dan.</p>
        <div class="obavijesti-poziv__dugmad">
          <button class="dugme" type="button" data-akcija="obavijesti-ukljuci">Uključi</button>
          <button class="obavijesti-poziv__ne" type="button" data-akcija="obavijesti-ne">Ne sad</button>
        </div>
      </section>
    `;
  }
  if (stanje === 'odbijeno') {
    return html`
      <section class="podloga kartica obavijesti-poziv" aria-labelledby="obavijesti-naslov">
        <div class="kartica__vrh">
          <span class="kartica__znak">${ikonaUi('zvono')}</span>
          <h2 class="kartica__naslov" id="obavijesti-naslov">Obavijesti su blokirane</h2>
        </div>
        <p class="kartica__detalj">Android ih ne pušta. Uključi ih u postavkama telefona: Aplikacije → Hava → Obavijesti, pa ovdje ponovo.</p>
        <div class="obavijesti-poziv__dugmad">
          <button class="dugme" type="button" data-akcija="obavijesti-ukljuci">Pokušaj ponovo</button>
          <button class="obavijesti-poziv__ne" type="button" data-akcija="obavijesti-ne">Ne treba</button>
        </div>
      </section>
    `;
  }
  return html``;
}

function obavijestiDetalji(mjesto: string, ukljuceno: boolean): Sirovo {
  if (!ukljuceno) {
    return html`
      <p class="list__glavno">Obavijesti su isključene.</p>
      <p class="list__detalj">Uključi ih da ti Hava javi za baš jaku kišu i vjetar, i kad je zatvorena.</p>
      <button class="dugme" type="button" data-obavijesti="ukljuci">${ikonaUi('zvono')}<span>Uključi</span></button>
    `;
  }
  return html`
    <p class="list__glavno">Uključeno za mjesto ${mjesto}.</p>
    <p class="list__detalj">
      Javimo se kad zavod izda narandžasto ili crveno upozorenje, i kad model vidi udare vjetra od 75 km/h ili
      jaku kišu u narednih 12 sati. Noću samo službena upozorenja.
    </p>
    <h3 class="list__podnaslov">Na Xiaomi i Redmi telefonima</h3>
    <p class="list__detalj">
      Da provjera radi i kad je Hava zatvorena: Postavke → Aplikacije → Hava → Autostart uključi, a Ušteda baterije
      stavi na „Bez ograničenja“. Inače telefon ugasi provjeru da štedi bateriju.
    </p>
    <button class="dugme" type="button" data-obavijesti="iskljuci">Isključi obavijesti</button>
  `;
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

/** Kome ide izvještaj: kontakt sa stranice autora (alemcoksa.com). */
const MAIL_IZVJESTAJ = 'hello@alemcoksa.com';

function tekstIzvjestaja(): string {
  return izvjestaj(sviZapisi(), {
    verzija: __VERSIJA__,
    apk: apkVerzija(),
    uredjaj: uredjaj(navigator.userAgent),
    sad: Date.now(),
  });
}

function izvjestajDetalji(kopirano = false): Sirovo {
  const z = sviZapisi();
  if (!z.length) {
    return html`<p class="list__glavno">Nema zapisanih grešaka.</p>`;
  }
  const tekst = tekstIzvjestaja();
  const mail = `mailto:${MAIL_IZVJESTAJ}?subject=${encodeURIComponent(`Hava ${__VERSIJA__}: greške`)}&body=${encodeURIComponent(tekst.slice(0, 1800))}`;
  const ukupno = z.reduce((n, x) => n + x.puta, 0);
  return html`
    <p class="list__glavno">Hava je zapisala ${brojGresaka(ukupno)}.</p>
    <p class="list__detalj">
      Pošalji izvještaj i popravit ćemo. U njemu su samo greške, verzija i model telefona: bez lokacije i ličnih
      podataka.
    </p>
    <pre class="izvjestaj">${tekst}</pre>
    <div class="izvjestaj__dugmad">
      <button class="dugme" type="button" data-izvjestaj="kopiraj">${kopirano ? 'Kopirano' : 'Kopiraj'}</button>
      <a class="dugme" href="${mail}">Pošalji mailom</a>
      <button class="obavijesti-poziv__ne" type="button" data-izvjestaj="obrisi">Obriši</button>
    </div>
    ${kopirano ? html`<p class="list__detalj">Zalijepi u Viber, WhatsApp ili poruku.</p>` : ''}
  `;
}

export function pokreniApp(korijen: HTMLElement, skladiste: Skladiste): Aplikacija {
  korijen.innerHTML = html`
    <div class="nebo" aria-hidden="true"></div>
    <div class="ekran">
      <header class="vrh">
        <h1 class="mjesto" data-dio="mjesto"></h1>
        <button class="okruglo vrh__radar" type="button" data-akcija="radar" aria-label="Radar" aria-haspopup="dialog">
          ${ikonaUi('mapa')}
        </button>
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
          <div data-dio="dron"></div>
          <div data-dio="aktivnosti"></div>
          <button class="aktivnosti__uredi" type="button" data-akcija="uredi-aktivnosti" aria-haspopup="dialog">
            ${ikonaUi('postavke')}<span>Uredi aktivnosti</span>
          </button>
        </div>
      </main>
      <div data-dio="obavijesti"></div>
      <div data-dio="azuriranje"></div>
      <footer class="izvor">
        ${APLIKACIJA
          ? html`<button class="izvor__verzija" type="button" data-akcija="verzija" aria-haspopup="dialog">
              Hava ${__VERSIJA__}
            </button>`
          : ''}
        <button class="izvor__izvjestaj" type="button" data-akcija="izvjestaj" aria-haspopup="dialog" hidden>
          Pošalji izvještaj o greškama
        </button>
        <span>
          Podaci:
          <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>,
          ICON-2I, CAMS,
          <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>${APLIKACIJA
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
  const radarMapa = stvoriRadarMapu();
  if (import.meta.env.DEV) (window as unknown as { __radarMapa: typeof radarMapa }).__radarMapa = radarMapa;
  let azuriranje: Azuriranje | null = null;
  let obavijesti: Obavijesti | null = null;
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

  const iscrtajObavijesti = (): void => {
    dio('obavijesti').innerHTML = obavijesti ? obavijestiPoziv(obavijesti.stanje(), skladiste.daj().mjesto.ime).html : '';
  };

  const iscrtaj = (s: Stanje): void => {
    mjestoEl.textContent = s.mjesto.ime;
    if (prije?.mjesto !== s.mjesto) {
      obavijesti?.mjesto(s.mjesto);
      iscrtajObavijesti();
      ucitajZoneMjesta(s.mjesto);
      // Planina: najbliži vrh novom mjestu (osim ako je vrh izabran ručno).
      if (prije) {
        const v = izabraniVrh(s.mjesto);
        if (v.id !== vrh.vrh.id) {
          vrh = { vrh: v, sati: null, kad: 0 };
          ucitajVrh();
        }
      }
      if (prije && put) void izracunajPut();
    }
    iscrtajUpozorenja(s);

    // Gradovi stižu poslije prognoze: bez ovoga bi lista sati skočila na početak.
    const promijenjenaPrognoza =
      !prije ||
      prije.prognoza !== s.prognoza ||
      prije.status !== s.status ||
      prije.zastarjelo !== s.zastarjelo ||
      prije.zrak !== s.zrak ||
      prije.radar !== s.radar;
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
      iscrtajPutujem(s);
    }

    if (promijenjenaPrognoza || prije?.visine !== s.visine) iscrtajDron(s);
    if (promijenjenaPrognoza) {
      iscrtajAktivnosti(s);
      ucitajVrh();
    }
    if (promijenjenaPrognoza) posaljiWidgetu(s);
    // Put se računa jednom pri pokretanju, pa kad je stariji od 15 min (nova prognoza).
    const putStar =
      put !== null &&
      (putIzracunat === 0 ? !putZahtjev : put.status !== 'ucitava' && Date.now() - putIzracunat > 15 * 60e3);
    if (putStar) void izracunajPut();

    prije = s;
  };

  /* --- Putujem: odredište i vrijeme duž puta --- */

  const KLJUC_PUT = 'put:v1';
  let put: StanjePuta | null = (() => {
    try {
      const z = JSON.parse(localStorage.getItem(KLJUC_PUT) ?? 'null') as { odrediste: Mjesto; polazak: Polazak } | null;
      return z?.odrediste ? { odrediste: z.odrediste, polazak: z.polazak ?? 'sad', status: 'ucitava' } : null;
    } catch {
      return null;
    }
  })();
  let putIzracunat = 0;
  let putZahtjev: AbortController | null = null;
  const sacuvajPut = (): void => {
    try {
      if (put) localStorage.setItem(KLJUC_PUT, JSON.stringify({ odrediste: put.odrediste, polazak: put.polazak }));
      else localStorage.removeItem(KLJUC_PUT);
    } catch {
      /* bez pamćenja */
    }
  };
  function iscrtajPutujem(s: Stanje): void {
    putujemEl.innerHTML = prikaziPutujem(gradoviZaPrikaz(s.gradovi), prikaziPut(put, s.mjesto)).html;
  }
  /** Službena upozorenja za regije kroz koje put prolazi, u vrijeme vožnje. */
  function upozorenjaNaPutu(p: StanjePuta): Upozorenje[] {
    const tacke = p.tacke ?? [];
    if (!tacke.length) return [];
    const od = tacke[0]!.kad;
    const do_ = tacke[tacke.length - 1]!.kad;
    const regije = new Set(tacke.map((t) => regijaZa(t.lat, t.lon)).filter((x): x is string => !!x));
    const sve = [...regije].flatMap((r) => upozorenjaZa(upozorenjaZapisi, r, Date.now()));
    const vidjeno = new Set<string>();
    return sve
      .filter((u) => u.od <= do_ && u.do >= od)
      .sort((a, b) => b.nivo - a.nivo)
      .filter((u) => {
        const k = `${u.vrsta}|${u.regija}`;
        if (vidjeno.has(k)) return false;
        vidjeno.add(k);
        return true;
      });
  }
  async function izracunajPut(): Promise<void> {
    if (!put) return;
    putZahtjev?.abort();
    const moj = new AbortController();
    putZahtjev = moj;
    const od = skladiste.daj().mjesto;
    put = { odrediste: put.odrediste, polazak: put.polazak, status: 'ucitava' };
    iscrtajPutujem(skladiste.daj());
    try {
      const ruta = await dohvatiRutu(od, put.odrediste, moj.signal);
      const tacke = await vrijemeNaRuti(ruta, vrijemePolaska(put.polazak, Date.now()), moj.signal);
      if (moj.signal.aborted || !put) return;
      put = { ...put, status: 'spremno', ruta, tacke };
      put.upozorenja = upozorenjaNaPutu(put);
      putIzracunat = Date.now();
    } catch {
      if (moj.signal.aborted || !put) return;
      put = { ...put, status: 'greska' };
      putIzracunat = Date.now();
    }
    iscrtajPutujem(skladiste.daj());
  }
  const pretragaPuta = stvoriPretragu(
    (m) => {
      put = { odrediste: m, polazak: put?.polazak ?? 'sad', status: 'ucitava' };
      sacuvajPut();
      void izracunajPut();
    },
    'Kuda putuješ?',
    'put-naslov',
  );

  /* --- Widget (Android) --- */
  let widget: ((p: PodaciWidgeta) => void) | null = null;
  function posaljiWidgetu(s: Stanje): void {
    const p = zaPrikaz(s);
    if (!widget || !p || s.status === 'greska') return;
    const danas = p.dani[0];
    widget({
      mjesto: s.mjesto.ime,
      izracunato: Date.now(),
      kadrovi: kadroviWidgeta(satiIzPrognoze(p), Date.now()),
      // Veš za danas (ili "Sutra…" uveče), vezan za današnji datum.
      ves: danas ? { datum: danas.datum, tekst: vesRecenica(procijeniVes(p)).glavno } : undefined,
    });
  }

  const dronEl = dio('dron');
  /* --- Aktivnosti: prskanje, roštilj, planina (i izbor šta se vidi) --- */
  const aktEl = dio('aktivnosti');
  let aktivnosti = izabraneAktivnosti();
  let vrh: { vrh: Vrh; sati: SatVrha[] | null; kad: number } = { vrh: izabraniVrh(skladiste.daj().mjesto), sati: null, kad: 0 };
  const iscrtajAktivnosti = (s: Stanje): void => {
    aktEl.innerHTML = prikaziAktivnosti(aktivnosti, s.status === 'greska' ? null : zaPrikaz(s), s.mjesto, vrh).html;
  };
  function ucitajVrh(prisili = false): void {
    if (!aktivnosti.includes('planina')) return;
    if (!prisili && vrh.sati && Date.now() - vrh.kad < 30 * 60e3) return;
    const v = vrh.vrh;
    void dohvatiVrh(v)
      .then((sati) => {
        if (vrh.vrh !== v) return;
        vrh = { vrh: v, sati, kad: Date.now() };
        iscrtajAktivnosti(skladiste.daj());
      })
      .catch(() => undefined);
  }

  const iscrtajDron = (s: Stanje): void => {
    if (!aktivnosti.includes('dron')) {
      dronEl.innerHTML = '';
      return;
    }
    dronEl.innerHTML = prikaziDron(s.status === 'greska' ? null : zaPrikaz(s), s.mjesto, s.visine, zoneMjesta).html;
  };
  /** DJI zone na samom mjestu (Android), za karticu drona. null = još nije stiglo. */
  let zoneMjesta: Zona[] | null = null;
  function ucitajZoneMjesta(m: Mjesto): void {
    zoneMjesta = null;
    if (!imaZone()) return;
    void dohvatiZone(m.lat, m.lon, 5000).then((r) => {
      if (skladiste.daj().mjesto !== m) return;
      zoneMjesta = r ? zoneNaTacki(r.zone, m.lat, m.lon) : [];
      iscrtajDron(skladiste.daj());
    });
  }
  const dronDetalji = (s: Stanje): Sirovo | null => {
    const p = zaPrikaz(s);
    return p ? prikaziDronDetalje(p, s.mjesto, s.visine, zoneMjesta, imaZone()) : null;
  };
  /** Dron izabran ili promijenjen u listu: kartica i list se odmah preračunaju. */
  const promijeniDron = (id: string): void => {
    izaberiModel(id);
    const s = skladiste.daj();
    iscrtajDron(s);
    const d = dronDetalji(s);
    if (d) list.otvori('Dron', d);
  };
  // Dnevnik grešaka: link pod verzijom se pokaže kad ima šta poslati.
  const izvjestajEl = korijen.querySelector<HTMLButtonElement>('[data-akcija="izvjestaj"]')!;
  const iscrtajIzvjestaj = (): void => {
    izvjestajEl.hidden = sviZapisi().length === 0;
  };
  pratiDnevnik(iscrtajIzvjestaj);
  iscrtajIzvjestaj();
  document.addEventListener('click', (e) => {
    const d = (e.target as Element).closest<HTMLElement>('[data-izvjestaj]');
    if (!d) return;
    if (d.dataset.izvjestaj === 'kopiraj') {
      void navigator.clipboard
        ?.writeText(tekstIzvjestaja())
        .then(() => list.otvori('Izvještaj o greškama', izvjestajDetalji(true)))
        .catch(() => undefined);
    } else if (d.dataset.izvjestaj === 'obrisi') {
      obrisi();
      list.zatvori();
    }
  });

  // "Put na mapi" iz lista Putujem.
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-put-mapa]') || !put?.ruta || !put.tacke) return;
    list.zatvori();
    const s = skladiste.daj();
    radarMapa.otvori(s.mjesto, s.radar, 'radar', { ruta: put.ruta, tacke: put.tacke });
  });

  // "Zone na mapi" iz lista drona (list nije u korijenu).
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-zone-mapa]')) return;
    list.zatvori();
    const s = skladiste.daj();
    radarMapa.otvori(s.mjesto, s.radar, 'zone');
  });
  document.addEventListener('change', (e) => {
    const el = e.target as HTMLElement;
    // Uredi aktivnosti: kvačica uključi ili sakrije karticu.
    if (el.matches('[data-aktivnost]')) {
      const id = (el as HTMLInputElement).dataset.aktivnost as IdAktivnosti;
      aktivnosti = (el as HTMLInputElement).checked ? [...new Set([...aktivnosti, id])] : aktivnosti.filter((x) => x !== id);
      sacuvajAktivnosti(aktivnosti);
      const st = skladiste.daj();
      iscrtajDron(st);
      iscrtajAktivnosti(st);
      ucitajVrh();
      return;
    }
    if (el.matches('[data-vrh]')) {
      izaberiVrh((el as HTMLSelectElement).value);
      vrh = { vrh: izabraniVrh(skladiste.daj().mjesto), sati: null, kad: 0 };
      iscrtajAktivnosti(skladiste.daj());
      ucitajVrh(true);
      list.zatvori();
      return;
    }
    if (el.matches('[data-dron-model]')) {
      const v = (el as HTMLSelectElement).value;
      // "Drugi": počni od 10 m/s, pa korisnik upiše svoj broj.
      promijeniDron(v === 'drugi' ? 'drugi:10' : v);
    } else if (el.matches('[data-dron-otpor]')) {
      const ms = Number((el as HTMLInputElement).value.replace(',', '.'));
      if (ms >= 3 && ms <= 25) promijeniDron(`drugi:${ms}`);
    }
  });

  korijen.addEventListener('click', (e) => {
    const polazak = (e.target as Element).closest<HTMLElement>('[data-polazak]');
    if (polazak && put) {
      put = { ...put, polazak: polazak.dataset.polazak as Polazak };
      sacuvajPut();
      void izracunajPut();
      return;
    }
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
      case 'dron': {
        const d = dronDetalji(s);
        if (d) list.otvori('Dron', d);
        break;
      }
      case 'put-odrediste':
        pretragaPuta.otvori();
        break;
      case 'put-ukloni':
        putZahtjev?.abort();
        put = null;
        sacuvajPut();
        iscrtajPutujem(s);
        break;
      case 'put':
        if (put) list.otvori('Putujem', prikaziPutDetalje(put, s.mjesto, true));
        break;
      case 'uredi-aktivnosti':
        list.otvori('Aktivnosti', urediAktivnosti(aktivnosti));
        break;
      case 'akt-prskanje':
      case 'akt-rostilj':
      case 'akt-planina': {
        const id = cilj.dataset.akcija!.slice(4) as IdAktivnosti;
        const p = zaPrikaz(s);
        const d = p ? aktivnostDetalji(id, p, s.mjesto, vrh) : null;
        const naslov = id === 'prskanje' ? 'Prskanje' : id === 'rostilj' ? 'Roštilj i vani' : 'Planina';
        if (d) list.otvori(naslov, d);
        break;
      }
      case 'izvjestaj':
        list.otvori('Izvještaj o greškama', izvjestajDetalji());
        break;
      case 'radar':
        radarMapa.otvori(s.mjesto, s.radar);
        break;
      case 'verzija':
        if (azuriranje) list.otvori(`Hava ${__VERSIJA__}`, verzijaDetalji());
        break;
      case 'obavijesti-ukljuci':
        void ukljuciObavijesti();
        break;
      case 'obavijesti-ne':
        obavijesti?.iskljuci(s.mjesto);
        iscrtajObavijesti();
        break;
    }
  });

  /** "Hava X.Y" list: ažuriranje, pa obavijesti. */
  const verzijaDetalji = (): Sirovo => {
    const o = obavijesti;
    return html`
      ${azuriranje ? azuriranjeDetalji(azuriranje) : ''}
      ${o
        ? html`<h3 class="list__podnaslov">Obavijesti</h3>
            <p class="list__detalj">
              ${o.stanje() === 'ukljuceno' ? `Uključene za mjesto ${skladiste.daj().mjesto.ime}.` : 'Isključene.'}
            </p>
            <button class="dugme" type="button" data-obavijesti="${o.stanje() === 'ukljuceno' ? 'detalji' : 'ukljuci'}">
              ${o.stanje() === 'ukljuceno' ? 'Više o obavijestima' : 'Uključi obavijesti'}
            </button>`
        : ''}
    `;
  };

  async function ukljuciObavijesti(): Promise<void> {
    if (!obavijesti) return;
    const m = skladiste.daj().mjesto;
    const ishod = await obavijesti.ukljuci(m);
    iscrtajObavijesti();
    if (ishod === 'ukljuceno') list.otvori('Obavijesti', obavijestiDetalji(m.ime, true));
  }

  // Dugmad za obavijesti u listu (list nije unutar korijena).
  document.addEventListener('click', (e) => {
    const dugme = (e.target as Element).closest<HTMLButtonElement>('[data-obavijesti]');
    if (!dugme || !obavijesti) return;
    const m = skladiste.daj().mjesto;
    switch (dugme.dataset.obavijesti) {
      case 'ukljuci':
        void ukljuciObavijesti();
        break;
      case 'iskljuci':
        obavijesti.iskljuci(m);
        iscrtajObavijesti();
        list.otvori('Obavijesti', obavijestiDetalji(m.ime, false));
        break;
      case 'detalji':
        list.otvori('Obavijesti', obavijestiDetalji(m.ime, true));
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
      if (dugme.isConnected) list.otvori(`Hava ${__VERSIJA__}`, verzijaDetalji());
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
    postaviWidget(fn: (p: PodaciWidgeta) => void) {
      widget = fn;
      posaljiWidgetu(skladiste.daj());
    },
    postaviObavijesti(o: Obavijesti) {
      obavijesti = o;
      o.mjesto(skladiste.daj().mjesto);
      iscrtajObavijesti();
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
