import { prskanje, rostilj } from './aktivnosti';
import { presudaDrona, type ModelDrona, type Visina } from './dron';
import { procijeniKisu } from './kisa';
import type { KisaSad } from './kisaSad';
import { LOKATIV, type Pitanje } from './pitanja';
import { najbliziVrh, presudaVrha, type SatVrha, type Vrh } from './planina';
import { kadRecenica, nivoIme, type Upozorenje } from './upozorenja';
import { procijeniVes } from './ves';
import { jadranskiKraj, vjetarRecenica } from './vjetar';
import { zrakSad, type Zrak } from './zrak';
import { MJESTA } from '../mjesta';
import { kisaRecenica, stepeni, vesRecenica } from '../tekst';
import type { Mjesto, Prognoza } from '../tipovi';

/*
 * Odgovor na pitanje (pitanja.ts) jednom rečenicom, od istih rečenica koje aplikacija
 * pokazuje na ekranu. Ne zna odakle dolaze podaci: aplikacija daje ono što već ima
 * (radar, visine, izabrani dron), server (api/pitaj.ts) dohvata sam. Zato radi i u
 * pregledniku i na serveru.
 */

export interface Izvori {
  /** Mjesto kad pitanje ne pominje drugo (otvoreno u aplikaciji, ili iz upita). */
  mjesto: Mjesto;
  /** Prognoza za `mjesto` ako je već ima; inače se dohvati. */
  prognoza: Prognoza | null;
  model: ModelDrona;
  dohvatiPrognozu(m: Mjesto): Promise<Prognoza>;
  /** Radar za naredna 2 sata; `isto` = mjesto iz `mjesto`. Bez radara null. */
  kisaSad(m: Mjesto, isto: boolean): Promise<KisaSad | null>;
  visine(m: Mjesto, isto: boolean): Promise<Map<string, Visina> | null>;
  zrak(m: Mjesto, isto: boolean): Promise<Zrak | null>;
  vrh(v: Vrh): Promise<SatVrha[]>;
  upozorenja(m: Mjesto, sad: number): Upozorenje[] | Promise<Upozorenje[]>;
}

export const PRIMJERI = 'Pitaj npr. „Mogu li danas dići dron?“, „Pada li u Čapljini?“ ili „Kad da palim mašinu?“';

const malo = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** Mjesto o kojem se pita: pomenuto u pitanju, inače podrazumijevano. */
export function mjestoPitanja(p: Pitanje, podrazumijevano: Mjesto): { mjesto: Mjesto; isto: boolean } {
  const poznato = p.mjesto ? MJESTA.find((m) => m.ime === p.mjesto) : null;
  if (!poznato || (poznato.lat === podrazumijevano.lat && poznato.lon === podrazumijevano.lon) || poznato.ime === podrazumijevano.ime) {
    return { mjesto: podrazumijevano, isto: true };
  }
  return {
    mjesto: { ime: poznato.ime, lat: poznato.lat, lon: poznato.lon, bih: poznato.drzava === 'Bosna i Hercegovina' },
    isto: false,
  };
}

export async function odgovori(p: Pitanje, k: Izvori, sad = Date.now()): Promise<string> {
  if (!p.tema) return `Nisam razumio pitanje. ${PRIMJERI}`;

  const { mjesto: m, isto } = mjestoPitanja(p, k.mjesto);
  const lok = LOKATIV[m.ime];
  const u = lok ? `U ${lok}` : `Za ${m.ime}`;
  const uMalo = lok ? `u ${lok}` : `za ${m.ime}`;
  const uz = (g: string): string => (isto ? g : `${u}: ${malo(g)}`);

  if (p.tema === 'upozorenja') {
    const lista = await k.upozorenja(m, sad);
    if (!lista.length) return `Nema službenih upozorenja ${uMalo}.`;
    const u0 = lista[0]!;
    const jos = lista.length > 1 ? ` Još: ${lista.slice(1).map((x) => x.vrsta).join(', ')}.` : '';
    return `${nivoIme(u0.nivo)} upozorenje za ${u0.vrsta} (${u0.regija}), ${kadRecenica(u0, sad)}.${jos}`;
  }

  let pr: Prognoza | null = isto ? k.prognoza : null;
  if (!pr) {
    try {
      pr = await k.dohvatiPrognozu(m);
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
      const r = await k.kisaSad(m, isto).catch(() => null);
      if (r && r.vrsta !== 'suho') return `${u}: ${malo(r.recenica)}`;
      return kisaRecenica({ ...m, lokativ: lok ?? m.ime }, procijeniKisu(pr));
    }
    case 'ves':
      return uz(vesRecenica(procijeniVes(pr)).glavno);
    case 'dron': {
      const visine = await k.visine(m, isto).catch(() => null);
      const d = presudaDrona(pr.dani, pr.sati, visine ?? new Map(), k.model, pr.sada.vrijeme);
      if (!d) return 'Nema prognoze za dron.';
      return `${uz(d.glavno).replace(/.$/, '')} (${k.model.ime}).`;
    }
    case 'prskanje': {
      const r = prskanje(pr);
      return r ? uz(r.glavno) : 'Nema prognoze za prskanje.';
    }
    case 'rostilj': {
      const r = rostilj(pr);
      return r ? uz(r.glavno) : 'Nema prognoze za veče.';
    }
    case 'planina': {
      const vrh = najbliziVrh(m.lat, m.lon);
      try {
        const r = presudaVrha(vrh, await k.vrh(vrh), pr.sada.vrijeme, pr.dani);
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
      const z = await k.zrak(m, isto).catch(() => null);
      const zs = z ? zrakSad(z, pr.sada.vrijeme) : null;
      return zs ? `${u}: ${malo(zs.recenica)}${zs.savjet ? ` ${zs.savjet}` : ''}` : 'Nema podatka o zraku za to mjesto.';
    }
  }
  return `Nisam razumio pitanje. ${PRIMJERI}`;
}
