import { procitajIzdanje, type GhIzdanje, type Izdanje } from '../logic/azuriranje';

/*
 * Samo za Android aplikaciju s GitHuba: zadnje izdanje.
 * Kad app bude na Play Storeu, APK ažurira Play, a web dio i dalje ide ovuda.
 *
 * Najviše jednom na sat: GitHub bez prijave dozvoljava 60 upita na sat.
 */

const ADRESA = 'https://api.github.com/repos/Cooksaa/hava/releases/latest';
const KLJUC = 'azuriranje:v2';
const PROVJERI_NAKON_MS = 60 * 60 * 1000;

interface Zapamceno {
  provjereno: number;
  izdanje: Izdanje | null;
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

/** Zadnje izdanje, ili null. Greške se gutaju: ovo nikad ne smije smetati. */
export async function zadnjeIzdanje(): Promise<Izdanje | null> {
  const z = citaj();
  if (z && Date.now() - z.provjereno < PROVJERI_NAKON_MS) return z.izdanje;

  try {
    const odgovor = await fetch(ADRESA, { headers: { Accept: 'application/vnd.github+json' } });
    if (!odgovor.ok) return z?.izdanje ?? null;
    const izdanje = procitajIzdanje((await odgovor.json()) as GhIzdanje);
    pisi({ provjereno: Date.now(), izdanje });
    return izdanje;
  } catch {
    return z?.izdanje ?? null;
  }
}
