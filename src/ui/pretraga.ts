import { bezDuplih, traziMjesta, type Pogodak } from '../api/geocoding';
import { gdjeSam, type GreskaLokacije } from '../api/lokacija';
import { GRADOVI } from '../config';
import { mjestoZaKoordinate, traziPoznata } from '../logic/mjesto';
import { BIH } from '../mjesta';
import { lokacijaGreska } from '../tekst';
import type { Mjesto } from '../tipovi';
import { html } from './html';
import { ikonaUi } from './ikone';

/*
 * Izbor mjesta: list koji se spušta s vrha (dolje je tastatura).
 * <dialog> daje zatvaranje na Escape i zadržavanje fokusa bez dodatnog koda.
 */

const CEKANJE_MS = 300;

export interface Pretraga {
  otvori(): void;
}

export function stvoriPretragu(naIzbor: (m: Mjesto) => void, naslov = 'Koje mjesto?', id = 'pretraga-naslov'): Pretraga {
  const dijalog = document.createElement('dialog');
  dijalog.className = 'pretraga';
  dijalog.setAttribute('aria-labelledby', id);
  dijalog.innerHTML = html`
    <div class="pretraga__vrh">
      <h2 class="pretraga__naslov" id="${id}">${naslov}</h2>
      <button class="okruglo" type="button" data-zatvori aria-label="Zatvori">${ikonaUi('zatvori')}</button>
    </div>
    <div class="pretraga__polje">
      ${ikonaUi('lupa')}
      <input
        type="search"
        aria-labelledby="pretraga-naslov"
        placeholder="npr. Mostar"
        autocomplete="off"
        autocapitalize="words"
        spellcheck="false"
        enterkeyhint="search"
      />
    </div>
    <p class="pretraga__stanje" role="status"></p>
    <ul class="pretraga__lista"></ul>
  `.html;
  document.body.append(dijalog);

  const unos = dijalog.querySelector('input') as HTMLInputElement;
  const stanje = dijalog.querySelector('.pretraga__stanje') as HTMLElement;
  const lista = dijalog.querySelector('.pretraga__lista') as HTMLElement;

  let prikazano: Pogodak[] = [];
  let zahtjev: AbortController | null = null;
  let sat: ReturnType<typeof setTimeout> | undefined;

  const iscrtaj = (mjesta: Pogodak[], saLokacijom: boolean): void => {
    prikazano = mjesta;
    lista.innerHTML = html`
      ${saLokacijom
        ? html`
            <li>
              <button class="red red--lokacija" type="button" data-lokacija>
                ${ikonaUi('lokacija')}<span class="red__ime">Moja lokacija</span>
              </button>
            </li>
          `
        : ''}
      ${mjesta.map(
        (m, i) => html`
          <li>
            <button class="red" type="button" data-i="${i}">
              <span class="red__ime">${m.ime}</span>
              ${m.opis ? html`<span class="red__opis">${m.opis}</span>` : ''}
            </button>
          </li>
        `,
      )}
    `.html;
  };

  const pocetno = (): void => {
    stanje.textContent = '';
    iscrtaj(
      GRADOVI.map((g) => ({ ime: g.ime, lat: g.lat, lon: g.lon, bih: true, opis: '' })),
      true,
    );
  };

  const izaberi = (m: Mjesto): void => {
    dijalog.close();
    naIzbor({ ime: m.ime, lat: m.lat, lon: m.lon, ...(m.bih !== undefined ? { bih: m.bih } : {}) });
  };

  const trazi = (upit: string): void => {
    zahtjev?.abort();
    clearTimeout(sat);

    if (upit.trim().length < 2) {
      pocetno();
      return;
    }

    // Ugrađena lista odmah, i bez interneta. Ostalo stiže s mreže.
    const poznata: Pogodak[] = traziPoznata(upit).map((m) => ({
      ime: m.ime,
      lat: m.lat,
      lon: m.lon,
      bih: m.drzava === BIH,
      opis: m.drzava,
    }));
    iscrtaj(poznata, false);
    stanje.textContent = poznata.length ? '' : 'Tražim…';

    sat = setTimeout(() => {
      const moj = new AbortController();
      zahtjev = moj;
      traziMjesta(upit.trim(), moj.signal)
        .then((mrezna) => {
          if (moj.signal.aborted) return;
          // Mrežni pogodak ima potpuniji opis, pa ide prije ugrađenog istog imena.
          const sve = bezDuplih([...mrezna, ...poznata]).slice(0, 8);
          iscrtaj(sve, false);
          stanje.textContent = sve.length ? '' : 'Nema takvog mjesta.';
        })
        .catch(() => {
          if (moj.signal.aborted) return;
          stanje.textContent = poznata.length ? '' : 'Pretraga ne radi bez interneta.';
        });
    }, CEKANJE_MS);
  };

  const lokacija = async (dugme: HTMLElement): Promise<void> => {
    const ime = dugme.querySelector('.red__ime');
    if (ime) ime.textContent = 'Tražim gdje si…';
    dugme.setAttribute('disabled', '');
    try {
      const { lat, lon } = await gdjeSam();
      izaberi(mjestoZaKoordinate(lat, lon));
    } catch (e) {
      stanje.textContent = lokacijaGreska(e as GreskaLokacije);
      if (ime) ime.textContent = 'Moja lokacija';
      dugme.removeAttribute('disabled');
    }
  };

  unos.addEventListener('input', () => trazi(unos.value));

  // Enter bira prvi pogodak.
  unos.addEventListener('keydown', (e) => {
    const prvi = prikazano[0];
    if (e.key === 'Enter' && prvi && unos.value.trim().length >= 2) {
      e.preventDefault();
      izaberi(prvi);
    }
  });

  dijalog.addEventListener('click', (e) => {
    const cilj = e.target as Element;
    // Dodir pored lista (na zatamnjenje) zatvara.
    if (cilj === dijalog || cilj.closest('[data-zatvori]')) {
      dijalog.close();
      return;
    }
    const dugmeLokacije = cilj.closest<HTMLElement>('[data-lokacija]');
    if (dugmeLokacije) {
      void lokacija(dugmeLokacije);
      return;
    }
    const red = cilj.closest<HTMLElement>('[data-i]');
    const m = red ? prikazano[Number(red.dataset.i)] : undefined;
    if (m) izaberi(m);
  });

  dijalog.addEventListener('close', () => {
    zahtjev?.abort();
    clearTimeout(sat);
  });

  return {
    otvori() {
      unos.value = '';
      pocetno();
      dijalog.showModal();
      unos.focus();
    },
  };
}
