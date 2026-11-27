import { dohvatiPrognozu } from '../api/openMeteo';
import { dohvatiVrh } from '../api/planina';
import { dohvatiRadar, type Radar } from '../api/radar';
import { dohvatiZrak } from '../api/zrak';
import { prskanje, rostilj } from '../logic/aktivnosti';
import type { Visina } from '../logic/dron';
import { procijeniKisu } from '../logic/kisa';
import { LOKATIV, type Pitanje } from '../logic/pitanja';
import { najbliziVrh, presudaVrha } from '../logic/planina';
import { kadRecenica, nivoIme, type Upozorenje } from '../logic/upozorenja';
import { procijeniVes } from '../logic/ves';
import { jadranskiKraj, vjetarRecenica } from '../logic/vjetar';
import { zrakSad, type Zrak } from '../logic/zrak';
import { MJESTA } from '../mjesta';
import { kisaRecenica, stepeni, vesRecenica } from '../tekst';
import type { Mjesto, Prognoza } from '../tipovi';
import { dronZaPrikaz } from './dron';
import { kisaZaPrikaz } from './kisaSad';

/*
 * Odgovor na pitanje (logic/pitanja.ts) jednom rečenicom, od istih rečenica koje
 * aplikacija pokazuje na ekranu. Za drugo mjesto se prognoza dohvati posebno.
 */

export interface KontekstPitanja {
  mjesto: Mjesto;
  prognoza: Prognoza | null;
  radar: Radar | null;
  visine: Map<string, Visina> | null;
  zrak: Zrak | null;
  upozorenja(m: Mjesto, sad: number): Upozorenje[];
}

export const PRIMJERI = 'Pitaj npr. „Mogu li danas dići dron?“, „Pada li u Čapljini?“ ili „Kad da palim mašinu?“';

const malo = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

export async function odgovori(p: Pitanje, k: KontekstPitanja, sad = Date.now()): Promise<string> {
  if (!p.tema) return `Nisam razumio pitanje. ${PRIMJERI}`;

  // Mjesto: pomenuto u pitanju, inače ono koje je otvoreno u aplikaciji.
  const poznato = p.mjesto ? MJESTA.find((m) => m.ime === p.mjesto) : null;
  const isto = !poznato || (poznato.lat === k.mjesto.lat && poznato.lon === k.mjesto.lon) || poznato.ime === k.mjesto.ime;
  const m: Mjesto = isto ? k.mjesto : { ime: poznato!.ime, lat: poznato!.lat, lon: poznato!.lon, bih: poznato!.drzava === 'Bosna i Hercegovina' };
  const lok = LOKATIV[m.ime];
  const u = lok ? `U ${lok}` : `Za ${m.ime}`;
  const uMalo = lok ? `u ${lok}` : `za ${m.ime}`;

  let pr: Prognoza | null = isto ? k.prognoza : null;
  if (!pr) {
    try {
      pr = await dohvatiPrognozu(m);
    } catch {
      return 'Ne mogu doći do prognoze. Provjeri internet.';
    }
  }
  const sutra = p.kada === 'sutra';

  switch (p.tema) {
    case 'kisa': {
      if (sutra) {
        const d = pr.dani[1];
        if (!d) break;
        return d.kisaVjerMax >= 40 || d.kisaMm >= 1
          ? `Sutra ${uMalo} kiša, oko ${Math.max(1, Math.round(d.kisaMm))} mm.`
          : `Sutra ${uMalo} suho.`;
      }
      // Radar zna bolje za naredna 2 sata.
      const radar = isto ? k.radar : await dohvatiRadar(m).catch(() => null);
      const r = kisaZaPrikaz(radar, sad);
      if (r && r.kisa.vrsta !== 'suho') return `${u}: ${malo(r.kisa.recenica)}`;
      return kisaRecenica({ ...m, lokativ: lok ?? m.ime }, procijeniKisu(pr));
    }
    case 'ves': {
      const g = vesRecenica(procijeniVes(pr)).glavno;
      return isto ? g : `${u}: ${malo(g)}`;
    }
    case 'dron': {
      const d = dronZaPrikaz(pr, isto ? k.visine : null);
      if (!d) return 'Nema prognoze za dron.';
      const g = isto ? d.presuda.glavno : `${u}: ${malo(d.presuda.glavno)}`;
      return `${g.replace(/.$/, '')} (${d.model.ime}).`;
    }
    case 'prskanje': {
      const r = prskanje(pr);
      return r ? (isto ? r.glavno : `${u}: ${malo(r.glavno)}`) : 'Nema prognoze za prskanje.';
    }
    case 'rostilj': {
      const r = rostilj(pr);
      return r ? (isto ? r.glavno : `${u}: ${malo(r.glavno)}`) : 'Nema prognoze za veče.';
    }
    case 'planina': {
      const vrh = najbliziVrh(m.lat, m.lon);
      try {
        const r = presudaVrha(vrh, await dohvatiVrh(vrh), pr.sada.vrijeme, pr.dani);
        return r ? `${r.glavno.replace(/.$/, '')} (${vrh.ime}, ${vrh.visina} m).` : 'Nema prognoze za vrh.';
      } catch {
        return 'Ne mogu doći do prognoze za vrh.';
      }
    }
    case 'temperatura': {
      const d = pr.dani[sutra ? 1 : 0];
      if (sutra && d) return `Sutra ${uMalo} od ${stepeni(d.tMin)} do ${stepeni(d.tMax)}.`;
      return `${u} sad ${stepeni(pr.sada.temp)}${d ? `, danas od ${stepeni(Math.min(d.tMin, pr.sada.temp))} do ${stepeni(Math.max(d.tMax, pr.sada.temp))}` : ''}.`;
    }
    case 'vjetar': {
      const s = pr.sada;
      return `${u}: ${malo(vjetarRecenica(s.vjetar, s.udari, s.smjer, jadranskiKraj(m.lat, m.lon)))}.`;
    }
    case 'zrak': {
      const z = isto ? k.zrak : await dohvatiZrak(m).catch(() => null);
      const zs = z ? zrakSad(z, pr.sada.vrijeme) : null;
      return zs ? `${u}: ${malo(zs.recenica)}${zs.savjet ? ` ${zs.savjet}` : ''}` : 'Nema podatka o zraku za to mjesto.';
    }
    case 'upozorenja': {
      const lista = k.upozorenja(m, sad);
      if (!lista.length) return `Nema službenih upozorenja ${uMalo}.`;
      const u0 = lista[0]!;
      const jos = lista.length > 1 ? ` Još: ${lista.slice(1).map((x) => x.vrsta).join(', ')}.` : '';
      return `${nivoIme(u0.nivo)} upozorenje za ${u0.vrsta} (${u0.regija}), ${kadRecenica(u0, sad)}.${jos}`;
    }
  }
  return `Nisam razumio pitanje. ${PRIMJERI}`;
}
