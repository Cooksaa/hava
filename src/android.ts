import { App } from '@capacitor/app';
import { BackgroundRunner } from '@capacitor/background-runner';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { citajStanje, dohvatiIzdanje, pisiStanje, type Zapamceno } from './api/azuriranje';
import { odlukaAzuriranja } from './logic/azuriranje';
import { AERODROMI, zadnjaMjerenja, type MetarZapis } from './logic/mjerenje';
import type { MaZapis } from './logic/upozorenja';
import type { Mjesto } from './tipovi';
import type { Aplikacija, Obavijesti, StanjeObavijesti } from './ui/app';

/*
 * Samo u Android aplikaciji (učitava se iz main.ts kad je build za Android).
 */
export function pokreniAndroid(app: Aplikacija): void {
  // Javi da je ova verzija web dijela proradila. Ako se nova verzija ne javi
  // u 10 s (pokvaren paket), aplikacija se sama vrati na prethodnu.
  void CapacitorUpdater.notifyAppReady();

  // Dugme ili pokret Nazad: prvo zatvori otvoreni prozor (detalji, pretraga),
  // tek kad ničega nema, spusti aplikaciju kao što to radi Home.
  void App.addListener('backButton', () => {
    const otvoreni = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
    const zadnji = otvoreni[otvoreni.length - 1];
    if (zadnji) {
      // List je možda napola povučen prstom.
      zadnji.style.transform = '';
      zadnji.style.transition = '';
      zadnji.close();
      return;
    }
    void App.minimizeApp();
  });

  app.postaviAzuriranje({
    stanje: () => citajStanje(),
    provjeri: () => azuriraj(app, true),
  });
  if (Capacitor.isPluginAvailable(DODATAK_OBAVIJESTI)) app.postaviObavijesti(obavijesti);
  void azuriraj(app);
  void izmjeri(app);
  void upozori(app);
  void App.addListener('resume', () => {
    void azuriraj(app);
    void izmjeri(app);
    void upozori(app);
  });
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    void izmjeri(app);
    void upozori(app);
  }, MJERI_NAKON_MS);
}

/*
 * Obavijesti za baš jako vrijeme. Samu provjeru radi src/pozadina (Background Runner),
 * i kad je aplikacija zatvorena; ovdje joj se samo javi mjesto i da li je uključena.
 */
const RUNNER = 'io.github.cooksaa.hava.provjera';
/** Ime pod kojim se dodatak registruje (registerPlugin u @capacitor/background-runner), ne ime u kodu. */
export const DODATAK_OBAVIJESTI = 'CapacitorBackgroundRunner';
const KLJUC_OBAVIJESTI = 'obavijesti:v1';

function citajObavijesti(): StanjeObavijesti {
  try {
    const s = localStorage.getItem(KLJUC_OBAVIJESTI);
    return s === 'ukljuceno' || s === 'iskljuceno' || s === 'odbijeno' ? s : 'nije-birano';
  } catch {
    return 'nije-birano';
  }
}

function pisiObavijesti(s: StanjeObavijesti): void {
  try {
    localStorage.setItem(KLJUC_OBAVIJESTI, s);
  } catch {
    /* ostaje za ovu sesiju */
  }
}

function javiPozadini(m: Mjesto, ukljuceno: boolean): void {
  void BackgroundRunner.dispatchEvent({
    label: RUNNER,
    event: 'postavi',
    details: { ukljuceno, ime: m.ime, lat: m.lat, lon: m.lon, bih: m.bih !== false },
  }).catch(() => {
    /* runner nije spreman: javi se opet pri sljedećoj promjeni ili otvaranju */
  });
}

const obavijesti: Obavijesti = {
  stanje: citajObavijesti,
  async ukljuci(m) {
    try {
      const d = await BackgroundRunner.requestPermissions({ apis: ['notifications'] });
      if (d.notifications !== 'granted') {
        pisiObavijesti('odbijeno');
        return 'odbijeno';
      }
    } catch {
      pisiObavijesti('odbijeno');
      return 'odbijeno';
    }
    pisiObavijesti('ukljuceno');
    javiPozadini(m, true);
    return 'ukljuceno';
  },
  iskljuci(m) {
    pisiObavijesti('iskljuceno');
    javiPozadini(m, false);
  },
  mjesto(m) {
    if (citajObavijesti() === 'ukljuceno') javiPozadini(m, true);
  },
};

/*
 * Mjerenja s aerodroma (METAR, aviationweather.gov, javni podaci). Njihov server ne
 * dozvoljava poziv iz preglednika (CORS), pa ovo ide samo kroz Androidov HTTP.
 * Stanice šalju redovno mjerenje svakih 30–60 minuta, a posebno (SPECI) čim se vrijeme
 * naglo promijeni. Odgovor je par kB, pa gledamo svakih 5 minuta dok je aplikacija otvorena.
 */
const METAR = `https://aviationweather.gov/api/data/metar?ids=${Object.keys(AERODROMI).join(',')}&format=json&hours=2`;
const MJERI_NAKON_MS = 5 * 60 * 1000;
/** Interval i provjera "je li prošlo" se ne poklope u milisekundu: ovoliko popusta. */
const POPUST_MS = 15_000;
let izmjereno = 0;

async function izmjeri(app: Aplikacija): Promise<void> {
  if (Date.now() - izmjereno < MJERI_NAKON_MS - POPUST_MS) return;
  try {
    const odgovor = await CapacitorHttp.get({ url: METAR, connectTimeout: 10_000, readTimeout: 10_000 });
    if (odgovor.status !== 200) return;
    const podaci: unknown = typeof odgovor.data === 'string' ? JSON.parse(odgovor.data) : odgovor.data;
    if (!Array.isArray(podaci)) return;
    izmjereno = Date.now();
    app.postaviMjerenja(zadnjaMjerenja(podaci as MetarZapis[]));
  } catch {
    // Bez mjerenja ostaje prognoza modela.
  }
}

