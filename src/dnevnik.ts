import { dodaj, type Zapis } from './logic/dnevnik';

/*
 * Hvata greške koje niko nije uhvatio (pukao kod, odbijeno obećanje) i pamti ih
 * u telefonu. Učitava se prvo u main.ts, da uhvati i greške pri pokretanju.
 * Mrežne greške se ovdje ne vide: one se u kodu već hvataju i pokazuju kao poruka.
 */

const KLJUC = 'dnevnik:v1';
const slusaoci = new Set<() => void>();

function citaj(): Zapis[] {
  try {
    const z = JSON.parse(localStorage.getItem(KLJUC) ?? '[]') as unknown;
    return Array.isArray(z) ? (z as Zapis[]) : [];
  } catch {
    return [];
  }
}

let zapisi = citaj();

function sacuvaj(): void {
  try {
    localStorage.setItem(KLJUC, JSON.stringify(zapisi));
  } catch {
    /* pun ili nedostupan: zapisi ostaju do zatvaranja */
  }
  for (const fn of slusaoci) fn();
}

export function zapisiGresku(poruka: string, gdje = ''): void {
  zapisi = dodaj(zapisi, { kad: Date.now(), poruka, gdje, verzija: __VERSIJA__ });
  sacuvaj();
}

export const sviZapisi = (): Zapis[] => zapisi;

export function obrisi(): void {
  zapisi = [];
  sacuvaj();
}

/** UI se osvježi kad stigne nova greška (link "Pošalji izvještaj" pod verzijom). */
export function prati(fn: () => void): void {
  slusaoci.add(fn);
}

/** Prekinut upit (promjena mjesta) nije greška. */
const nebitno = (poruka: string): boolean => /AbortError|aborted/i.test(poruka);

export function pokreniDnevnik(): void {
  window.addEventListener('error', (e) => {
    // Neučitana slika ili font (e.target je element, ne prozor) nije pukao kod.
    if (!(e instanceof ErrorEvent)) return;
    const poruka = e.error instanceof Error ? `${e.error.name}: ${e.error.message}` : e.message;
    if (!poruka || nebitno(poruka)) return;
    const fajl = e.filename ? e.filename.replace(/^.*\/(assets\/)/, '$1') : '';
    zapisiGresku(poruka, fajl ? `${fajl}:${e.lineno}:${e.colno}` : '');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as unknown;
    const poruka = r instanceof Error ? `${r.name}: ${r.message}` : String(r);
    if (nebitno(poruka)) return;
    const stek = r instanceof Error ? (r.stack?.split('\n')[1]?.trim() ?? '') : '';
    zapisiGresku(`Neuhvaćeno: ${poruka}`, stek.replace(/^at\s+/, '').replace(/https?:\/\/[^/]+\//, ''));
  });
}

/** Verzija APK-a (android.ts), za izvještaj. */
let apk: string | undefined;
export const postaviApk = (v: string): void => {
  apk = v;
};
export const apkVerzija = (): string | undefined => apk;
