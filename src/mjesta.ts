import type { Mjesto } from './tipovi';

/*
 * Ugrađena lista mjesta. Služi za dvije stvari:
 *  - ime za GPS lokaciju ("Blizu Stoca"), bez slanja koordinata trećem servisu
 *  - trenutni prijedlozi u pretrazi, i bez interneta
 *
 * Koordinate su približne (centar mjesta). Prognoza se uvijek traži za stvarne
 * koordinate, ovo je samo za ime.
 */

export interface PoznatoMjesto extends Mjesto {
  /** "blizu Čapljine" */
  genitiv: string;
  drzava: string;
}

export const BIH = 'Bosna i Hercegovina';
const HR = 'Hrvatska';

export const MJESTA: PoznatoMjesto[] = [
  { ime: 'Čapljina', genitiv: 'Čapljine', lat: 43.1137, lon: 17.6847, drzava: BIH },
  { ime: 'Mostar', genitiv: 'Mostara', lat: 43.3438, lon: 17.8078, drzava: BIH },
  { ime: 'Sarajevo', genitiv: 'Sarajeva', lat: 43.8563, lon: 18.4131, drzava: BIH },
  { ime: 'Konjic', genitiv: 'Konjica', lat: 43.6519, lon: 17.9608, drzava: BIH },
  { ime: 'Jablanica', genitiv: 'Jablanice', lat: 43.6603, lon: 17.7617, drzava: BIH },
  { ime: 'Neum', genitiv: 'Neuma', lat: 42.9233, lon: 17.6156, drzava: BIH },
  { ime: 'Počitelj', genitiv: 'Počitelja', lat: 43.1344, lon: 17.7311, drzava: BIH },
  { ime: 'Međugorje', genitiv: 'Međugorja', lat: 43.1906, lon: 17.6775, drzava: BIH },
  { ime: 'Čitluk', genitiv: 'Čitluka', lat: 43.2286, lon: 17.7008, drzava: BIH },
  { ime: 'Ljubuški', genitiv: 'Ljubuškog', lat: 43.1969, lon: 17.545, drzava: BIH },
  { ime: 'Stolac', genitiv: 'Stoca', lat: 43.0844, lon: 17.9578, drzava: BIH },
  { ime: 'Blagaj', genitiv: 'Blagaja', lat: 43.257, lon: 17.887, drzava: BIH },
  { ime: 'Široki Brijeg', genitiv: 'Širokog Brijega', lat: 43.3831, lon: 17.5939, drzava: BIH },
  { ime: 'Grude', genitiv: 'Gruda', lat: 43.3711, lon: 17.4131, drzava: BIH },
  { ime: 'Posušje', genitiv: 'Posušja', lat: 43.4719, lon: 17.33, drzava: BIH },
  { ime: 'Ravno', genitiv: 'Ravnog', lat: 42.8847, lon: 17.9714, drzava: BIH },
  { ime: 'Trebinje', genitiv: 'Trebinja', lat: 42.7119, lon: 18.3439, drzava: BIH },
  { ime: 'Bileća', genitiv: 'Bileće', lat: 42.8758, lon: 18.4297, drzava: BIH },
  { ime: 'Nevesinje', genitiv: 'Nevesinja', lat: 43.2586, lon: 18.1136, drzava: BIH },
  { ime: 'Gacko', genitiv: 'Gacka', lat: 43.1672, lon: 18.5353, drzava: BIH },
  { ime: 'Prozor', genitiv: 'Prozora', lat: 43.8222, lon: 17.6094, drzava: BIH },
  { ime: 'Tomislavgrad', genitiv: 'Tomislavgrada', lat: 43.7186, lon: 17.2256, drzava: BIH },
  { ime: 'Livno', genitiv: 'Livna', lat: 43.8269, lon: 17.0075, drzava: BIH },
  { ime: 'Kupres', genitiv: 'Kupresa', lat: 43.9906, lon: 17.2797, drzava: BIH },
  { ime: 'Bugojno', genitiv: 'Bugojna', lat: 44.0572, lon: 17.4508, drzava: BIH },
  { ime: 'Jajce', genitiv: 'Jajca', lat: 44.3422, lon: 17.2703, drzava: BIH },
  { ime: 'Travnik', genitiv: 'Travnika', lat: 44.2264, lon: 17.6658, drzava: BIH },
  { ime: 'Zenica', genitiv: 'Zenice', lat: 44.2017, lon: 17.9078, drzava: BIH },
  { ime: 'Kakanj', genitiv: 'Kaknja', lat: 44.1272, lon: 18.1167, drzava: BIH },
  { ime: 'Visoko', genitiv: 'Visokog', lat: 43.9889, lon: 18.1781, drzava: BIH },
  { ime: 'Goražde', genitiv: 'Goražda', lat: 43.6675, lon: 18.9756, drzava: BIH },
  { ime: 'Foča', genitiv: 'Foče', lat: 43.5064, lon: 18.7781, drzava: BIH },
  { ime: 'Višegrad', genitiv: 'Višegrada', lat: 43.7828, lon: 19.2928, drzava: BIH },
  { ime: 'Tuzla', genitiv: 'Tuzle', lat: 44.5384, lon: 18.6763, drzava: BIH },
  { ime: 'Zvornik', genitiv: 'Zvornika', lat: 44.3869, lon: 19.1014, drzava: BIH },
  { ime: 'Bijeljina', genitiv: 'Bijeljine', lat: 44.7587, lon: 19.2144, drzava: BIH },
  { ime: 'Brčko', genitiv: 'Brčkog', lat: 44.8727, lon: 18.8106, drzava: BIH },
  { ime: 'Doboj', genitiv: 'Doboja', lat: 44.7349, lon: 18.0843, drzava: BIH },
  { ime: 'Banja Luka', genitiv: 'Banje Luke', lat: 44.7722, lon: 17.191, drzava: BIH },
  { ime: 'Prijedor', genitiv: 'Prijedora', lat: 44.9799, lon: 16.714, drzava: BIH },
  { ime: 'Bihać', genitiv: 'Bihaća', lat: 44.8169, lon: 15.8708, drzava: BIH },
  { ime: 'Metković', genitiv: 'Metkovića', lat: 43.0542, lon: 17.6483, drzava: HR },
  { ime: 'Ploče', genitiv: 'Ploča', lat: 43.0569, lon: 17.4317, drzava: HR },
  { ime: 'Makarska', genitiv: 'Makarske', lat: 43.2969, lon: 17.0178, drzava: HR },
  { ime: 'Dubrovnik', genitiv: 'Dubrovnika', lat: 42.6507, lon: 18.0944, drzava: HR },
];
