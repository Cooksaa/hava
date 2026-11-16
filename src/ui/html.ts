/*
 * Mali helper za HTML iz stringova. Sve što se umetne u šablon se escape-a,
 * osim onoga što je već prošlo kroz `html` ili je izričito označeno sa `sirovo`.
 * Imena mjesta dolaze iz vanjskog servisa, pa ovo nije opcionalno.
 */

export class Sirovo {
  constructor(readonly html: string) {}
  toString(): string {
    return this.html;
  }
}

/** Za HTML kojem vjerujemo (naše ikone). */
export const sirovo = (h: string): Sirovo => new Sirovo(h);

const ZAMJENE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const esc = (v: unknown): string => String(v).replace(/[&<>"']/g, (z) => ZAMJENE[z] ?? z);

function umetni(v: unknown): string {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Sirovo) return v.html;
  if (Array.isArray(v)) return v.map(umetni).join('');
  return esc(v);
}

export function html(dijelovi: TemplateStringsArray, ...vrijednosti: unknown[]): Sirovo {
  let izlaz = dijelovi[0] ?? '';
  vrijednosti.forEach((v, i) => {
    izlaz += umetni(v) + (dijelovi[i + 1] ?? '');
  });
  return new Sirovo(izlaz);
}
