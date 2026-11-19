import type { Dan, Prognoza, Sat } from '../tipovi';

/*
 * Open-Meteo: besplatno, bez ključa, CC BY 4.0 (izvor mora biti naveden u aplikaciji).
 * Besplatno je samo za nekomercijalnu upotrebu.
 *
 * Ovo je jedino mjesto koje zna kako izgleda njihov odgovor.
 */

const ADRESA = 'https://api.open-meteo.com/v1/forecast';

/*
 * Modeli. ICON-2I (talijanska meteorološka služba, mreža od 2 km) pokriva BiH i okolinu
 * oko 3,5 dana unaprijed. U poređenju sa stanicama (scripts/verifikacija.mjs, novembar
 * 2026) griješio je u temperaturi ~17% manje od "best_match", a lažne kiše je bilo upola
 * manje. Gdje ICON-2I nema podatak (dalji dani, mjesto van njegove mape), ide best_match.
 */
const GLAVNI = 'italia_meteo_arpae_icon_2i';
const REZERVA = 'best_match';

const SADA = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'is_day',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
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
  'wind_direction_10m',
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

/** Dio Open-Meteo odgovora koji koristimo (poslije spajanja modela). */
export interface OmOdgovor {
  utc_offset_seconds: number;
  elevation?: number;
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
    wind_direction_10m?: number | null;
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
    wind_direction_10m?: Niz;
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

/** Odgovor kako stiže: kolone s nastavkom po modelu, ili bez njega ako je ostao samo jedan. */
export type OmSirovo = Record<string, unknown> & {
  current: OmOdgovor['current'];
  hourly: Record<string, unknown[]>;
  daily: Record<string, unknown[]>;
};

/**
 * ICON-2I nema vjerovatnoću kiše. Uzima se ona iz best_match (ansambl), ali odluku
 * donosi ICON-2I: suh sat najviše 30%, mokar najmanje 60% (pragovi aplikacije su 35–40%).
 * Mjerenja su pokazala da miješanje količina dva modela samo kvari pogodak.
 */
const SUHO_NAJVISE = 30;
const MOKRO_NAJMANJE = 60;
const MOKRO_MM = 0.1;

function kolona(dio: Record<string, unknown[]>, ime: string, model: string): unknown[] | undefined {
  return dio[`${ime}_${model}`] ?? (model === REZERVA ? dio[ime] : undefined);
}

function spojiDio(dio: Record<string, unknown[]>, imena: string[]): Record<string, unknown[]> {
  const vrijeme = dio.time ?? [];
  const izlaz: Record<string, unknown[]> = { time: vrijeme };
  for (const ime of imena) {
    const glavni = kolona(dio, ime, GLAVNI);
    const rezerva = kolona(dio, ime, REZERVA);
    izlaz[ime] = vrijeme.map((_, i) => glavni?.[i] ?? rezerva?.[i] ?? null);
  }
  return izlaz;
}

/** Dva modela u jedan odgovor: ICON-2I gdje ga ima, inače best_match. */
export function spojiModele(o: OmSirovo): OmOdgovor {
  const hourly = spojiDio(o.hourly, PO_SATIMA.split(','));
  const daily = spojiDio(o.daily, PO_DANIMA.split(','));

  const mmGlavni = kolona(o.hourly, 'precipitation', GLAVNI) as Niz | undefined;
  if (mmGlavni) {
    const vjer = (hourly.precipitation_probability as Niz).map((v, i) => {
      const mm = mmGlavni[i];
      if (mm == null) return v;
      return mm >= MOKRO_MM ? Math.max(v ?? 0, MOKRO_NAJMANJE) : Math.min(v ?? 0, SUHO_NAJVISE);
    });
    hourly.precipitation_probability = vjer;
    // Dnevni maksimum iz satnih, za dane koje ICON-2I pokriva cijele.
    const sumaGlavni = kolona(o.daily, 'precipitation_sum', GLAVNI) as Niz | undefined;
    const satiVrijeme = hourly.time as string[];
    const stari = daily.precipitation_probability_max as Niz;
    daily.precipitation_probability_max = (daily.time as string[]).map((datum, d) => {
      if (sumaGlavni?.[d] == null) return stari[d] ?? null;
      let max = 0;
      satiVrijeme.forEach((t, i) => {
        if (t.startsWith(datum)) max = Math.max(max, vjer[i] ?? 0);
      });
      return max;
    });
  }

  return {
    utc_offset_seconds: (o.utc_offset_seconds as number) ?? 0,
    elevation: o.elevation as number | undefined,
    current: o.current,
    hourly: hourly as unknown as OmOdgovor['hourly'],
    daily: daily as unknown as OmOdgovor['daily'],
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

/** Smjer nema smislenu nulu (0 = sjever), pa rupa ostaje rupa. */
function smjerSata(niz: Niz | undefined, i: number): { smjer?: number } {
  const v = niz?.[i];
  return typeof v === 'number' ? { smjer: v } : {};
}

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
    ...smjerSata(h.wind_direction_10m, i),
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
    ...(typeof o.elevation === 'number' ? { visina: o.elevation } : {}),
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
      ...(typeof c.wind_direction_10m === 'number' ? { smjer: c.wind_direction_10m } : {}),
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
    // Prvi model daje i "sada" (current).
    models: `${GLAVNI},${REZERVA}`,
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
  return uPrognozu(spojiModele((await dohvati(adresa([mjesto], 7), signal)) as OmSirovo));
}

/** Više mjesta u jednom zahtjevu ("Pada li u…?"). Dva dana su dovoljna za narednih 12 sati. */
export async function dohvatiPrognoze(mjesta: Koordinate[], signal?: AbortSignal): Promise<Prognoza[]> {
  const odgovor = await dohvati(adresa(mjesta, 2), signal);
  // Za jedno mjesto stiže objekt, za više niz.
  const lista = (Array.isArray(odgovor) ? odgovor : [odgovor]) as OmSirovo[];
  return lista.map((o) => uPrognozu(spojiModele(o)));
}
