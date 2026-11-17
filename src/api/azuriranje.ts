import { jeNovija } from '../logic/verzija';

/*
 * Samo za Android APK koji se instalira s GitHuba: ima li nova verzija.
 * Kad app bude na Play Storeu, ažuriranja radi Play, a ovo se isključi.
 *
 * Provjera najviše dvaput dnevno: GitHub bez prijave dozvoljava 60 upita na sat.
 */

const ADRESA = 'https://api.github.com/repos/Cooksaa/hava/releases/latest';
const KLJUC = 'azuriranje:v1';
const PROVJERI_NAKON_MS = 12 * 60 * 60 * 1000;

export interface NovaVerzija {
  verzija: string;
  /** Direktno na APK, ili na stranicu izdanja ako APK-a nema. */
  link: string;
}

interface Zapamceno {
  provjereno: number;
  nova: NovaVerzija | null;
}

interface GhIzdanje {
  tag_name: string;
  html_url: string;
  assets?: { name: string; browser_download_url: string }[];
}

function citaj(): Zapamceno | null {
  try {
    const s = localStorage.getItem(KLJUC);
    return s ? (JSON.parse(s) as Zapamceno) : null;
  } catch {
    return null;
  }
}

function pisi(z: Zapamceno): void {
  try {
    localStorage.setItem(KLJUC, JSON.stringify(z));
  } catch {
    /* bez pamćenja: sljedeći put se samo provjeri ponovo */
  }
}

/** Nova verzija ako postoji, inače null. Greške se gutaju: ovo nikad ne smije smetati. */
export async function provjeriNovuVerziju(trenutna: string): Promise<NovaVerzija | null> {
  const z = citaj();
  if (z && Date.now() - z.provjereno < PROVJERI_NAKON_MS) {
    // Zapamćena nova verzija vrijedi samo ako je još novija od ove (možda je već instalirana).
    return z.nova && jeNovija(z.nova.verzija, trenutna) ? z.nova : null;
  }

  try {
    const odgovor = await fetch(ADRESA, { headers: { Accept: 'application/vnd.github+json' } });
    if (!odgovor.ok) return null;
    const izdanje = (await odgovor.json()) as GhIzdanje;
    const apk = izdanje.assets?.find((a) => a.name.endsWith('.apk'));
    const verzija = izdanje.tag_name.replace(/^v/, '');
    const nova = jeNovija(verzija, trenutna)
      ? { verzija, link: apk?.browser_download_url ?? izdanje.html_url }
      : null;
    pisi({ provjereno: Date.now(), nova });
    return nova;
  } catch {
    return null;
  }
}
