/*
 * Provjera u pozadini (Capacitor Background Runner), i kad je aplikacija zatvorena.
 *
 * Android ovo pokreće otprilike svakih 15 minuta (najčešće što dozvoljava), u malom
 * JS okruženju bez DOM-a, Intl-a i modula: zato se gradi zasebno, kao jedan fajl
 * (vite.pozadina.config.ts), i ide u APK. Ažuriranje web dijela ga NE mijenja.
 *
 * Događaji:
 *  - "postavi": aplikacija javi mjesto i da li su obavijesti uključene
 *  - "provjeri": svježi kadrovi za widget (uvijek), pa upozorenja (MeteoAlarm) i model
 *    (ICON-2I) → obavijest ako je baš jako (samo kad su obavijesti uključene)
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
import { lokalno } from '../logic/sarajevo';
import { regijaZa, upozorenjaZa, type MaZapis } from '../logic/upozorenja';
import { kadroviWidgeta, type PodaciWidgeta, type SatWidgeta } from '../logic/widget';

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
/** Isti ključ čita HavaWidget.java. */
const WIDGET = 'hava:widget';
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

interface SatPozadine extends SatModela, SatWidgeta {}

/** Jedan upit za oboje: obavijesti (12 h) i widget (24 h). */
function satiModela(p: { lat: number; lon: number }): Promise<SatPozadine[]> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}` +
    '&hourly=temperature_2m,precipitation,weather_code,wind_gusts_10m,is_day' +
    '&models=italia_meteo_arpae_icon_2i&forecast_hours=30&timeformat=unixtime&timezone=GMT';
  return json(url).then((j) => {
    type Niz = (number | null)[];
    const h = (
      j as {
        hourly?: { time?: number[]; temperature_2m?: Niz; precipitation?: Niz; weather_code?: Niz; wind_gusts_10m?: Niz; is_day?: Niz };
      }
    ).hourly;
    return (h?.time ?? []).map((t, i) => ({
      vrijeme: t * 1000,
      t: t * 1000,
      kisa: h?.precipitation?.[i] ?? 0,
      kisaMm: h?.precipitation?.[i] ?? 0,
      kisaVjer: 0,
      udari: h?.wind_gusts_10m?.[i] ?? 0,
      temp: h?.temperature_2m?.[i] ?? 0,
      kod: h?.weather_code?.[i] ?? 0,
      dan: (h?.is_day?.[i] ?? 1) === 1,
    }));
  });
}

/** Svježi kadrovi za widget; veš ostaje od aplikacije ako je za danas. */
function osvjeziWidget(p: Postavke, sati: SatPozadine[], sad: number): void {
  const staro = citaj<PodaciWidgeta>(WIDGET);
  const kadrovi = kadroviWidgeta(sati, sad);
  if (!kadrovi.length) return;
  const podaci: PodaciWidgeta = {
    mjesto: p.ime,
    izracunato: sad,
    kadrovi,
    ves: staro?.ves && staro.ves.datum === lokalno(sad).datum ? staro.ves : undefined,
  };
  CapacitorKV.set(WIDGET, JSON.stringify(podaci));
}

async function provjeri(): Promise<void> {
  const p = citaj<Postavke>(POSTAVKE);
  // Mjesto javi aplikacija; bez njega nema ni widgeta ni obavijesti.
  if (!p || typeof p.lat !== 'number') return;
  try {
    if (!CapacitorDevice.getNetworkStatus().connected) return;
  } catch {
    /* bez podatka o mreži: probaj svejedno */
  }
  const sad = Date.now();
  let sati: SatPozadine[] = [];
  try {
    sati = await satiModela(p);
    osvjeziWidget(p, sati, sad);
  } catch {
    /* sljedeći put */
  }
  if (!p.ukljuceno) return;

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
  if (!noc(sad) && sati.length) model.push(...obavijestiModela(sati, p.ime, sad));

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
