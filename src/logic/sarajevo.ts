/*
 * Lokalno vrijeme u BiH bez Intl-a.
 *
 * Provjera u pozadini (src/pozadina) radi u malom JS okruženju na Androidu koje nema
 * Intl ni vremenske zone, pa se ljetno računanje vremena računa ručno, po pravilu EU:
 * od zadnje nedjelje u martu u 01:00 UTC do zadnje nedjelje u oktobru u 01:00 UTC je UTC+2,
 * inače UTC+1.
 */

/** Zadnja nedjelja u mjesecu (0 = januar), u 01:00 UTC, ms. */
function zadnjaNedjelja(godina: number, mjesec: number): number {
  const zadnjiDan = new Date(Date.UTC(godina, mjesec + 1, 0));
  const dan = zadnjiDan.getUTCDate() - zadnjiDan.getUTCDay();
  return Date.UTC(godina, mjesec, dan, 1);
}

/** Pomak od UTC u minutama: 60 zimi, 120 ljeti. */
export function pomak(ms: number): number {
  const godina = new Date(ms).getUTCFullYear();
  return ms >= zadnjaNedjelja(godina, 2) && ms < zadnjaNedjelja(godina, 9) ? 120 : 60;
}

export interface Lokalno {
  godina: number;
  mjesec: number;
  dan: number;
  sat: number;
  minut: number;
  /** "2026-11-23" */
  datum: string;
}

const dva = (n: number): string => String(n).padStart(2, '0');

export function lokalno(ms: number): Lokalno {
  const d = new Date(ms + pomak(ms) * 60_000);
  const godina = d.getUTCFullYear();
  const mjesec = d.getUTCMonth() + 1;
  const dan = d.getUTCDate();
  return {
    godina,
    mjesec,
    dan,
    sat: d.getUTCHours(),
    minut: d.getUTCMinutes(),
    datum: `${godina}-${dva(mjesec)}-${dva(dan)}`,
  };
}