/*
 * Službena upozorenja FHMZ BiH i RHMZ RS (MeteoAlarm). Ni njihov server ne dozvoljava
 * poziv iz preglednika, pa i ovo ide kroz Androidov HTTP. Zavodi ih izdaju par puta dnevno,
 * a odgovor ima ~110 kB (nekomprimovan), pa svakih 15 minuta: novo upozorenje kasni
 * najviše toliko, a mobilni podaci ne pate.
 */
const UPOZORENJA = 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-bosnia-herzegovina';
const UPOZORI_NAKON_MS = 15 * 60 * 1000;
let upozoreno = 0;

async function upozori(app: Aplikacija): Promise<void> {
  if (Date.now() - upozoreno < UPOZORI_NAKON_MS - POPUST_MS) return;
  try {
    const odgovor = await CapacitorHttp.get({ url: UPOZORENJA, connectTimeout: 10_000, readTimeout: 15_000 });
    if (odgovor.status !== 200) return;
    const podaci: unknown = typeof odgovor.data === 'string' ? JSON.parse(odgovor.data) : odgovor.data;
    const lista = (podaci as { warnings?: unknown } | null)?.warnings;
    if (!Array.isArray(lista)) return;
    upozoreno = Date.now();
    app.postaviUpozorenja(lista as MaZapis[]);
  } catch {
    // Bez mreže ostaju zadnja zapamćena upozorenja.
  }
}

/** Svakih 15 minuta pri otvaranju; "Provjeri sad" i povlačenje ekrana ne čekaju toliko. */
const PROVJERI_NAKON_MS = 15 * 60 * 1000;
const PRISILNO_NAKON_MS = 20 * 1000;
let radi: Promise<void> | null = null;

/**
 * Nova verzija web dijela se skine u pozadini i uključi kad korisnik izađe iz
 * aplikacije, pa je sljedeći put već tu. Ništa ne prekida i ništa ne pita.
 * Samo kad treba novi APK, na dnu se pokaže "Nova verzija · Preuzmi".
 * Svaki korak se zapiše (citajStanje), da se na telefonu vidi gdje je zapelo.
 */
function azuriraj(app: Aplikacija, prisili = false): Promise<void> {
  radi ??= azurirajSad(app, prisili).finally(() => (radi = null));
  return radi;
}

async function azurirajSad(app: Aplikacija, prisili: boolean): Promise<void> {
  let st = citajStanje();
  const sacuvaj = (izmjena: Partial<Zapamceno>): void => {
    st = { ...st, ...izmjena };
    pisiStanje(st);
  };

  const zadnjiPut = Math.max(st.provjereno ?? 0, st.neuspjeh?.kad ?? 0);
  const svjeze = Date.now() - (st.provjereno ?? 0) < PROVJERI_NAKON_MS;
  let izdanje = st.izdanje;
  if (!(prisili ? Date.now() - zadnjiPut < PRISILNO_NAKON_MS : svjeze)) {
    try {
      izdanje = await dohvatiIzdanje();
      sacuvaj({ izdanje, zadnja: izdanje.verzija, provjereno: Date.now(), neuspjeh: null });
    } catch (e) {
      sacuvaj({ neuspjeh: { kad: Date.now(), zasto: e instanceof Error ? e.message : 'nepoznato' } });
    }
  }
  if (!izdanje) return;

  try {
    const { version: apk } = await App.getInfo();
    const odluka = odlukaAzuriranja(izdanje, __VERSIJA__, apk);

    if (odluka.vrsta === 'preuzmi') {
      sacuvaj({ paket: { verzija: odluka.verzija, status: 'treba-apk' } });
      app.pokaziNovuVerziju(odluka.verzija, odluka.link);
      return;
    }
    if (odluka.vrsta !== 'tiho') {
      if (st.paket) sacuvaj({ paket: null });
      return;
    }

    const { bundles } = await CapacitorUpdater.list();
    const vec = bundles.find((b) => b.version === odluka.verzija);
    // Ta verzija je već pala jednom (vraćena je): ne skidaj je ukrug.
    if (vec?.status === 'error') {
      sacuvaj({ paket: { verzija: odluka.verzija, status: 'pao' } });
      return;
    }
    let paket = vec && (vec.status === 'success' || vec.status === 'pending') ? vec : null;
    if (!paket) {
      // Dodatak bez SHA-256 odbija skinuti paket (i to je dobro: zna se da je paket naš i cio).
      if (!odluka.sha256) {
        sacuvaj({ paket: null, neuspjeh: { kad: Date.now(), zasto: 'izdanje nema kontrolni zbir paketa' } });
        return;
      }
      sacuvaj({ paket: { verzija: odluka.verzija, status: 'skida' } });
      paket = await CapacitorUpdater.download({ url: odluka.url, version: odluka.verzija, checksum: odluka.sha256 });
    }
    await CapacitorUpdater.next({ id: paket.id });
    sacuvaj({ paket: { verzija: odluka.verzija, status: 'spreman' } });
  } catch (e) {
    // Skidanje prekinuto (mreža) ili odbijeno: probaj opet sljedeći put, a razlog se vidi na ekranu.
    const razlog = e instanceof Error && e.message ? e.message.replace(/https?:\/\/\S+/g, '').trim().slice(0, 80) : '';
    sacuvaj({
      paket: null,
      neuspjeh: { kad: Date.now(), zasto: `skidanje nove verzije nije uspjelo${razlog ? ` (${razlog})` : ''}` },
    });
  }
}
