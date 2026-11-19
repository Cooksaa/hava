import { jeNovija } from './verzija';

/*
 * Kako Android aplikacija dolazi do nove verzije.
 *
 * Svako izdanje na GitHubu ima APK i, od 0.2.0, paket web dijela:
 *   Hava-web-0.2.3-apk-0.2.0.zip  = web dio verzije 0.2.3, radi na APK-u 0.2.0 ili novijem.
 *
 * Skoro sve promjene su u web dijelu (izgled, tekstovi, logika veša…). Takav paket
 * aplikacija sama skine i primijeni kad se sljedeći put otvori, bez ikakvog pitanja.
 * Tek kad se promijeni nativni dio (novi dodatak, Android postavke), treba novi APK:
 * tada se pokaže tiha linija "Nova verzija · Preuzmi".
 */

export interface Izdanje {
  verzija: string;
  /** Link za APK, ili stranica izdanja ako APK-a nema. */
  apk: string;
  web: { url: string; minApk: string } | null;
}

export interface GhIzdanje {
  tag_name: string;
  html_url: string;
  assets?: { name: string; browser_download_url: string }[];
}

const WEB_PAKET = /^Hava-web-(\d+\.\d+\.\d+)-apk-(\d+\.\d+\.\d+)\.zip$/;

export function procitajIzdanje(gh: GhIzdanje): Izdanje {
  const verzija = gh.tag_name.replace(/^v/, '');
  const assets = gh.assets ?? [];
  const apk = assets.find((a) => a.name.endsWith('.apk'));
  let web: Izdanje['web'] = null;
  for (const a of assets) {
    const m = WEB_PAKET.exec(a.name);
    // Paket mora biti baš za ovu verziju, ne neki zaostali.
    if (m && m[1] === verzija && m[2]) web = { url: a.browser_download_url, minApk: m[2] };
  }
  return { verzija, apk: apk?.browser_download_url ?? gh.html_url, web };
}

/*
 * Od 0.4.1 svako izdanje ima i izdanje.json. Čita se preko
 * github.com/…/releases/latest/download/izdanje.json, što nije GitHub API pa nema
 * ograničenja od 60 upita na sat po IP adresi (na mobilnoj mreži tu adresu dijele
 * stotine ljudi, pa se limit zna potrošiti i bez nas).
 */
export interface Manifest {
  verzija: string;
  minApk: string;
  apk: string;
  web: string;
}

/** izdanje.json → Izdanje, ili null ako nije ispravan. */
export function procitajManifest(m: unknown): Izdanje | null {
  if (!m || typeof m !== 'object') return null;
  const { verzija, minApk, apk, web } = m as Partial<Manifest>;
  const ispravno = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
  if (!ispravno(verzija) || !ispravno(minApk) || !ispravno(apk) || !ispravno(web)) return null;
  if (!/^\d+\.\d+\.\d+$/.test(verzija) || !/^\d+\.\d+\.\d+$/.test(minApk)) return null;
  if (!apk.startsWith('https://') || !web.startsWith('https://')) return null;
  return { verzija, apk, web: { url: web, minApk } };
}

export type Odluka =
  | { vrsta: 'nista' }
  | { vrsta: 'tiho'; verzija: string; url: string }
  | { vrsta: 'preuzmi'; verzija: string; link: string };

/**
 * @param web verzija web dijela koji sad radi
 * @param apk verzija instaliranog APK-a
 */
export function odlukaAzuriranja(iz: Izdanje, web: string, apk: string): Odluka {
  if (iz.web && jeNovija(iz.verzija, web) && !jeNovija(iz.web.minApk, apk)) {
    return { vrsta: 'tiho', verzija: iz.verzija, url: iz.web.url };
  }
  // Novi APK treba samo kad je izdanje novije i od onoga što radi i od instaliranog APK-a.
  if (jeNovija(iz.verzija, web) && jeNovija(iz.verzija, apk)) {
    return { vrsta: 'preuzmi', verzija: iz.verzija, link: iz.apk };
  }
  return { vrsta: 'nista' };
}
