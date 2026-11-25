/*
 * Dnevnik grešaka: šta je puklo u aplikaciji, da korisnik može poslati izvještaj.
 * Ništa ne ide nikome samo od sebe: izvještaj korisnik kopira ili pošalje mailom.
 * Bez lokacije i bez ličnih podataka: samo greška, verzija i telefon.
 */

export interface Zapis {
  /** ms */
  kad: number;
  poruka: string;
  /** "assets/index-abc.js:12:345" ili "" */
  gdje: string;
  /** Verzija web dijela kad se desilo. */
  verzija: string;
  /** Koliko puta zaredom (ista greška se ne ponavlja u listi). */
  puta: number;
}

export const NAJVISE = 30;
const DUZINA = 300;

/** Iz poruke izbaci adrese (mogu nositi koordinate u upitu) i skrati. */
export function ocisti(poruka: string): string {
  return poruka
    .replace(/https?:\/\/[^\s'")]+/g, (u) => u.split('?')[0]!)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DUZINA);
}

/** Dodaj zapis: ista greška (poruka i mjesto) samo poveća brojač; najviše NAJVISE zadnjih. */
export function dodaj(zapisi: Zapis[], novi: Omit<Zapis, 'puta'>): Zapis[] {
  const poruka = ocisti(novi.poruka);
  const gdje = ocisti(novi.gdje);
  const isti = zapisi.findIndex((z) => z.poruka === poruka && z.gdje === gdje && z.verzija === novi.verzija);
  if (isti >= 0) {
    const z = zapisi[isti]!;
    const ostali = zapisi.filter((_, i) => i !== isti);
    return [...ostali, { ...z, kad: novi.kad, puta: z.puta + 1 }];
  }
  return [...zapisi, { ...novi, poruka, gdje, puta: 1 }].slice(-NAJVISE);
}

const vrijeme = (ms: number): string => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

/** Tekst za slanje: kratko zaglavlje, pa greške od najnovije. */
export function izvjestaj(zapisi: Zapis[], o: { verzija: string; apk?: string; uredjaj: string; sad: number }): string {
  const linije = [
    'Hava: izvještaj o greškama',
    `Verzija ${o.verzija}${o.apk ? ` (APK ${o.apk})` : ''}`,
    `Telefon: ${o.uredjaj}`,
    `Poslano: ${vrijeme(o.sad)}`,
    '',
  ];
  for (const z of [...zapisi].reverse()) {
    linije.push(`${vrijeme(z.kad)} · ${z.verzija}${z.puta > 1 ? ` · ${z.puta}×` : ''}`);
    linije.push(`  ${z.poruka}`);
    if (z.gdje) linije.push(`  ${z.gdje}`);
  }
  return linije.join('\n');
}

/** "Android 17; Xiaomi 15" iz user-agenta, bez ostalog. */
export function uredjaj(ua: string): string {
  const m = /Android [\d.]+; ([^;)]+)/.exec(ua);
  const android = /Android [\d.]+/.exec(ua)?.[0];
  if (android) return m?.[1] ? `${android}, ${m[1].trim()}` : android;
  return /Windows|Mac OS X|iPhone|iPad|Linux/.exec(ua)?.[0] ?? 'nepoznat';
}

/** "jednu grešku", "3 greške", "5 grešaka", "21 grešku", "22 greške". */
export function brojGresaka(n: number): string {
  if (n === 1) return 'jednu grešku';
  const d = n % 10;
  const s = n % 100;
  if (d === 1 && s !== 11) return `${n} grešku`;
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} greške`;
  return `${n} grešaka`;
}
