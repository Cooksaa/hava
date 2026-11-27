import { dohvatiPrognozu } from '../src/api/openMeteo';
import { dohvatiVrh } from '../src/api/planina';
import { dohvatiVisine } from '../src/api/visina';
import { dohvatiZrak } from '../src/api/zrak';
import { modelPoId } from '../src/logic/dron';
import { mjestoPitanja, odgovori, PRIMJERI } from '../src/logic/odgovor';
import { prepoznaj } from '../src/logic/pitanja';
import { regijaZa, upozorenjaZa, type MaZapis } from '../src/logic/upozorenja';
import { MJESTA } from '../src/mjesta';
import type { Mjesto } from '../src/tipovi';

/*
 * Hava server: odgovor na pitanje kao JSON, za asistente (Ostrvo, kasnije glas na telefonu).
 *
 *   GET /api/pitaj?q=Mogu li danas dići dron&mjesto=Čapljina
 *   GET /api/pitaj?q=Pada li&lat=43.12&lon=17.68&ime=Kuća
 *   → { odgovor, tema, kada, mjesto: { ime, lat, lon }, izvor }
 *
 * Mjesto: pomenuto u pitanju, inače `mjesto` (ime iz liste) ili `lat`/`lon`.
 * `dron`: id modela (kao u aplikaciji), npr. "air-3" ili "drugi:8".
 * Logika je ista kao u aplikaciji (src/logic/odgovor.ts); radar ovdje nema (traži
 * dekodiranje slika), pa je kiša iz modela. Odgovori se keširaju 5 min na Vercelovom CDN-u.
 * Ništa se ne pamti o onome ko pita.
 */

const UPOZORENJA = 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-bosnia-herzegovina';
const ZAGLAVLJA = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const PRVO: Mjesto = { ime: MJESTA[0]!.ime, lat: MJESTA[0]!.lat, lon: MJESTA[0]!.lon };

let zapisi: { kad: number; lista: MaZapis[] } | null = null;

async function upozorenjaFeed(): Promise<MaZapis[]> {
  if (zapisi && Date.now() - zapisi.kad < 10 * 60_000) return zapisi.lista;
  const r = await fetch(UPOZORENJA, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`MeteoAlarm ${r.status}`);
  const j = (await r.json()) as { warnings?: MaZapis[] };
  zapisi = { kad: Date.now(), lista: j.warnings ?? [] };
  return zapisi.lista;
}

const bezKvacica = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj');

/** Mjesto iz upita, ili null. */
function mjestoIzUpita(u: URLSearchParams): Mjesto | null {
  const ime = u.get('mjesto');
  if (ime) {
    const m = MJESTA.find((x) => bezKvacica(x.ime) === bezKvacica(ime));
    if (m) return { ime: m.ime, lat: m.lat, lon: m.lon, bih: m.drzava === 'Bosna i Hercegovina' };
  }
  const lat = Number(u.get('lat'));
  const lon = Number(u.get('lon'));
  if (u.has('lat') && u.has('lon') && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { ime: (u.get('ime') ?? '').slice(0, 40) || 'tvoje mjesto', lat, lon };
  }
  return null;
}

function json(tijelo: unknown, status = 200, kes = true): Response {
  return new Response(JSON.stringify(tijelo), {
    status,
    headers: {
      ...ZAGLAVLJA,
      'Cache-Control': kes ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' : 'no-store',
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ZAGLAVLJA });
    if (request.method !== 'GET') return json({ greska: 'Samo GET.' }, 405, false);

    const u = new URL(request.url).searchParams;
    const q = (u.get('q') ?? '').trim().slice(0, 300);
    if (!q) return json({ greska: 'Fali pitanje (?q=…).', primjer: PRIMJERI }, 400, false);

    const p = prepoznaj(q);
    const izUpita = mjestoIzUpita(u);
    if (!p.mjesto && !izUpita && p.tema) {
      return json({ odgovor: 'Za koje mjesto? Npr. „Pada li u Mostaru?“', tema: p.tema, kada: p.kada, mjesto: null });
    }
    // Bez ikakvog mjesta ostaje samo nepoznato pitanje ("nisam razumio"), pa je svejedno koje.
    const podrazumijevano = izUpita ?? PRVO;
    const { mjesto } = mjestoPitanja(p, podrazumijevano);

    const odgovor = await odgovori(p, {
      mjesto: podrazumijevano,
      prognoza: null,
      model: modelPoId(u.get('dron')),
      dohvatiPrognozu: (m) => dohvatiPrognozu(m, AbortSignal.timeout(8000)),
      kisaSad: async () => null,
      visine: (m) => dohvatiVisine(m, AbortSignal.timeout(8000)),
      zrak: (m) => dohvatiZrak(m, AbortSignal.timeout(8000)),
      vrh: (v) => dohvatiVrh(v, AbortSignal.timeout(8000)),
      async upozorenja(m, sad) {
        if (m.bih === false) return [];
        const regija = regijaZa(m.lat, m.lon);
        return regija ? upozorenjaZa(await upozorenjaFeed(), regija, sad) : [];
      },
    });

    // Greška mreže ne smije ostati u kešu 5 minuta.
    const kes = !odgovor.startsWith('Ne mogu doći');
    return json(
      {
        odgovor,
        tema: p.tema,
        kada: p.kada,
        mjesto: { ime: mjesto.ime, lat: mjesto.lat, lon: mjesto.lon },
        izvor: 'Open-Meteo, MeteoAlarm (FHMZ, RHMZ RS)',
      },
      200,
      kes,
    );
  },
};
