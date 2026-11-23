import { sirovo, type Sirovo } from './html';

/*
 * Ikone kao jedan SVG sprite: svaka ikona je u dokumentu jednom, a koristi se
 * preko <use>. Lista sati tako ne nosi 24 kopije istog crteža.
 *
 * Vrijeme: Meteocons, jednobojni set (MIT, Bas Milius).
 * UI: Phosphor, regular (MIT).
 */

import vedroDan from '@meteocons/svg-static/monochrome/clear-day.svg?raw';
import vedroNoc from '@meteocons/svg-static/monochrome/clear-night.svg?raw';
import pretezenoDan from '@meteocons/svg-static/monochrome/mostly-clear-day.svg?raw';
import pretezenoNoc from '@meteocons/svg-static/monochrome/mostly-clear-night.svg?raw';
import djelimicnoDan from '@meteocons/svg-static/monochrome/partly-cloudy-day.svg?raw';
import djelimicnoNoc from '@meteocons/svg-static/monochrome/partly-cloudy-night.svg?raw';
import oblacno from '@meteocons/svg-static/monochrome/overcast.svg?raw';
import maglaDan from '@meteocons/svg-static/monochrome/fog-day.svg?raw';
import maglaNoc from '@meteocons/svg-static/monochrome/fog-night.svg?raw';
import rosulja from '@meteocons/svg-static/monochrome/drizzle.svg?raw';
import kisa from '@meteocons/svg-static/monochrome/rain.svg?raw';
import jakaKisa from '@meteocons/svg-static/monochrome/extreme-rain.svg?raw';
import susnjezica from '@meteocons/svg-static/monochrome/sleet.svg?raw';
import snijeg from '@meteocons/svg-static/monochrome/snow.svg?raw';
import jakSnijeg from '@meteocons/svg-static/monochrome/extreme-snow.svg?raw';
import pljusakDan from '@meteocons/svg-static/monochrome/partly-cloudy-day-rain.svg?raw';
import pljusakNoc from '@meteocons/svg-static/monochrome/partly-cloudy-night-rain.svg?raw';
import snjezniPljusakDan from '@meteocons/svg-static/monochrome/partly-cloudy-day-snow.svg?raw';
import snjezniPljusakNoc from '@meteocons/svg-static/monochrome/partly-cloudy-night-snow.svg?raw';
import grmljavina from '@meteocons/svg-static/monochrome/thunderstorms-rain.svg?raw';
import grad from '@meteocons/svg-static/monochrome/thunderstorms-hail.svg?raw';

import majica from '@phosphor-icons/core/assets/regular/t-shirt.svg?raw';
import auto from '@phosphor-icons/core/assets/regular/car-profile.svg?raw';
import dron from '@phosphor-icons/core/assets/regular/drone.svg?raw';
import lupa from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw';
import lokacija from '@phosphor-icons/core/assets/regular/navigation-arrow.svg?raw';
import zatvori from '@phosphor-icons/core/assets/regular/x.svg?raw';
import osvjezi from '@phosphor-icons/core/assets/regular/arrow-clockwise.svg?raw';
import strelica from '@phosphor-icons/core/assets/regular/caret-right.svg?raw';
import kap from '@phosphor-icons/core/assets/fill/drop-fill.svg?raw';
import smjer from '@phosphor-icons/core/assets/fill/navigation-arrow-fill.svg?raw';
import upozorenje from '@phosphor-icons/core/assets/fill/warning-fill.svg?raw';
import mapa from '@phosphor-icons/core/assets/regular/map-trifold.svg?raw';
import pusti from '@phosphor-icons/core/assets/fill/play-fill.svg?raw';
import pauza from '@phosphor-icons/core/assets/fill/pause-fill.svg?raw';
import zvono from '@phosphor-icons/core/assets/regular/bell-ringing.svg?raw';

const VRIJEME = {
  'vedro-dan': vedroDan,
  'vedro-noc': vedroNoc,
  'pretezno-dan': pretezenoDan,
  'pretezno-noc': pretezenoNoc,
  'djelimicno-dan': djelimicnoDan,
  'djelimicno-noc': djelimicnoNoc,
  oblacno,
  'magla-dan': maglaDan,
  'magla-noc': maglaNoc,
  rosulja,
  kisa,
  'jaka-kisa': jakaKisa,
  susnjezica,
  snijeg,
  'jak-snijeg': jakSnijeg,
  'pljusak-dan': pljusakDan,
  'pljusak-noc': pljusakNoc,
  'snjezni-pljusak-dan': snjezniPljusakDan,
  'snjezni-pljusak-noc': snjezniPljusakNoc,
  grmljavina,
  grad,
} as const;

const UI = {
  majica,
  auto,
  dron,
  lupa,
  lokacija,
  zatvori,
  osvjezi,
  strelica,
  kap,
  smjer,
  upozorenje,
  mapa,
  pusti,
  pauza,
  zvono,
} as const;

export type IkonaVremena = keyof typeof VRIJEME;
export type IkonaUi = keyof typeof UI;

/** WMO kod → ikona. */
export function ikonaZaKod(kod: number, dan: boolean): IkonaVremena {
  const d = dan ? 'dan' : 'noc';
  switch (kod) {
    case 0:
      return `vedro-${d}`;
    case 1:
      return `pretezno-${d}`;
    case 2:
      return `djelimicno-${d}`;
    case 3:
      return 'oblacno';
    case 45:
    case 48:
      return `magla-${d}`;
    case 51:
    case 53:
    case 55:
      return 'rosulja';
    case 56:
    case 57:
    case 66:
    case 67:
      return 'susnjezica';
    case 61:
    case 63:
      return 'kisa';
    case 65:
    case 82:
      return 'jaka-kisa';
    case 71:
    case 73:
    case 77:
      return 'snijeg';
    case 75:
      return 'jak-snijeg';
    case 80:
    case 81:
      return `pljusak-${d}`;
    case 85:
    case 86:
      return `snjezni-pljusak-${d}`;
    case 95:
      return 'grmljavina';
    case 96:
    case 99:
      return 'grad';
    default:
      return 'oblacno';
  }
}

function uSimbol(id: string, svg: string): string {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 24 24';
  const unutra = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<symbol id="${id}" viewBox="${viewBox}">${unutra}</symbol>`;
}

/** Jednom, na početku: ubaci sprite u dokument. */
export function ubaciIkone(): void {
  if (document.getElementById('ikone')) return;
  const simboli = [
    ...Object.entries(VRIJEME).map(([ime, svg]) => uSimbol(`v-${ime}`, svg)),
    ...Object.entries(UI).map(([ime, svg]) => uSimbol(`u-${ime}`, svg)),
  ].join('');
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<svg id="ikone" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">${simboli}</svg>`,
  );
}

/** Ikona vremena. Čisto ukrasna: tekst pored nje uvijek kaže isto. */
export const ikonaVremena = (ime: IkonaVremena, klasa = ''): Sirovo =>
  sirovo(`<svg class="ikona ikona--vrijeme ${klasa}" aria-hidden="true"><use href="#v-${ime}"/></svg>`);

export const ikonaUi = (ime: IkonaUi, klasa = ''): Sirovo =>
  sirovo(`<svg class="ikona ikona--ui ${klasa}" aria-hidden="true"><use href="#u-${ime}"/></svg>`);
