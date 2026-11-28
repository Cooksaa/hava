// Playwright: Hava s podmetnutom prognozom za slike stranice i video.
// Pravi podaci s Open-Meteo, ali sati se prepišu po scenariju (page.__scen). Aplikacija se ne mijenja.
// page.__scen = { d0: '2026-11-27', sad: '07:40', kisaOd: 15, kisaDo: 19, toplije: 5, vjetar: 9, udari: 16, visina: [13, 16] }
async (page) => {
  const S = (page.__scen = { d0: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sarajevo' }), sad: '07:40', kisaOd: 15, kisaDo: 19, toplije: 5, vjetar: 9, udari: 16, visina: [13, 16], ...(page.__scen || {}) });
  const dan = (date, h, vrh) => {
    const danas = date === S.d0;
    const kisa = danas && S.kisaOd != null && h >= S.kisaOd && h <= S.kisaDo;
    let t = danas ? (h < 7 ? 6 : h <= 14 ? 6 + (h - 7) * 1.8 : 18.6 - (h - 14) * 1.2) : h < 7 ? 4 : h <= 14 ? 4 + (h - 7) * 1.6 : 15 - (h - 14) * 1.1;
    t += S.toplije;
    if (vrh) t -= 11;
    const kod = kisa ? 61 : danas ? (S.kisaOd != null && h >= S.kisaOd - 3 ? 3 : h >= 10 ? 2 : h >= 7 ? 1 : 0) : h >= 7 && h < 16 ? 1 : 0;
    return {
      temperature_2m: +t.toFixed(1), apparent_temperature: +(t - 1.5).toFixed(1), relative_humidity_2m: kisa ? 88 : 50,
      precipitation: kisa ? 1.6 : 0, rain: kisa ? 1.6 : 0, showers: 0, snowfall: 0,
      precipitation_probability: kisa ? 85 : danas && S.kisaOd != null && h >= S.kisaOd - 2 ? 35 : 5,
      weather_code: kod, cloud_cover: kod >= 3 ? 95 : kod === 2 ? 45 : kod === 1 ? 15 : 5, cloud_cover_low: kisa ? 85 : kod >= 3 ? 50 : 5,
      wind_speed_10m: vrh ? 14 : S.vjetar, wind_gusts_10m: vrh ? 22 : S.udari, wind_direction_10m: 320,
      wind_speed_80m: S.visina[0], wind_speed_120m: S.visina[1], is_day: h >= 7 && h < 16 ? 1 : 0, visibility: 30000,
    };
  };
  const baza = (k) => k.replace(/_(italia_meteo_arpae_icon_2i|best_match|icon_seamless)$/, '');
  // Vrijeme zna doći i kao unix sekunde (timeformat=unixtime): pretvori u lokalno "YYYY-MM-DDTHH:MM".
  const lok = (x, o) => (typeof x === 'number' ? new Date((x + (o.utc_offset_seconds || 0)) * 1000).toISOString().slice(0, 16) : x);
  const preradi = (o, vrh) => {
    if (o.hourly?.time) {
      const tm = o.hourly.time.map((x) => lok(x, o));
      for (const k of Object.keys(o.hourly)) {
        if (k === 'time') continue;
        o.hourly[k] = o.hourly[k].map((v, i) => dan(tm[i].slice(0, 10), +tm[i].slice(11, 13), vrh)[baza(k)] ?? v);
      }
    }
    if (o.current) {
      if (typeof o.current.time === 'number') o.current.time = Math.floor(new Date(`${S.d0}T${S.sad}:00+01:00`).getTime() / 900000) * 900;
      else o.current.time = `${S.d0}T${S.sad.slice(0, 4)}0`;
      const s = dan(S.d0, +S.sad.slice(0, 2), vrh);
      for (const k of Object.keys(o.current)) if (k !== 'time' && k !== 'interval' && s[baza(k)] !== undefined) o.current[k] = s[baza(k)];
    }
    if (o.daily?.time) {
      for (const k of Object.keys(o.daily)) {
        if (k === 'time' || /sunrise|sunset|daylight|sunshine|uv/.test(k)) continue;
        o.daily[k] = o.daily[k].map((v, i) => {
          const sati = [...Array(24).keys()].map((h) => dan(lok(o.daily.time[i], o).slice(0, 10), h, vrh));
          const mx = (f) => Math.max(...sati.map((s) => s[f]));
          const mn = (f) => Math.min(...sati.map((s) => s[f]));
          const sum = (f) => +sati.reduce((a, s) => a + s[f], 0).toFixed(1);
          return {
            weather_code: mx('weather_code'), temperature_2m_max: mx('temperature_2m'), temperature_2m_min: mn('temperature_2m'),
            apparent_temperature_max: mx('apparent_temperature'), apparent_temperature_min: mn('apparent_temperature'),
            precipitation_sum: sum('precipitation'), rain_sum: sum('precipitation'),
            precipitation_hours: sati.filter((s) => s.precipitation > 0).length,
            precipitation_probability_max: mx('precipitation_probability'),
            wind_speed_10m_max: mx('wind_speed_10m'), wind_gusts_10m_max: mx('wind_gusts_10m'),
          }[baza(k)] ?? v;
        });
      }
    }
  };
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route('https://api.open-meteo.com/v1/forecast**', async (route) => {
    const res = await route.fetch();
    const j = await res.json();
    const vrh = route.request().url().includes('elevation=');
    for (const o of Array.isArray(j) ? j : [j]) preradi(o, vrh);
    await route.fulfill({ response: res, json: j });
  });
  if (S.praviSat) {
    // bez namještenog sata (npr. mapa s pravim radarom)
  } else if (!page.__sat) {
    await page.clock.install({ time: new Date(`${S.d0}T${S.sad}:00+01:00`) });
    page.__sat = true;
  } else {
    await page.clock.setSystemTime(new Date(`${S.d0}T${S.sad}:00+01:00`));
  }
  await page.goto(S.url || 'http://localhost:5173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(S.cekaj ?? 6000);
  return 'ok';
}
