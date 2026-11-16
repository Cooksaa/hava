import { html, type Sirovo } from './html';
import { ikonaUi } from './ikone';

/*
 * List koji se diže odozdo, za detalje. Jedan za cijelu aplikaciju.
 * <dialog> daje Escape i zadržavanje fokusa; povlačenje nadolje zatvara.
 */

export interface List {
  otvori(naslov: string, sadrzaj: Sirovo): void;
  zatvori(): void;
}

/** Koliko treba povući (px) ili kojom brzinom (px/ms) da se list zatvori. */
const PRAG_PX = 90;
const PRAG_BRZINE = 0.5;

export function stvoriList(): List {
  const dijalog = document.createElement('dialog');
  dijalog.className = 'list';
  dijalog.setAttribute('aria-labelledby', 'list-naslov');
  dijalog.innerHTML = html`
    <div class="list__hvat" data-hvat>
      <span class="list__rucka" aria-hidden="true"></span>
      <div class="list__vrh">
        <h2 class="list__naslov" id="list-naslov"></h2>
        <button class="okruglo" type="button" data-zatvori aria-label="Zatvori">${ikonaUi('zatvori')}</button>
      </div>
    </div>
    <div class="list__sadrzaj"></div>
  `.html;
  document.body.append(dijalog);

  const naslovEl = dijalog.querySelector('.list__naslov') as HTMLElement;
  const sadrzajEl = dijalog.querySelector('.list__sadrzaj') as HTMLElement;
  const hvat = dijalog.querySelector('[data-hvat]') as HTMLElement;

  const zatvori = (): void => {
    dijalog.style.transform = '';
    dijalog.style.transition = '';
    if (dijalog.open) dijalog.close();
  };

  dijalog.addEventListener('click', (e) => {
    const cilj = e.target as Element;
    if (cilj === dijalog || cilj.closest('[data-zatvori]')) zatvori();
  });

  // Povlačenje: list prati prst 1:1, a pri puštanju odlučuju put i brzina.
  let pocetakY = 0;
  let zadnjiY = 0;
  let zadnjeVrijeme = 0;
  let brzina = 0;
  let vuce = false;

  hvat.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button')) return;
    vuce = true;
    pocetakY = zadnjiY = e.clientY;
    zadnjeVrijeme = e.timeStamp;
    brzina = 0;
    hvat.setPointerCapture(e.pointerId);
    dijalog.style.transition = 'none';
  });

  hvat.addEventListener('pointermove', (e) => {
    if (!vuce) return;
    const dt = e.timeStamp - zadnjeVrijeme;
    if (dt > 0) brzina = (e.clientY - zadnjiY) / dt;
    zadnjiY = e.clientY;
    zadnjeVrijeme = e.timeStamp;
    dijalog.style.transform = `translateY(${Math.max(0, e.clientY - pocetakY)}px)`;
  });

  const pusti = (e: PointerEvent): void => {
    if (!vuce) return;
    vuce = false;
    const put = Math.max(0, e.clientY - pocetakY);
    dijalog.style.transition = '';
    if (put > PRAG_PX || brzina > PRAG_BRZINE) zatvori();
    else dijalog.style.transform = '';
  };
  hvat.addEventListener('pointerup', pusti);
  hvat.addEventListener('pointercancel', pusti);

  return {
    otvori(naslov, sadrzaj) {
      naslovEl.textContent = naslov;
      sadrzajEl.innerHTML = sadrzaj.html;
      sadrzajEl.scrollTop = 0;
      dijalog.style.transform = '';
      if (!dijalog.open) dijalog.showModal();
    },
    zatvori,
  };
}
