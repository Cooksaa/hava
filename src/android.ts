import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { zadnjeIzdanje } from './api/azuriranje';
import { odlukaAzuriranja } from './logic/azuriranje';
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
  void App.addListener('resume', () => void azuriraj(app));
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
