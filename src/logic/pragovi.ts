/*
 * Svi pragovi "može / ne može" na jednom mjestu.
 * Ovo su početne vrijednosti iz faze 0. Podešavaju se kad majka i raja probaju.
 */
export const PRAGOVI = {
  ves: {
    /** Prije ovog sata se ne prostire. */
    pocetakDana: 7,
    /** Veš se sklanja ovoliko sati prije zalaska (rosa). */
    prijeZalaska: 1,
    /** Koliko traje program u mašini, sati. */
    trajanjeMasine: 2,
    /** Sat se računa kao kišni od ove vjerovatnoće (%) ili količine (mm). */
    kisaVjer: 35,
    kisaMm: 0.1,
    /** Od ove vlage (%) se ništa ne suši. */
    vlaga: 90,
    /** Koliko sati treba vešu u "običnim" uslovima: 15°, 60% vlage, bez vjetra, oblačno. */
    baznoSati: 5,
    /** Granice brzine sušenja: 2.5 znači najmanje 2 sata, 0.25 najviše 20. */
    minBrzina: 0.25,
    maxBrzina: 2.5,
  },
  kisa: {
    /** "Pada li u…?" gleda ovoliko sati unaprijed. */
    prozorSati: 12,
    vjer: 40,
    mm: 0.2,
  },
  nebo: {
    /** Koliko minuta prije i poslije izlaska/zalaska traje boja zore i sutona. */
    sutonMin: 40,
  },
} as const;
