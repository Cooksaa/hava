import { App } from '@capacitor/app';
import { CapacitorHttp } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { zadnjeIzdanje } from './api/azuriranje';
import { odlukaAzuriranja } from './logic/azuriranje';
import { AERODROMI, zadnjaMjerenja, type MetarZapis } from './logic/mjerenje';
import type { Aplikacija } from './ui/app';

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

  void azuriraj(app);
  void izmjeri(app);
  void App.addListener('resume', () => {
    void azuriraj(app);
    void izmjeri(app);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void izmjeri(app);
  }, MJERI_NAKON_MS);
}

/*
 * Mjerenja s aerodroma (METAR, aviationweather.gov, javni podaci). Njihov server ne
 * dozvoljava poziv iz preglednika (CORS), pa ovo ide samo kroz Androidov HTTP.
 * Stanice šalju novo mjerenje svakih 30–60 minuta.
 */
const METAR = `https://aviationweather.gov/api/data/metar?ids=${Object.keys(AERODROMI).join(',')}&format=json&hours=2`;
const MJERI_NAKON_MS = 10 * 60 * 1000;
let izmjereno = 0;

async function izmjeri(app: Aplikacija): Promise<void> {
  if (Date.now() - izmjereno < MJERI_NAKON_MS) return;
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

let radi = false;

/**
 * Nova verzija web dijela se skine u pozadini i uključi kad korisnik izađe iz
 * aplikacije, pa je sljedeći put već tu. Ništa ne prekida i ništa ne pita.
 * Samo kad treba novi APK, na dnu se pokaže "Nova verzija · Preuzmi".
 */
async function azuriraj(app: Aplikacija): Promise<void> {
  if (radi) return;
  radi = true;
  try {
    const izdanje = await zadnjeIzdanje();
    if (!izdanje) return;
    const { version: apk } = await App.getInfo();
    const odluka = odlukaAzuriranja(izdanje, __VERSIJA__, apk);

    if (odluka.vrsta === 'preuzmi') {
      app.pokaziNovuVerziju(odluka.verzija, odluka.link);
      return;
    }
    if (odluka.vrsta !== 'tiho') return;

    const { bundles } = await CapacitorUpdater.list();
    const vec = bundles.find((b) => b.version === odluka.verzija);
    // Ta verzija je već pala jednom (vraćena je): ne skidaj je ukrug.
    if (vec?.status === 'error') return;
    const paket =
      vec && (vec.status === 'success' || vec.status === 'pending')
        ? vec
        : await CapacitorUpdater.download({ url: odluka.url, version: odluka.verzija });
    await CapacitorUpdater.next({ id: paket.id });
  } catch {
    // Bez mreže ili GitHub ne odgovara: probaj opet sljedeći put.
  } finally {
    radi = false;
  }
}
