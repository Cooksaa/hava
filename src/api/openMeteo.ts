import type { Dan, Prognoza, Sat } from '../tipovi';

/*
 * Open-Meteo: besplatno, bez ključa, CC BY 4.0 (izvor mora biti naveden u aplikaciji).
 * Besplatno je samo za nekomercijalnu upotrebu.
 *
 * Ovo je jedino mjesto koje zna kako izgleda njihov odgovor.
 */

const ADRESA = 'https://api.open-meteo.com/v1/forecast';

const SADA = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'is_day',
  'wind_speed_10m',
  'wind_gusts_10m',
].join(',');

const PO_SATIMA = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'is_day',
].join(',');

const PO_DANIMA = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'precipitation_sum',
  'wind_speed_10m_max',
  'sunrise',
  'sunset',
].join(',');

type Niz = (number | null)[];

/** Dio Open-Meteo odgovora koji koristimo. */
export interface OmOdgovor {
  utc_offset_seconds: number;
  current: {
    time: string;
    temperature_2m: number | null;
    relative_humidity_2m: number | null;
    apparent_temperature: number | null;
    precipitation: number | null;
    weather_code: number | null;
    is_day: number | null;
    wind_speed_10m: number | null;
    wind_gusts_10m: number | null;
  };
  hourly: {
    time: string[];
    temperature_2m: Niz;
    relative_humidity_2m: Niz;
    precipitation_probability: Niz;
    precipitation: Niz;
    weather_code: Niz;
    cloud_cover: Niz;
    wind_speed_10m: Niz;
    wind_gusts_10m: Niz;
    is_day: Niz;
  };
  daily: {
    time: string[];
    weather_code: Niz;
    temperature_2m_max: Niz;
    temperature_2m_min: Niz;
    precipitation_probability_max: Niz;
    precipitation_sum: Niz;
    wind_speed_10m_max: Niz;
    sunrise: string[];
    sunset: string[];
  };
}

export class GreskaPrognoze extends Error {
  constructor(
    poruka: string,
    /** "mreza": nema veze. "server": Open-Meteo je odgovorio greškom. */
    readonly vrsta: 'mreza' | 'server',
  ) {
    super(poruka);
    this.name = 'GreskaPrognoze';
  }
}

const broj = (niz: Niz, i: number): number => niz[i] ?? 0;

/** Open-Meteo odgovor → naš oblik. Rupe u podacima (null) postaju 0. */
export function uPrognozu(o: OmOdgovor): Prognoza {
  const h = o.hourly;
  const sati: Sat[] = h.time.map((vrijeme, i) => ({
    vrijeme,
    datum: vrijeme.slice(0, 10),
    sat: Number(vrijeme.slice(11, 13)),
    temp: broj(h.temperature_2m, i),
    vlaga: broj(h.relative_humidity_2m, i),
    kisaVjer: broj(h.precipitation_probability, i),
    kisaMm: broj(h.precipitation, i),
    kod: broj(h.weather_code, i),
    oblaci: broj(h.cloud_cover, i),
    vjetar: broj(h.wind_speed_10m, i),
    udari: broj(h.wind_gusts_10m, i),
    dan: broj(h.is_day, i) === 1,
  }));

  const d = o.daily;
  const dani: Dan[] = d.time.map((datum, i) => ({
    datum,
    kod: broj(d.weather_code, i),
    tMax: broj(d.temperature_2m_max, i),
    tMin: broj(d.temperature_2m_min, i),
    kisaVjerMax: broj(d.precipitation_probability_max, i),
    kisaMm: broj(d.precipitation_sum, i),
    vjetarMax: broj(d.wind_speed_10m_max, i),
    izlazak: d.sunrise[i] ?? `${datum}T06:00`,
    zalazak: d.sunset[i] ?? `${datum}T18:00`,
  }));

  const c = o.current;
  return {
    pomakSek: o.utc_offset_seconds ?? 0,
    sada: {
      vrijeme: c.time,
      temp: c.temperature_2m ?? 0,
      osjecaj: c.apparent_temperature ?? c.temperature_2m ?? 0,
      vlaga: c.relative_humidity_2m ?? 0,
      kisaMm: c.precipitation ?? 0,
      kod: c.weather_code ?? 0,
      dan: c.is_day === 1,
      vjetar: c.wind_speed_10m ?? 0,
      udari: c.wind_gusts_10m ?? 0,
    },
    sati,
    dani,
  };
}

interface Koordinate {
  lat: number;
  lon: number;
}

function adresa(mjesta: Koordinate[], dana: number): string {
  const p = new URLSearchParams({
    latitude: mjesta.map((m) => m.lat.toFixed(4)).join(','),
    longitude: mjesta.map((m) => m.lon.toFixed(4)).join(','),
    // "auto" daje lokalno vrijeme mjesta, pa pretraga radi i van BiH.
    timezone: 'auto',
    forecast_days: String(dana),
    wind_speed_unit: 'kmh',
    current: SADA,
    hourly: PO_SATIMA,
    daily: PO_DANIMA,
  });
  return `${ADRESA}?${p}`;
}

async function dohvati(url: string, signal?: AbortSignal): Promise<unknown> {
  let odgovor: Response;
  try {
    odgovor = await fetch(url, { signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new GreskaPrognoze('Nema veze s internetom.', 'mreza');
  }
  if (!odgovor.ok) throw new GreskaPrognoze(`Open-Meteo: ${odgovor.status}`, 'server');
  return odgovor.json();
}

/** Prognoza za jedno mjesto, 7 dana. */
export async function dohvatiPrognozu(mjesto: Koordinate, signal?: AbortSignal): Promise<Prognoza> {
  return uPrognozu((await dohvati(adresa([mjesto], 7), signal)) as OmOdgovor);
}

/** Više mjesta u jednom zahtjevu ("Pada li u…?"). Dva dana su dovoljna za narednih 12 sati. */
export async function dohvatiPrognoze(mjesta: Koordinate[], signal?: AbortSignal): Promise<Prognoza[]> {
  const odgovor = await dohvati(adresa(mjesta, 2), signal);
  // Za jedno mjesto stiže objekt, za više niz.
  const lista = (Array.isArray(odgovor) ? odgovor : [odgovor]) as OmOdgovor[];
  return lista.map(uPrognozu);
}
