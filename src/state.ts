import {
  spremiGradove,
  spremiMjesto,
  spremiPrognozu,
  ucitajGradove,
  ucitajPrognozu,
} from './api/cache';
import { GreskaPrognoze, dohvatiPrognoze, dohvatiPrognozu } from './api/openMeteo';
import { dohvatiRadar, type Radar } from './api/radar';
import { dohvatiVisine } from './api/visina';
import { dohvatiZrak } from './api/zrak';
import type { Visina } from './logic/dron';
import type { Zrak } from './logic/zrak';
import { GRADOVI } from './config';
import type { Mjesto, Prognoza } from './tipovi';

/* Jedno malo skladište stanja. UI se pretplati i iscrta se kad se nešto promijeni. */

export type Status = 'ucitava' | 'spremno' | 'greska';

/** "Pada li u…?": prognoze za gradove iz config.ts, istim redom. */
export interface StanjeGradova {
  status: Status;
  prognoze: Prognoza[];
}

export interface Stanje {
  mjesto: Mjesto;
  prognoza: Prognoza | null;
  status: Status;
  /** Kad je prikazana prognoza dohvaćena (ms). */
  spremljeno: number | null;
  /** Prikazujemo staru prognozu jer nova nije stigla. */
  zastarjelo: boolean;
  greska: 'mreza' | 'server' | null;
  gradovi: StanjeGradova;
  /** Kvalitet zraka za mjesto; null dok ne stigne ili ako ga nema. */
  zrak: Zrak | null;
  /** Kiša u naredna 2 sata s radara; null dok ne stigne, van pokrivenosti ili bez mreže. */
  radar: Radar | null;
  /** Vjetar na 80/120 m po satu (lokalno vrijeme), za dron. */
  visine: Map<string, Visina> | null;
}

type Pretplatnik = (s: Stanje) => void;

export interface Skladiste {
  daj(): Stanje;
  prati(fn: Pretplatnik): () => void;
  /** Promijeni mjesto i dohvati prognozu. */
  ucitaj(mjesto: Mjesto): Promise<void>;
  /** Ponovo dohvati za trenutno mjesto, i gradove. */
  osvjezi(): Promise<void>;
  ucitajGradove(): Promise<void>;
  /** Samo radar za trenutno mjesto (svakih 5 min, main.ts). */
  osvjeziRadar(): Promise<void>;
}

export function stvoriSkladiste(pocetnoMjesto: Mjesto): Skladiste {
  let stanje: Stanje = {
    mjesto: pocetnoMjesto,
    prognoza: null,
    status: 'ucitava',
    spremljeno: null,
    zastarjelo: false,
    greska: null,
    gradovi: { status: 'ucitava', prognoze: ucitajGradove(GRADOVI.length) ?? [] },
    zrak: null,
    radar: null,
    visine: null,
  };
  const pretplatnici = new Set<Pretplatnik>();
  let zahtjev: AbortController | null = null;

  const postavi = (dio: Partial<Stanje>): void => {
    stanje = { ...stanje, ...dio };
    for (const fn of pretplatnici) fn(stanje);
  };

  async function ucitaj(mjesto: Mjesto): Promise<void> {
    // Novi zahtjev poništava stari, da spor odgovor za prošli grad ne pregazi novi.
    zahtjev?.abort();
    const moj = new AbortController();
    zahtjev = moj;

    spremiMjesto(mjesto);
    const staro = ucitajPrognozu(mjesto);
    const istoMjesto = mjesto.lat === stanje.mjesto.lat && mjesto.lon === stanje.mjesto.lon;
    // Zrak stiže sa svog servisa, paralelno; ne čeka ga ni prognoza ni greška.
    void dohvatiZrak(mjesto, moj.signal).then((zrak) => {
      if (!moj.signal.aborted && zrak) postavi({ zrak });
    });
    // Radar isto. Ako ne stigne, ostaje zadnji za isto mjesto (app.ts ga ne prikaže kad je prestar).
    void dohvatiRadar(mjesto, moj.signal).then((radar) => {
      if (!moj.signal.aborted && radar) postavi({ radar });
    });
    // Vjetar na visini za dron, isto paralelno.
    void dohvatiVisine(mjesto, moj.signal).then((visine) => {
      if (!moj.signal.aborted && visine) postavi({ visine });
    });
    postavi({
      mjesto,
      ...(istoMjesto ? {} : { zrak: null, radar: null, visine: null }),
      prognoza: staro?.prognoza ?? null,
      spremljeno: staro?.spremljeno ?? null,
      status: staro ? 'spremno' : 'ucitava',
      zastarjelo: false,
      greska: null,
    });

    try {
      const prognoza = await dohvatiPrognozu(mjesto, moj.signal);
      const spremljeno = spremiPrognozu(mjesto, prognoza);
      postavi({ prognoza, spremljeno, status: 'spremno', zastarjelo: false, greska: null });
    } catch (e) {
      if (moj.signal.aborted) return;
      const vrsta = e instanceof GreskaPrognoze ? e.vrsta : 'server';
      // Ako imamo staru prognozu, ostaje na ekranu uz napomenu. Inače greška.
      postavi(
        stanje.prognoza
          ? { zastarjelo: true, greska: vrsta }
          : { status: 'greska', greska: vrsta },
      );
    }
  }

  async function gradovi(): Promise<void> {
    postavi({ gradovi: { ...stanje.gradovi, status: 'ucitava' } });
    try {
      const prognoze = await dohvatiPrognoze(GRADOVI);
      spremiGradove(prognoze);
      postavi({ gradovi: { status: 'spremno', prognoze } });
    } catch {
      // Stare prognoze, ako ih ima, ostaju na ekranu.
      postavi({ gradovi: { status: 'greska', prognoze: stanje.gradovi.prognoze } });
    }
  }

  return {
    daj: () => stanje,
    prati(fn) {
      pretplatnici.add(fn);
      return () => pretplatnici.delete(fn);
    },
    ucitaj,
    async osvjezi() {
      await Promise.all([ucitaj(stanje.mjesto), gradovi()]);
    },
    ucitajGradove: gradovi,
    async osvjeziRadar() {
      const m = stanje.mjesto;
      const radar = await dohvatiRadar(m);
      // U međuvremenu promijenjeno mjesto: ovaj radar više ne važi.
      if (radar && m === stanje.mjesto) postavi({ radar });
    },
  };
}
