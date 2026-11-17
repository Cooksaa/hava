import { html } from './html';
import { ikonaUi } from './ikone';

/*
 * Povuci nadolje na vrhu ekrana = osvježi. Krug sa strelicom prati prst (s otporom),
 * okreće se dok se povlači, a kad se pusti dovoljno nisko, vrti se dok prognoza ne stigne.
 * Samo dodir (mobitel); na računaru ovoga nema.
 */

const PRAG = 64;
const NAJVISE = 96;
/** Krug se i kod brzog odgovora vrti bar ovoliko, da se vidi da se nešto desilo. */
const NAJMANJE_VRTI_MS = 600;

export function povuciZaOsvjezi(osvjezi: () => Promise<unknown>): void {
  const krug = document.createElement('div');
  krug.className = 'povuci';
  krug.setAttribute('aria-hidden', 'true');
  krug.innerHTML = html`${ikonaUi('osvjezi')}`.html;
  document.body.append(krug);

  let pocetakY: number | null = null;
  let pomak = 0;
  let radi = false;

  const postavi = (d: number): void => {
    krug.style.transform = `translate(-50%, ${d}px) rotate(${d * 3.2}deg)`;
    krug.style.opacity = String(Math.min(1, d / PRAG));
  };

  window.addEventListener(
    'touchstart',
    (e) => {
      if (radi || window.scrollY > 0 || e.touches.length !== 1 || document.querySelector('dialog[open]')) return;
      pocetakY = e.touches[0]!.clientY;
      pomak = 0;
      krug.classList.remove('povuci--pusti');
    },
    { passive: true },
  );

  window.addEventListener(
    'touchmove',
    (e) => {
      if (pocetakY === null) return;
      const dy = e.touches[0]!.clientY - pocetakY;
      if (dy <= 0 || window.scrollY > 0) {
        if (pomak) postavi(0);
        pomak = 0;
        return;
      }
      // Otpor: što dalje vučeš, sve manje se pomjera.
      pomak = NAJVISE * (1 - Math.exp(-dy / 220));
      postavi(pomak);
    },
    { passive: true },
  );

  const pusti = async (): Promise<void> => {
    if (pocetakY === null) return;
    pocetakY = null;
    krug.classList.add('povuci--pusti');
    if (pomak < PRAG) {
      postavi(0);
      return;
    }
    radi = true;
    postavi(PRAG);
    krug.classList.add('povuci--vrti');
    const pocetak = Date.now();
    try {
      await osvjezi();
    } finally {
      const ostalo = NAJMANJE_VRTI_MS - (Date.now() - pocetak);
      if (ostalo > 0) await new Promise((r) => setTimeout(r, ostalo));
      krug.classList.remove('povuci--vrti');
      postavi(0);
      radi = false;
    }
  };

  window.addEventListener('touchend', () => void pusti(), { passive: true });
  window.addEventListener('touchcancel', () => void pusti(), { passive: true });
}
