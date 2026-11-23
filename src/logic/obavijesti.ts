import { lokalno } from './sarajevo';
import { kadRecenica, nivoIme, type Upozorenje } from './upozorenja';

/*
 * Obavijesti za baš jako vrijeme, i kad je aplikacija zatvorena (src/pozadina).
 * Čiste funkcije: šta poslati i kojim riječima. Bez Intl-a i bez DOM-a.
 *
 * Šta se šalje:
 *  - službeno narandžasto ili crveno upozorenje za regiju (žuto ne, da ne dosadi)
 *  - model (ICON-2I) u narednih 12 sati: udari vjetra od 75 km/h, ili jaka kiša
 *    (10 mm u satu, ili 25 mm u tri sata)
 * Isti događaj samo jednom (ključ), a noću (22–7h) samo službena upozorenja.
 */

export interface Obavijest {
  /** Jedinstven za događaj: drugi put se ne šalje. */
  kljuc: string;
  naslov: string;
  tekst: string;
}

export interface SatModela {
  /** ms, početak sata */
  vrijeme: number;
  /** mm u tom satu */
  kisa: number;
  /** udari vjetra, km/h */
  udari: number;
}

export const PRAG_UDARI = 75;
export const PRAG_KISA_SAT = 10;
export const PRAG_KISA_3H = 25;
const NAPRIJED_MS = 12 * 3600e3;

/** "u 18h", "sutra oko 6h", "već sad". */
function kad(ms: number, sad: number): string {
  if (ms <= sad + 30 * 60e3) return 'već sad';
  const l = lokalno(ms);
  const danas = lokalno(sad).datum;
  return l.datum === danas ? `oko ${l.sat}h` : `sutra oko ${l.sat}h`;
}

/** "u Čapljini": lokativ ne znamo za svako mjesto, pa jednostavno "za Čapljinu" u tekstu. */
export function obavijestiModela(sati: SatModela[], mjesto: string, sad: number): Obavijest[] {
  const naprijed = sati.filter((s) => s.vrijeme + 3600e3 > sad && s.vrijeme <= sad + NAPRIJED_MS);
  const out: Obavijest[] = [];

  const vjetar = naprijed.find((s) => s.udari >= PRAG_UDARI);
  if (vjetar) {
    const najjaci = Math.max(...naprijed.map((s) => s.udari));
    out.push({
      kljuc: `vjetar:${lokalno(vjetar.vrijeme).datum}`,
      naslov: najjaci >= 90 ? `Olujni vjetar, ${mjesto}` : `Jak vjetar, ${mjesto}`,
      tekst: `Udari do ${Math.round(najjaci / 5) * 5} km/h, ${kad(vjetar.vrijeme, sad)}. Skloni šta vjetar može odnijeti.`,
    });
  }

  const sat = naprijed.find((s) => s.kisa >= PRAG_KISA_SAT);
  let tri: { od: SatModela; zbir: number } | null = null;
  for (let i = 0; i + 2 < naprijed.length; i++) {
    const zbir = naprijed[i]!.kisa + naprijed[i + 1]!.kisa + naprijed[i + 2]!.kisa;
    if (zbir >= PRAG_KISA_3H) {
      tri = { od: naprijed[i]!, zbir };
      break;
    }
  }
  if (sat || tri) {
    const pocetak = sat && (!tri || sat.vrijeme <= tri.od.vrijeme) ? sat : tri!.od;
    const tekst =
      pocetak === sat
        ? `Do ${Math.round(sat.kisa)} mm za sat, ${kad(sat.vrijeme, sad)}.`
        : `Do ${Math.round(tri!.zbir)} mm za tri sata, od ${kad(tri!.od.vrijeme, sad).replace('oko ', '')}.`;
    out.push({ kljuc: `kisa:${lokalno(pocetak.vrijeme).datum}`, naslov: `Jaka kiša, ${mjesto}`, tekst });
  }
  return out;
}

/** Prva rečenica opisa, kratko (obavijest ima malo mjesta). */
function kratko(opis: string): string {
  // Bez lookbehinda u regexu: pozadinski JS motor ga možda nema.
  const prva = /^[^.!]*[.!]/.exec(opis)?.[0] ?? opis;
  return prva.length > 140 ? `${prva.slice(0, 137).trimEnd()}…` : prva;
}

export function obavijestiUpozorenja(lista: Upozorenje[], sad: number): Obavijest[] {
  return lista
    .filter((u) => u.nivo >= 3)
    .map((u) => ({
      kljuc: `ma:${u.vrsta}:${u.nivo}:${u.od}`,
      naslov: `${nivoIme(u.nivo)} upozorenje: ${u.vrsta}`,
      tekst: `${u.regija}, ${kadRecenica(u, sad)}.${u.opis ? ` ${kratko(u.opis)}` : ''}`,
    }));
}

/** Noću (22–7h) samo službena upozorenja: model ne budi ljude. */
export const noc = (sad: number): boolean => {
  const s = lokalno(sad).sat;
  return s >= 22 || s < 7;
};

/**
 * Šta još nije poslano. `poslano` je ključ → kad je poslano (ms); stariji od 3 dana se brišu.
 */
export function zaSlanje(
  sve: Obavijest[],
  poslano: Record<string, number>,
  sad: number,
): { nove: Obavijest[]; poslano: Record<string, number> } {
  const svjeze: Record<string, number> = {};
  for (const [k, t] of Object.entries(poslano)) if (sad - t < 3 * 864e5) svjeze[k] = t;
  const nove = sve.filter((o) => !(o.kljuc in svjeze));
  for (const o of nove) svjeze[o.kljuc] = sad;
  return { nove, poslano: svjeze };
}

/** Broj za Android obavijest (32-bit), isti za isti ključ. */
export function idObavijesti(kljuc: string): number {
  let h = 0;
  for (let i = 0; i < kljuc.length; i++) h = (Math.imul(h, 31) + kljuc.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

/** Kad zavod već upozorava na vjetar ili kišu, naša obavijest iz modela za to isto bi bila duplikat. */
export function bezDuplikata(sluzbene: Obavijest[], model: Obavijest[]): Obavijest[] {
  const ima = (vrste: string[]): boolean => sluzbene.some((o) => vrste.some((v) => o.kljuc.startsWith(`ma:${v}:`)));
  const vjetar = ima(['vjetar']);
  const kisa = ima(['kiša', 'kiša i poplave']);
  return [
    ...sluzbene,
    ...model.filter((o) => !(vjetar && o.kljuc.startsWith('vjetar:')) && !(kisa && o.kljuc.startsWith('kisa:'))),
  ];
}
