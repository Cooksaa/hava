import type { Zrak } from '../logic/zrak';
import type { Mjesto } from '../tipovi';

/*
 * Kvalitet zraka: Open-Meteo Air Quality API (CAMS Evropa, ~11 km), besplatno, bez ključa,
 * CC BY 4.0. Model se računa par puta dnevno, pa se ne traži češće od jednom na sat.
 */

const ADRESA = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const VRIJEDI_MS = 60 * 60 * 1000;

let zadnje: { kljuc: string; kad: number; zrak: Zrak } | null = null;

export async function dohvatiZrak(m: Mjesto, signal?: AbortSignal): Promise<Zrak | null> {
  const kljuc = `${m.lat.toFixed(2)},${m.lon.toFixed(2)}`;
  if (zadnje && zadnje.kljuc === kljuc && Date.now() - zadnje.kad < VRIJEDI_MS) return zadnje.zrak;

  const p = new URLSearchParams({
    latitude: m.lat.toFixed(4),
    longitude: m.lon.toFixed(4),
    hourly: 'european_aqi,pm2_5,pm10',
    timezone: 'auto',
    forecast_days: '2',
  });
  try {
    const r = await fetch(`${ADRESA}?${p}`, { signal });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      hourly?: { time: string[]; european_aqi: (number | null)[]; pm2_5: (number | null)[]; pm10: (number | null)[] };
    };
    const h = j.hourly;
    if (!h?.time) return null;
    const zrak: Zrak = { sati: h.time, aqi: h.european_aqi, pm25: h.pm2_5, pm10: h.pm10 };
    zadnje = { kljuc, kad: Date.now(), zrak };
    return zrak;
  } catch {
    // Zrak je dodatak: bez njega ostaje prognoza.
    return null;
  }
}
