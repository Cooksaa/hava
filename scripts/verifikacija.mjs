// Koliko koji model prognoze pogađa kod nas.
//
// Poredi prognozu napravljenu DAN RANIJE (Open-Meteo Previous Runs API) s onim što su
// izmjerile aerodromske stanice (METAR, aviationweather.gov), za zadnjih ~14 dana.
// Ispiše tabelu; u GitHub Actions je stavi i u sažetak pokretanja.
//
//   node scripts/verifikacija.mjs [dana=14]

import { appendFileSync } from 'node:fs';

const STANICE = [
  { id: 'LQMO', ime: 'Mostar' },
  { id: 'LQSA', ime: 'Sarajevo' },
  { id: 'LQBK', ime: 'Banja Luka' },
  { id: 'LQTZ', ime: 'Tuzla' },
  { id: 'LDDU', ime: 'Dubrovnik (za Neum)' },
];

const MODELI = [
  'best_match',
  'icon_seamless',
  'ecmwf_ifs',
  'italia_meteo_arpae_icon_2i',
  'meteofrance_seamless',
  'ukmo_seamless',
  'gfs_seamless',
];

const ZAGLAVLJE =
  '| Model | Temp. greška °C | Vjetar greška km/h | Kiša tačno | Kiša pogođena (CSI) | Propuštena kiša (sati) | Lažna kiša (sati) | Sati |\n|---|---|---|---|---|---|---|---|';

const DANA = Number(process.argv[2] ?? 14);
const SAT_MS = 3600e3;
// Ovo se u METAR-u računa kao padavine (bez "VC": u blizini, ne na stanici).
const PADAVINE = /(^|\s)[-+]?(TS|SH)?(RA|DZ|SN|SG|PL|GR|GS)/;

async function json(url) {
  for (let pokusaj = 0; pokusaj < 3; pokusaj++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'hava-verifikacija' } });
    if (r.ok) return r.json();
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`Ne odgovara: ${url}`);
}

/** Mjerenja po satu (ključ: ms UTC punog sata). API vraća najviše 400 zapisa, pa idemo po 7 dana. */
async function mjerenja(id) {
  const po = new Map();
  for (let kraj = Date.now(); kraj > Date.now() - DANA * 24 * SAT_MS; kraj -= 7 * 24 * SAT_MS) {
    const datum = new Date(kraj).toISOString().slice(0, 19) + 'Z';
    const zapisi = await json(
      `https://aviationweather.gov/api/data/metar?ids=${id}&format=json&hours=168&date=${datum}`,
    );
    for (const z of zapisi) {
      const t = new Date(z.reportTime).getTime();
      // Samo izvještaji na pun sat (neke stanice šalju i u :30).
      if (t % SAT_MS !== 0 || typeof z.temp !== 'number') continue;
      po.set(t, {
        temp: z.temp,
        vjetar: typeof z.wspd === 'number' ? z.wspd * 1.852 : null,
        pada: PADAVINE.test(z.wxString ?? ''),
        lat: z.lat,
        lon: z.lon,
      });
    }
  }
  return po;
}

/** Prognoza od jučer za svaki sat, po modelu. */
async function prognoze(lat, lon) {
  const varijable = ['temperature_2m', 'precipitation', 'wind_speed_10m'].map((v) => `${v}_previous_day1`);
  const url =
    `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=${varijable.join(',')}&past_days=${DANA}&forecast_days=1&timezone=GMT` +
    `&models=${MODELI.join(',')}`;
  const p = await json(url);
  const sati = p.hourly.time.map((t) => new Date(`${t}:00Z`).getTime());
  const po = {};
  for (const m of MODELI) {
    const dio = (v) => p.hourly[`${v}_previous_day1_${m}`] ?? p.hourly[`${v}_previous_day1`];
    const temp = dio('temperature_2m');
    if (!temp) continue;
    const kisa = dio('precipitation');
    const vjetar = dio('wind_speed_10m');
    po[m] = new Map(sati.map((t, i) => [t, { temp: temp[i], kisa: kisa?.[i], vjetar: vjetar?.[i] }]));
  }
  return po;
}

function novaOcjena() {
  return { n: 0, tempGreska: 0, vjetarN: 0, vjetarGreska: 0, pogodak: 0, promasaj: 0, lazna: 0, tacnoNe: 0 };
}

function dodaj(o, mj, pr) {
  if (pr.temp == null) return;
  o.n++;
  o.tempGreska += Math.abs(pr.temp - mj.temp);
  if (mj.vjetar != null && pr.vjetar != null) {
    o.vjetarN++;
    o.vjetarGreska += Math.abs(pr.vjetar - mj.vjetar);
  }
  const prKisa = (pr.kisa ?? 0) >= 0.1;
  if (mj.pada && prKisa) o.pogodak++;
  else if (mj.pada) o.promasaj++;
  else if (prKisa) o.lazna++;
  else o.tacnoNe++;
}

function red(ime, o) {
  const kisaUkupno = o.pogodak + o.promasaj + o.lazna;
  // CSI: od svih sati kad je padalo ili je model rekao da pada, koliko je pogođeno.
  const csi = kisaUkupno ? Math.round((100 * o.pogodak) / kisaUkupno) : '-';
  const tacno = Math.round((100 * (o.pogodak + o.tacnoNe)) / o.n);
  return `| ${ime} | ${(o.tempGreska / o.n).toFixed(2)} | ${o.vjetarN ? (o.vjetarGreska / o.vjetarN).toFixed(1) : '-'} | ${tacno}% | ${csi}% | ${o.promasaj} | ${o.lazna} | ${o.n} |`;
}

const ukupno = Object.fromEntries(MODELI.map((m) => [m, novaOcjena()]));
const izvjestaj = [];

for (const s of STANICE) {
  const mj = await mjerenja(s.id);
  const prvo = mj.values().next().value;
  if (!prvo) continue;
  const pr = await prognoze(prvo.lat, prvo.lon);
  const ocjene = {};
  for (const m of Object.keys(pr)) {
    ocjene[m] = novaOcjena();
    for (const [t, mjerenje] of mj) {
      const p = pr[m].get(t);
      if (!p) continue;
      dodaj(ocjene[m], mjerenje, p);
      dodaj(ukupno[m], mjerenje, p);
    }
  }
  izvjestaj.push(`\n### ${s.ime} (${s.id}), ${mj.size} sati mjerenja\n`);
  izvjestaj.push(ZAGLAVLJE);
  for (const m of Object.keys(ocjene).sort((a, b) => ocjene[a].tempGreska / ocjene[a].n - ocjene[b].tempGreska / ocjene[b].n)) {
    izvjestaj.push(red(m, ocjene[m]));
  }
}


const svi = Object.keys(ukupno)
  .filter((m) => ukupno[m].n)
  .sort((a, b) => ukupno[a].tempGreska / ukupno[a].n - ukupno[b].tempGreska / ukupno[b].n);

const tekst = [
  `## Prognoza od jučer prema mjerenjima, zadnjih ${DANA} dana`,
  '',
  'Manja greška je bolja. CSI: od sati kad je padalo ili je model rekao da pada, koliko je pogođeno.',
  '',
  '### Sve stanice zajedno',
  '',
  ZAGLAVLJE,
  ...svi.map((m) => red(m, ukupno[m])),
  ...izvjestaj,
].join('\n');

console.log(tekst);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, tekst + '\n');
