import type { SatVrha, Vrh } from '../logic/planina';

/*
 * Prognoza za vrh: Open-Meteo s visinom vrha (elevation), da temperatura bude za
 * vrh, a ne za prosjek mreže. Model ICON-2I (~2 km), kao ostatak aplikacije.
 */

const ADRESA = 'https://api.open-meteo.com/v1/forecast';
const PAMTI_MS = 30 * 60 * 1000;
const pamtim = new Map<string, { kad: number; sati: SatVrha[] }>();

export async function dohvatiVrh(v: Vrh, signal?: AbortSignal): Promise<SatVrha[]> {
  const staro = pamtim.get(v.id);
  if (staro && Date.now() - staro.kad < PAMTI_MS) return staro.sati;
  const p = new URLSearchParams({
    latitude: String(v.lat),
    longitude: String(v.lon),
    elevation: String(v.visina),
    hourly: 'temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover_low',
    models: 'italia_meteo_arpae_icon_2i',
    timezone: 'auto',
    forecast_days: '2',
    wind_speed_unit: 'kmh',
  });
  const o = await fetch(`${ADRESA}?${p}`, { signal });
  if (!o.ok) throw new Error(`vrh ${o.status}`);
  type Niz = (number | null)[];
  const h = (
    (await o.json()) as {
      hourly?: {
        time: string[];
        temperature_2m: Niz;
        apparent_temperature: Niz;
        weather_code: Niz;
        precipitation: Niz;
        wind_speed_10m: Niz;
        wind_gusts_10m: Niz;
        cloud_cover_low: Niz;
      };
    }
  ).hourly;
  if (!h) throw new Error('vrh: nema podataka');
  const sati: SatVrha[] = h.time.map((t, i) => ({
    vrijeme: t,
    datum: t.slice(0, 10),
    sat: Number(t.slice(11, 13)),
    temp: h.temperature_2m[i] ?? 0,
    osjecaj: h.apparent_temperature[i] ?? h.temperature_2m[i] ?? 0,
    kod: h.weather_code[i] ?? 0,
    kisaMm: h.precipitation[i] ?? 0,
    vjetar: h.wind_speed_10m[i] ?? 0,
    udari: h.wind_gusts_10m[i] ?? 0,
    nisko: h.cloud_cover_low[i] ?? 0,
  }));
  pamtim.set(v.id, { kad: Date.now(), sati });
  return sati;
}
