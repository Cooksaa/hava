import { describe, expect, it } from 'vitest';
import { procijeniKisu } from '../logic/kisa';
import { procijeniVes } from '../logic/ves';
import { uPrognozu, type OmOdgovor } from './openMeteo';

/** Skraćen stvarni odgovor: dva dana, s jednom rupom (null) u podacima. */
function odgovor(): OmOdgovor {
  const time: string[] = [];
  for (const datum of ['2026-11-16', '2026-11-17']) {
    for (let h = 0; h < 24; h++) time.push(`${datum}T${String(h).padStart(2, '0')}:00`);
  }
  const puni = (v: number): (number | null)[] => time.map(() => v);
  const vjerovatnoca = puni(10);
  vjerovatnoca[30] = null;

  return {
    utc_offset_seconds: 3600,
    current: {
      time: '2026-11-16T22:15',
      temperature_2m: 11.2,
      relative_humidity_2m: 98,
      apparent_temperature: 11.4,
      precipitation: 0,
      weather_code: 45,
      is_day: 0,
      wind_speed_10m: 0.7,
      wind_gusts_10m: 19.4,
    },
    hourly: {
      time,
      temperature_2m: puni(11),
      relative_humidity_2m: puni(95),
      precipitation_probability: vjerovatnoca,
      precipitation: puni(0),
      weather_code: puni(45),
      cloud_cover: puni(100),
      wind_speed_10m: puni(3),
      wind_gusts_10m: puni(12),
      is_day: time.map((t) => (Number(t.slice(11, 13)) >= 7 && Number(t.slice(11, 13)) < 16 ? 1 : 0)),
    },
    daily: {
      time: ['2026-11-16', '2026-11-17'],
      weather_code: [45, 3],
      temperature_2m_max: [14.1, 15.3],
      temperature_2m_min: [8.2, 7.9],
      precipitation_probability_max: [10, 20],
      precipitation_sum: [0, 0],
      wind_speed_10m_max: [6, 9],
      sunrise: ['2026-11-16T06:43', '2026-11-17T06:44'],
      sunset: ['2026-11-16T16:24', '2026-11-17T16:23'],
    },
  };
}

describe('Open-Meteo → Prognoza', () => {
  const p = uPrognozu(odgovor());

  it('sada', () => {
    expect(p.sada).toMatchObject({ vrijeme: '2026-11-16T22:15', temp: 11.2, kod: 45, dan: false, vlaga: 98 });
  });

  it('sati imaju datum i sat izvađen iz stringa', () => {
    expect(p.sati).toHaveLength(48);
    expect(p.sati[13]).toMatchObject({ datum: '2026-11-16', sat: 13, dan: true, vlaga: 95 });
    expect(p.sati[25]).toMatchObject({ datum: '2026-11-17', sat: 1, dan: false });
  });

  it('rupa u podacima postaje 0, ne NaN', () => {
    expect(p.sati[30]?.kisaVjer).toBe(0);
  });

  it('dani nose izlazak i zalazak', () => {
    expect(p.dani[0]).toMatchObject({ tMax: 14.1, tMin: 8.2, zalazak: '2026-11-16T16:24' });
  });

  it('logika radi nad pretvorenim odgovorom', () => {
    expect(procijeniVes(p)).toMatchObject({ nivo: 'nemoj', kod: 'vlaga', dan: 'sutra' });
    expect(procijeniKisu(p).kod).toBe('suho');
  });
});
