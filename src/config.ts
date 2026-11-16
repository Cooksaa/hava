import type { Mjesto } from './tipovi';

export interface Grad extends Mjesto {
  /** "U Čapljini", "u Mostaru": treba za rečenice. */
  lokativ: string;
}

export const POCETNO_MJESTO: Mjesto = { ime: 'Čapljina', lat: 43.1137, lon: 17.6847 };

/** Gradovi za "Pada li u…?" */
export const GRADOVI: Grad[] = [
  { ime: 'Čapljina', lokativ: 'Čapljini', lat: 43.1137, lon: 17.6847 },
  { ime: 'Mostar', lokativ: 'Mostaru', lat: 43.3438, lon: 17.8078 },
  { ime: 'Konjic', lokativ: 'Konjicu', lat: 43.6519, lon: 17.9608 },
  { ime: 'Jablanica', lokativ: 'Jablanici', lat: 43.6603, lon: 17.7617 },
  { ime: 'Sarajevo', lokativ: 'Sarajevu', lat: 43.8563, lon: 18.4131 },
  { ime: 'Neum', lokativ: 'Neumu', lat: 42.9233, lon: 17.6156 },
];
