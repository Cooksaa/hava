import { jeNovija } from './verzija';

/*
 * Šta se dešava s ažuriranjem, da se vidi na telefonu (dodir na "Hava 0.4.1" na dnu).
 * Bez ovoga se ne zna je li telefon uopšte provjerio, skinuo, ili se nova verzija srušila.
 */

export type StatusPaketa = 'skida' | 'spreman' | 'pao' | 'treba-apk';

export interface StanjeAzuriranja {
  /** Zadnja uspješna provjera, ms. */
  provjereno: number | null;
  /** Zadnji pokušaj koji nije uspio, ms, i zašto. Briše se kad provjera uspije. */
  neuspjeh: { kad: number; zasto: string } | null;
  /** Verzija zadnjeg izdanja na GitHubu. */
  zadnja: string | null;
  paket: { verzija: string; status: StatusPaketa } | null;
}

export const PRAZNO: StanjeAzuriranja = { provjereno: null, neuspjeh: null, zadnja: null, paket: null };

function kad(ms: number, sad: number): string {
  const min = Math.round((sad - ms) / 60_000);
  if (min < 1) return 'upravo';
  if (min < 60) return `prije ${min} min`;
  const d = new Date(ms);
  const vrijeme = d.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sarajevo' });
  const dan = (x: number): string => new Date(x).toLocaleDateString('sv-SE', { timeZone: 'Europe/Sarajevo' });
  if (dan(ms) === dan(sad)) return `danas u ${vrijeme}`;
  if (dan(ms) === dan(sad - 864e5)) return `jučer u ${vrijeme}`;
  return `${d.toLocaleDateString('bs-BA', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Sarajevo' })} u ${vrijeme}`;
}

/**
 * Jedna glavna rečenica i sitni detalji ispod.
 * @param trenutna verzija koja sad radi
 */
export function opisAzuriranja(st: StanjeAzuriranja, trenutna: string, sad: number): { glavno: string; detalji: string[] } {
  const detalji: string[] = [];
  if (st.provjereno !== null) detalji.push(`Zadnja provjera: ${kad(st.provjereno, sad)}.`);
  if (st.neuspjeh && (st.provjereno === null || st.neuspjeh.kad > st.provjereno)) {
    detalji.push(`Provjera ${kad(st.neuspjeh.kad, sad)} nije uspjela: ${st.neuspjeh.zasto}.`);
  }

  const p = st.paket;
  let glavno: string;
  if (p && jeNovija(p.verzija, trenutna)) {
    glavno =
      p.status === 'spreman'
        ? `Verzija ${p.verzija} je skinuta. Izađi iz aplikacije i vrati se, pa se uključi.`
        : p.status === 'skida'
          ? `Skida se verzija ${p.verzija}.`
          : p.status === 'pao'
            ? `Verzija ${p.verzija} se nije pokrenula, pa je ostala ${trenutna}. Ide opet sa sljedećom.`
            : `Za verziju ${p.verzija} treba novi APK. Link je na dnu ekrana.`;
  } else if (st.zadnja !== null && !jeNovija(st.zadnja, trenutna)) {
    glavno = 'Imaš najnoviju verziju.';
  } else if (st.provjereno === null) {
    glavno = st.neuspjeh ? 'Provjera nije uspjela.' : 'Još nije provjereno.';
  } else {
    glavno = `Na GitHubu je ${st.zadnja ?? '?'}.`;
  }
  return { glavno, detalji };
}
