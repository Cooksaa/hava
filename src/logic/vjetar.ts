/*
 * Vjetar riječima, kako se kod nas kaže.
 *
 * Smjer je meteorološki: odakle vjetar DOLAZI (0° = sa sjevera, 90° = s istoka).
 * U Hercegovini i na primorju sjeveroistočnjak je bura, a jugoistočnjak i južnjak jugo.
 * Drugdje (Sarajevo, Tuzla…) ta imena ne znače ništa, pa se kaže "s juga" i sl.
 */

const STRANE = [
  'sa sjevera',
  'sa sjeveroistoka',
  's istoka',
  's jugoistoka',
  's juga',
  's jugozapada',
  'sa zapada',
  'sa sjeverozapada',
] as const;

/** "s juga" za 180°. */
export function odakle(smjer: number): string {
  const i = Math.round((((smjer % 360) + 360) % 360) / 45) % 8;
  return STRANE[i]!;
}

/** Hercegovina, dolina Neretve i južni Jadran: tu se vjetar zove bura i jugo. */
export function jadranskiKraj(lat: number, lon: number): boolean {
  return lat > 42 && lat < 43.75 && lon > 15.9 && lon < 18.6;
}

export type Jacina = 'nema' | 'slab' | 'umjeren' | 'jak' | 'olujni';

/** Po srednjoj brzini na 10 m, km/h (Beaufortova skala, grubo). */
export function jacinaVjetra(kmh: number): Jacina {
  return kmh < 6 ? 'nema' : kmh < 20 ? 'slab' : kmh < 39 ? 'umjeren' : kmh < 62 ? 'jak' : 'olujni';
}

/** Udari se pominju tek kad su ozbiljni i primjetno jači od srednjeg vjetra. */
export const vrijediUdare = (vjetar: number, udari: number): boolean => udari >= 45 && udari - vjetar >= 15;

const PRIDJEV: Record<Exclude<Jacina, 'nema'>, [m: string, z: string, s: string]> = {
  slab: ['Vjetar slab', 'Slaba', 'Slabo'],
  umjeren: ['Umjeren vjetar', 'Umjerena', 'Umjereno'],
  jak: ['Jak vjetar', 'Jaka', 'Jako'],
  olujni: ['Olujni vjetar', 'Olujna', 'Olujno'],
};

/**
 * "Jaka bura, udari do 80 km/h", "Umjeren vjetar s juga", "Bez vjetra".
 * @param smjer odakle puše, stepeni; bez smjera (stara spremljena prognoza) samo jačina
 */
export function vjetarRecenica(vjetar: number, udari: number, smjer?: number, jadran = false): string {
  const j = jacinaVjetra(vjetar);
  let osnovno: string;
  if (j === 'nema') {
    osnovno = 'Bez vjetra';
  } else {
    const [muski, zenski, srednji] = PRIDJEV[j];
    const s = smjer === undefined ? null : ((smjer % 360) + 360) % 360;
    if (jadran && s !== null && s >= 10 && s <= 80) osnovno = `${zenski} bura`;
    else if (jadran && s !== null && s >= 100 && s <= 200) osnovno = `${srednji} jugo`;
    else if (s !== null && j !== 'slab') osnovno = `${muski} ${odakle(s)}`;
    else osnovno = muski;
  }
  return vrijediUdare(vjetar, udari) ? `${osnovno}, udari do ${Math.round(udari)} km/h` : osnovno;
}
