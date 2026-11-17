import { App } from '@capacitor/app';

/*
 * Samo u Android aplikaciji (učitava se iz main.ts kad je build za Android).
 *
 * Dugme ili pokret Nazad: prvo zatvori otvoreni prozor (detalji, pretraga),
 * tek kad ničega nema, spusti aplikaciju kao što to radi Home.
 * Bez ovoga Nazad odmah zatvara cijelu aplikaciju.
 */
export function pokreniAndroid(): void {
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
}
