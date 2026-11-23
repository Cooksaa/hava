/*
 * Provjera u pozadini (Capacitor Background Runner), i kad je aplikacija zatvorena.
 *
 * Android ovo pokreće otprilike svakih 15 minuta (najčešće što dozvoljava), u malom
 * JS okruženju bez DOM-a, Intl-a i modula: zato se gradi zasebno, kao jedan fajl
 * (vite.pozadina.config.ts), i ide u APK. Ažuriranje web dijela ga NE mijenja.
 *
 * Događaji:
 *  - "postavi": aplikacija javi mjesto i da li su obavijesti uključene
 *  - "provjeri": upozorenja (MeteoAlarm) i model (ICON-2I) → obavijest ako je baš jako
 */

import {
  bezDuplikata,
  idObavijesti,
  noc,
  obavijestiModela,
  obavijestiUpozorenja,
  zaSlanje,
  type Obavijest,
  type SatModela,
} from '../logic/obavijesti';
import { regijaZa, upozorenjaZa, type MaZapis } from '../logic/upozorenja';

interface Postavke {
  ukljuceno: boolean;
  ime: string;
  lat: number;
  lon: number;
  bih: boolean;
}

declare const CapacitorKV: {
  set(kljuc: string, vrijednost: string): void;
  get(kljuc: string): { value?: string | null } | null | undefined;
};
declare const CapacitorNotifications: { schedule(o: unknown[]): void };
declare const CapacitorDevice: { getNetworkStatus(): { connected: boolean } };
declare function addEventListener(
  ime: string,
  fn: (resolve: (v?: unknown) => void, reject: (e?: unknown) => void, args?: unknown) => void,
): void;

const POSTAVKE = 'hava:postavke';
const POSLANO = 'hava:poslano';
const UPOZORENJA = 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-bosnia-herzegovina';

function citaj<T>(kljuc: string): T | null {
  try {
    const v = CapacitorKV.get(kljuc)?.value;
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

async function json(url: string): Promise<unknown> {
  const o = await fetch(url);
  if (!o.ok) throw new Error(`${o.status} ${url}`);
  return JSON.parse(await o.text()) as unknown;
}

function satiModela(p: { lat: number; lon: number }): Promise<SatModela[]> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}` +
    '&hourly=precipitation,wind_gusts_10m&models=italia_meteo_arpae_icon_2i' +
    '&forecast_hours=13&timeformat=unixtime&timezone=GMT';
  return json(url).then((j) => {
    const h = (j as { hourly?: { time?: number[]; precipitation?: (number | null)[]; wind_gusts_10m?: (number | null)[] } })
      .hourly;
    return (h?.time ?? []).map((t, i) => ({
      vrijeme: t * 1000,
      kisa: h?.precipitation?.[i] ?? 0,
      udari: h?.wind_gusts_10m?.[i] ?? 0,
    }));
  });
}

async function provjeri(): Promise<void> {
  const p = citaj<Postavke>(POSTAVKE);
  if (!p?.ukljuceno) return;
  try {
    if (!CapacitorDevice.getNetworkStatus().connected) return;
  } catch {
    /* bez podatka o mreži: probaj svejedno */
  }
  const sad = Date.now();
  const sluzbene: Obavijest[] = [];
  const model: Obavijest[] = [];

  // Službena upozorenja: samo za BiH.
  const regija = p.bih ? regijaZa(p.lat, p.lon) : null;
  if (regija) {
    try {
      const j = (await json(UPOZORENJA)) as { warnings?: MaZapis[] };
      sluzbene.push(...obavijestiUpozorenja(upozorenjaZa(j.warnings ?? [], regija, sad), sad));
    } catch {
      /* sljedeći put */
    }
  }
  // Model: noću ne budimo ljude (službeno upozorenje gore ide i noću).
  if (!noc(sad)) {
    try {
      model.push(...obavijestiModela(await satiModela(p), p.ime, sad));
    } catch {
      /* sljedeći put */
    }
  }

  const sve = bezDuplikata(sluzbene, model);
  const { nove, poslano } = zaSlanje(sve, citaj<Record<string, number>>(POSLANO) ?? {}, sad);
  if (nove.length) {
    CapacitorNotifications.schedule(
      nove.map((o) => ({
        id: idObavijesti(o.kljuc),
        title: o.naslov,
        body: o.tekst,
        largeBody: o.tekst,
        smallIcon: 'ic_stat_hava',
        autoCancel: true,
      })),
    );
  }
  CapacitorKV.set(POSLANO, JSON.stringify(poslano));
}

addEventListener('postavi', (resolve, _reject, args) => {
  try {
    CapacitorKV.set(POSTAVKE, JSON.stringify(args ?? {}));
  } catch {
    /* ništa */
  }
  resolve();
});

addEventListener('provjeri', (resolve) => {
  // Uvijek resolve: inače Android može ugasiti cijelu aplikaciju.
  provjeri().then(
    () => resolve(),
    () => resolve(),
  );
});
