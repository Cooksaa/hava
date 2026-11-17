import { jeNovija } from './verzija';

/*
 * "Šta je novo" poslije ažuriranja. Pokazuje se jednom, za sve verzije koje je
 * korisnik preskočio od zadnjeg puta.
 */

export interface Novost {
  verzija: string;
  stavke: string[];
}

/**
 * @param vidjena verzija za koju je korisnik zadnji put vidio novosti; null = prvo pokretanje
 * @returns novosti novije od `vidjena`, a ne novije od `trenutna`, najnovije prve
 */
export function staJeNovo(novosti: Novost[], trenutna: string, vidjena: string | null): Novost[] {
  if (vidjena === null) return [];
  return novosti
    .filter((n) => jeNovija(n.verzija, vidjena) && !jeNovija(n.verzija, trenutna))
    .sort((a, b) => (jeNovija(a.verzija, b.verzija) ? -1 : 1));
}
