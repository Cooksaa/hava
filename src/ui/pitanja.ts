import { dohvatiPrognozu } from '../api/openMeteo';
import { dohvatiVrh } from '../api/planina';
import { dohvatiRadar, type Radar } from '../api/radar';
import { dohvatiVisine } from '../api/visina';
import { dohvatiZrak } from '../api/zrak';
import type { Visina } from '../logic/dron';
import { odgovori as odgovoriIz } from '../logic/odgovor';
import type { Pitanje } from '../logic/pitanja';
import type { Upozorenje } from '../logic/upozorenja';
import type { Zrak } from '../logic/zrak';
import type { Mjesto, Prognoza } from '../tipovi';
import { izabraniModel } from './dron';
import { kisaZaPrikaz } from './kisaSad';

/*
 * Pitanje iz aplikacije: logika je u logic/odgovor.ts (ista kao na serveru), ovdje
 * samo ono što aplikacija već ima: radar, vjetar na visini, izabrani dron.
 */

export interface KontekstPitanja {
  mjesto: Mjesto;
  prognoza: Prognoza | null;
  radar: Radar | null;
  visine: Map<string, Visina> | null;
  zrak: Zrak | null;
  upozorenja(m: Mjesto, sad: number): Upozorenje[];
}

export function odgovori(p: Pitanje, k: KontekstPitanja, sad = Date.now()): Promise<string> {
  return odgovoriIz(
    p,
    {
      mjesto: k.mjesto,
      prognoza: k.prognoza,
      model: izabraniModel(),
      dohvatiPrognozu,
      async kisaSad(m, isto) {
        const radar = isto ? k.radar : await dohvatiRadar(m).catch(() => null);
        return kisaZaPrikaz(radar, sad)?.kisa ?? null;
      },
      visine: async (m, isto) => (isto ? k.visine : dohvatiVisine(m)),
      zrak: async (m, isto) => (isto ? k.zrak : dohvatiZrak(m)),
      vrh: dohvatiVrh,
      upozorenja: k.upozorenja,
    },
    sad,
  );
}
