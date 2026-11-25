import { najblize, tackeNaRuti, uslov, type TackaPuta, type TackaRute, type VrijemeTacke } from '../logic/put';
import { MJESTA } from '../mjesta';
import type { Mjesto } from '../tipovi';

/*
 * Putujem: ruta i vrijeme duž nje.
 *
 * Ruta: OSRM (project-osrm.org), javni server, besplatan za malu upotrebu (1 upit
 * u sekundi). Za Google Play ide drugi servis (OpenRouteService ili GraphHopper).
 * Prognoza: Open-Meteo za sve tačke jednim upitom, model ICON-2I kao i ostalo.
 */

const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const PROGNOZA = 'https://api.open-meteo.com/v1/forecast';

export interface Ruta {
  /** [lon, lat] */
  linija: [number, number][];
  km: number;
  min: number;
  tacke: TackaRute[];
}

const rute = new Map<string, Ruta>();

export async function dohvatiRutu(od: Mjesto, do_: Mjesto, signal?: AbortSignal): Promise<Ruta> {
  const kljuc = `${od.lat.toFixed(3)},${od.lon.toFixed(3)}>${do_.lat.toFixed(3)},${do_.lon.toFixed(3)}`;
  const staro = rute.get(kljuc);
  if (staro) return staro;
  const url = `${OSRM}/${od.lon},${od.lat};${do_.lon},${do_.lat}?overview=full&geometries=geojson&annotations=duration`;
  const o = await fetch(url, { signal });
  if (!o.ok) throw new Error(`ruta ${o.status}`);
  const j = (await o.json()) as {
    code?: string;
    routes?: {
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
      legs: { annotation?: { duration?: number[] } }[];
    }[];
  };
  const r = j.routes?.[0];
  if (j.code !== 'Ok' || !r) throw new Error('nema rute');
  const trajanja = r.legs.flatMap((l) => l.annotation?.duration ?? []);
  // Pojednostavljena linija za mapu (svaka 5. tačka), ali tačke za prognozu iz pune.
  const linija = r.geometry.coordinates.filter((_, i, a) => i % 5 === 0 || i === a.length - 1);
  const ruta: Ruta = {
    linija,
    km: r.distance / 1000,
    min: r.duration / 60,
    tacke: tackeNaRuti(r.geometry.coordinates, trajanja),
  };
  rute.set(kljuc, ruta);
  return ruta;
}

/** Prognoza za svaku tačku u satu kad si tu. */
export async function vrijemeNaRuti(ruta: Ruta, polazak: number, signal?: AbortSignal): Promise<TackaPuta[]> {
  const t = ruta.tacke;
  const p = new URLSearchParams({
    latitude: t.map((x) => x.lat.toFixed(3)).join(','),
    longitude: t.map((x) => x.lon.toFixed(3)).join(','),
    hourly: 'temperature_2m,precipitation,weather_code,wind_gusts_10m',
    models: 'italia_meteo_arpae_icon_2i',
    forecast_days: '3',
    timeformat: 'unixtime',
    timezone: 'GMT',
    wind_speed_unit: 'kmh',
  });
  const o = await fetch(`${PROGNOZA}?${p}`, { signal });
  if (!o.ok) throw new Error(`prognoza ${o.status}`);
  const j = (await o.json()) as unknown;
  type H = {
    hourly?: {
      time: number[];
      temperature_2m: (number | null)[];
      precipitation: (number | null)[];
      weather_code: (number | null)[];
      wind_gusts_10m: (number | null)[];
    };
  };
  const lista = (Array.isArray(j) ? j : [j]) as H[];

  return t.map((x, i) => {
    const kad = polazak + x.min * 60_000;
    const h = lista[i]?.hourly;
    const sat = Math.floor(kad / 3600e3) * 3600;
    const k = Math.max(0, h?.time.indexOf(sat) ?? -1);
    const v: VrijemeTacke = {
      temp: h?.temperature_2m[k] ?? 10,
      kisa: h?.precipitation[k] ?? 0,
      kod: h?.weather_code[k] ?? 0,
      udari: h?.wind_gusts_10m[k] ?? 0,
    };
    const m = najblize(x.lat, x.lon, MJESTA, 20);
    return { ...x, kad, v, uslov: uslov(v), ime: m?.ime ?? null, genitiv: m?.genitiv ?? null };
  });
}
