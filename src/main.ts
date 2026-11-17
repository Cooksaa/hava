import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/nebo.css';
import './styles/staklo.css';
import './styles/komponente.css';
import './styles/kartice.css';
import './styles/stanja.css';

import { ucitajMjesto } from './api/cache';
import { POCETNO_MJESTO } from './config';
import { stvoriSkladiste } from './state';
import { pokreniApp } from './ui/app';
import { ubaciIkone } from './ui/ikone';

const korijen = document.querySelector<HTMLElement>('#app');
if (!korijen) throw new Error('Nema #app elementa.');

const mjesto = ucitajMjesto() ?? POCETNO_MJESTO;
const skladiste = stvoriSkladiste(mjesto);

ubaciIkone();
const app = pokreniApp(korijen, skladiste);
void skladiste.ucitaj(mjesto);
void skladiste.ucitajGradove();

// Web build ovo izbaci u cijelosti (MODE je poznat pri buildu).
if (import.meta.env.MODE === 'android') {
  void import('./android').then((m) => m.pokreniAndroid(app));
}

/*
 * Osvježavanje. App na mobitelu često ostane otvoren satima, pa:
 *  - kad se vrati u prvi plan, povuci novu prognozu ako je stara starija od 10 minuta
 *  - kad se vrati internet, povuci odmah
 *  - dok je otvoren, provjeri svakih 10 minuta
 * Ako mreže nema, prikaz se ipak ponovo izračuna, da "Sad" ne ostane na starom satu.
 */
const OSVJEZI_NAKON_MS = 10 * 60 * 1000;

function osvjeziAkoTreba(): void {
  if (document.visibilityState !== 'visible') return;
  const { spremljeno } = skladiste.daj();
  if (!spremljeno || Date.now() - spremljeno > OSVJEZI_NAKON_MS) {
    app.osvjeziPrikaz();
    void skladiste.osvjezi();
  }
}

document.addEventListener('visibilitychange', osvjeziAkoTreba);
window.addEventListener('online', () => void skladiste.osvjezi());
setInterval(osvjeziAkoTreba, OSVJEZI_NAKON_MS);
