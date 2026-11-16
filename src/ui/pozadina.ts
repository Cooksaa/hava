import type { Nebo } from '../logic/nebo';
import { TIHI_A, kljucPalete, paletaZa, prekrij, rgb } from './palete';

/*
 * Postavlja boje neba i stakla kao CSS varijable na <html>. Boje su registrovane
 * preko @property (styles/nebo.css), pa se promjena stanja pretapa umjesto da skoči.
 */

const trojka = (hex: string): string => rgb(hex).join(' ');

export function postaviNebo(nebo: Nebo): void {
  const p = paletaZa(nebo);
  const korijen = document.documentElement;
  const s = korijen.style;

  s.setProperty('--nebo-1', p.nebo[0]);
  s.setProperty('--nebo-2', p.nebo[1]);
  s.setProperty('--nebo-3', p.nebo[2]);
  s.setProperty('--staklo-rgb', trojka(p.staklo));
  s.setProperty('--staklo-a', String(p.stakloA));
  s.setProperty('--sjaj-rgb', trojka(p.sjaj));
  s.setProperty('--sjaj-a', String(p.sjajA));
  s.setProperty('--sjaj-y', `${p.sjajY}%`);
  s.setProperty('--polozaj', nebo.polozaj.toFixed(3));
  s.setProperty('--tihi-a', String(TIHI_A));

  // Puna boja za uređaje bez backdrop-filtera i za 'smanji prozirnost':
  // ono što staklo daje nad najsvjetlijim dijelom neba, samo neprozirno.
  const cvrsto = prekrij(rgb(p.nebo[2]), rgb(p.staklo), p.stakloA).map(Math.round);
  s.setProperty('--staklo-cvrsto', `rgb(${cvrsto.join(' ')})`);

  korijen.dataset.nebo = kljucPalete(nebo.doba, nebo.vrsta);

  // Traka preglednika i statusna traka na mobitelu prate vrh neba.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.nebo[0]);
}
