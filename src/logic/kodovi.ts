/* WMO kodovi vremena koje vraća Open-Meteo, grupisani po onome što nas zanima. */

const KISA = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const SNIJEG = new Set([71, 73, 75, 77, 85, 86]);
const GRMLJAVINA = new Set([95, 96, 99]);
const MAGLA = new Set([45, 48]);

export const jeKisa = (kod: number): boolean => KISA.has(kod);
export const jeSnijeg = (kod: number): boolean => SNIJEG.has(kod);
export const jeGrmljavina = (kod: number): boolean => GRMLJAVINA.has(kod);
export const jeMagla = (kod: number): boolean => MAGLA.has(kod);

/** Bilo šta što pada s neba. */
export const jePadavina = (kod: number): boolean => jeKisa(kod) || jeSnijeg(kod) || jeGrmljavina(kod);
