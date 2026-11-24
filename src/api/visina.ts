import type { Visina } from '../logic/dron';
import type { Mjesto } from '../tipovi';

/*
 * Vjetar na 80 i 120 m, za dron. Glavni model (ICON-2I) ga nema, pa ga uzimamo iz
 * ICON-a (icon_seamless: ICON-D2/EU/global, ista porodica). Vremena su lokalna za
 * mjesto (timezone=auto), isti ključ kao Sat.vrijeme.
 */

const ADRESA = 'https://api.open-meteo.com/v1/forecast';
const PAMTI_MS = 60 * 60 * 1000;
const pamtim = new Map<string, { kad: number; v: Map<string, Visina> }>();

export async function dohvatiVisine(m: Mjesto, signal?: AbortSignal): Promise<Map<string, Visina> | null> {
  const kljuc = `${m.lat.toFixed(2)},${m.lon.toFixed(2)}`;
  const staro = pamtim.get(kljuc);
  if (staro && Date.now() - staro.kad < PAMTI_MS) return staro.v;
  const p = new URLSearchParams({
    latitude: m.lat.toFixed(4),
    longitude: m.lon.toFixed(4),
    hourly: 'wind_speed_80m,wind_speed_120m',
    models: 'icon_seamless',
    forecast_days: '2',
    timezone: 'auto',
    wind_speed_unit: 'kmh',
  });
  try {
    const o = await fetch(`${ADRESA}?${p}`, { signal });
    if (!o.ok) return null;
    const j = (await o.json()) as {
      hourly?: { time?: string[]; wind_speed_80m?: (number | null)[]; wind_speed_120m?: (number | null)[] };
    };
    const h = j.hourly;
    const v = new Map<string, Visina>();
    (h?.time ?? []).forEach((t, i) => {
      const v80 = h?.wind_speed_80m?.[i];
      const v120 = h?.wind_speed_120m?.[i];
      if (v80 != null && v120 != null) v.set(t, { v80, v120 });
    });
    pamtim.set(kljuc, { kad: Date.now(), v });
    return v;
  } catch {
    return null;
  }
}
