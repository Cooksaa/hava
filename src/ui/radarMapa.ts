import type { GeoJSONSource, Map as Karta, ImageSource } from 'maplibre-gl';
import { lonLat, okviriZaMapu, type Okvir, type Radar } from '../api/radar';
import { bojaKise } from '../logic/radar';
import type { Mjesto } from '../tipovi';
import { html } from './html';
import { ikonaUi } from './ikone';

/*
 * Radar na mapi, preko cijelog ekrana.
 *
 * Prošlost: snimci RainViewera za zadnji sat (svakih 10 min), kao slojevi mape.
 * Budućnost: naš zadnji snimak oko mjesta, pomjeren onako kako se kiša kreće
 * (isto kao "Kiša u naredna 2 sata"), do sat vremena unaprijed. Dalje se ne crta:
 * provjera unazad kaže da poslije sata to više nije prognoza nego nagađanje.
 *
 * Mapa (MapLibre, ~250 kB) se učitava tek kad se radar prvi put otvori.
 * Podloga: OpenFreeMap (OpenStreetMap), tamna, prebojena u boje aplikacije.
 */

const STIL = 'https://tiles.openfreemap.org/styles/dark';
const KORAK_MS = 550;
/** Na zadnjem snimku i na kraju animacija zastane, da se vidi gdje smo. */
const ZASTANI_MS = 1400;
const BUDUCE_MIN = [10, 20, 30, 40, 50, 60];

interface Kadar {
  sloj: string;
  vrijeme: number;
  vrsta: 'proslo' | 'snimak' | 'buduce';
}

export interface RadarMapa {
  otvori(m: Mjesto, radar: Radar | null): void;
}

const satMin = (ms: number): string =>
  new Date(ms).toLocaleTimeString('bs-BA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Sarajevo',
  });

function opisKadra(k: Kadar, sad: number): string {
  const min = Math.round((k.vrijeme - sad) / 60_000 / 5) * 5;
  if (k.vrsta === 'snimak') return 'zadnji snimak';
  if (k.vrsta === 'buduce') return min <= 0 ? 'prognoza, sad' : `prognoza, za ${min} min`;
  return `prije ${-min} min`;
}

/** Zadnji snimak pomjeren za `minuta` minuta kretanja, kao slika (data URL). */
function buduciKadar(r: Radar, minuta: number): string {
  const { polje, kretanje } = r;
  const s = polje.sirina;
  const v = polje.visina;
  const platno = document.createElement('canvas');
  platno.width = s;
  platno.height = v;
  const ctx = platno.getContext('2d');
  if (!ctx || !kretanje) return '';
  const slika = ctx.createImageData(s, v);
  const dx = kretanje.vx * minuta;
  const dy = kretanje.vy * minuta;
  for (let y = 0; y < v; y++) {
    const sy = Math.round(y - dy);
    if (sy < 0 || sy >= v) continue;
    for (let x = 0; x < s; x++) {
      const sx = Math.round(x - dx);
      if (sx < 0 || sx >= s) continue;
      const i = sy * s + sx;
      const boja = bojaKise(polje.kisa[i]!, polje.snijeg[i] === 1);
      if (!boja) continue;
      const j = (y * s + x) * 4;
      slika.data[j] = boja[0];
      slika.data[j + 1] = boja[1];
      slika.data[j + 2] = boja[2];
      slika.data[j + 3] = 255;
    }
  }
  ctx.putImageData(slika, 0, 0);
  return platno.toDataURL();
}

export function stvoriRadarMapu(): RadarMapa {
  const dijalog = document.createElement('dialog');
  dijalog.className = 'mapa';
  dijalog.setAttribute('aria-label', 'Radar padavina');
  dijalog.innerHTML = html`
    <div class="mapa__karta"></div>
    <div class="mapa__vrh">
      <div class="podloga mapa__vrijeme" aria-live="polite">
        <strong class="broj" data-vrijeme></strong>
        <span data-opis>Učitavam radar</span>
      </div>
      <button class="okruglo mapa__dugme" type="button" data-zatvori-mapu aria-label="Zatvori radar">
        ${ikonaUi('zatvori')}
      </button>
    </div>
    <div class="podloga mapa__dno">
      <button class="okruglo mapa__dugme" type="button" data-pusti aria-label="Pusti">${ikonaUi('pusti')}</button>
      <div class="mapa__vremenska">
        <input class="mapa__klizac" type="range" min="0" max="0" value="0" step="1" aria-label="Vrijeme snimka" />
        <div class="mapa__oznake broj" aria-hidden="true"><span>−1 h</span><span>sad</span><span>+1 h</span></div>
      </div>
    </div>
  `.html;
  document.body.append(dijalog);

  const kartaEl = dijalog.querySelector('.mapa__karta') as HTMLElement;
  const vrijemeEl = dijalog.querySelector('[data-vrijeme]') as HTMLElement;
  const opisEl = dijalog.querySelector('[data-opis]') as HTMLElement;
  const klizac = dijalog.querySelector('.mapa__klizac') as HTMLInputElement;
  const pustiEl = dijalog.querySelector('[data-pusti]') as HTMLButtonElement;
  const mirno = matchMedia('(prefers-reduced-motion: reduce)');

  let karta: Karta | null = null;
  let kadrovi: Kadar[] = [];
  let tekuci = 0;
  let tajmer: ReturnType<typeof setTimeout> | null = null;

  const prikazi = (i: number): void => {
    if (!karta || !kadrovi.length) return;
    tekuci = Math.max(0, Math.min(kadrovi.length - 1, i));
    kadrovi.forEach((k, j) => {
      if (karta!.getLayer(k.sloj)) karta!.setPaintProperty(k.sloj, 'raster-opacity', j === tekuci ? 0.8 : 0);
    });
    const k = kadrovi[tekuci]!;
    vrijemeEl.textContent = satMin(k.vrijeme);
    opisEl.textContent = opisKadra(k, Date.now());
    dijalog.dataset.buduce = String(k.vrsta === 'buduce');
    klizac.value = String(tekuci);
  };

  const stani = (): void => {
    if (tajmer) clearTimeout(tajmer);
    tajmer = null;
    pustiEl.innerHTML = ikonaUi('pusti').html;
    pustiEl.setAttribute('aria-label', 'Pusti');
  };

  const pusti = (): void => {
    stani();
    pustiEl.innerHTML = ikonaUi('pauza').html;
    pustiEl.setAttribute('aria-label', 'Zaustavi');
    const dalje = (): void => {
      const k = kadrovi[tekuci];
      const zadnji = tekuci === kadrovi.length - 1;
      tajmer = setTimeout(
        () => {
          prikazi(zadnji ? 0 : tekuci + 1);
          dalje();
        },
        zadnji || k?.vrsta === 'snimak' ? ZASTANI_MS : KORAK_MS
      );
    };
    dalje();
  };

  pustiEl.addEventListener('click', () => (tajmer ? stani() : pusti()));
  klizac.addEventListener('input', () => {
    stani();
    prikazi(Number(klizac.value));
  });
  dijalog.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-zatvori-mapu]')) dijalog.close();
  });
  dijalog.addEventListener('close', stani);

  async function napuni(m: Mjesto, radar: Radar | null): Promise<void> {
    const [maplibregl, { default: radnik }, okviri] = await Promise.all([
      import('maplibre-gl'),
      // Radnik (worker) mape kao zaseban fajl: MapLibre ga inače traži pored sebe, a Vite ga premjesti.
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
      okviriZaMapu(),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ]);

    if (maplibregl.getWorkerUrl() !== radnik) maplibregl.setWorkerUrl(radnik);
    const nova = !karta;
    const kt: Karta =
      karta ??
      new maplibregl.Map({
        container: kartaEl,
        style: STIL,
        center: [m.lon, m.lat],
        zoom: 6.4,
        minZoom: 4,
        maxZoom: 9,
        attributionControl: {
          compact: true,
          customAttribution: 'Radar: <a href="https://www.rainviewer.com/">RainViewer</a>',
        },
        dragRotate: false,
        pitchWithRotate: false,
      });
    karta = kt;
    if (import.meta.env.DEV) (window as unknown as { __karta: Karta }).__karta = kt;
    if (nova) {
      kt.touchZoomRotate.disableRotation();
      await new Promise<void>((r) => kt.once('load', () => r()));
      // Podloga u bojama aplikacije: noćno plava, voda malo svjetlija.
      for (const s of kt.getStyle().layers) {
        if (s.type === 'background') kt.setPaintProperty(s.id, 'background-color', '#0b1524');
        else if (s.type === 'fill' && s.id.includes('water')) kt.setPaintProperty(s.id, 'fill-color', '#12233a');
        // Imena na našem jeziku i latinicom ("Bosna i Hercegovina", ne "Bosnia and Herzegovina" ili "Црна Гора").
        else if (s.type === 'symbol' && s.layout?.['text-field']) {
          kt.setLayoutProperty(s.id, 'text-field', [
            'coalesce',
            ['get', 'name:bs'],
            ['get', 'name:hr'],
            ['get', 'name:sr-Latn'],
            ['get', 'name:latin'],
            ['get', 'name'],
          ]);
        }
      }
      // Izvori mape: sklopljeni u "i", da ne prekrivaju klizač.
      kartaEl.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      kt.addSource('ja', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      kt.addLayer({
        id: 'ja-krug',
        type: 'circle',
        source: 'ja',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#0b1524',
        },
      });
    } else {
      kt.jumpTo({ center: [m.lon, m.lat] });
    }
    kt.resize();
    (kt.getSource('ja') as GeoJSONSource).setData({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
      properties: {},
    });

    // Stari slojevi kiše van (snimci se mijenjaju svakih 10 min).
    for (const k of kadrovi) {
      if (kt.getLayer(k.sloj)) kt.removeLayer(k.sloj);
      if (kt.getSource(k.sloj)) kt.removeSource(k.sloj);
    }
    kadrovi = [];

    // Kiša ispod imena mjesta: prvi sloj s tekstom.
    const ispod = kt.getStyle().layers.find((s) => s.type === 'symbol')?.id;
    const dodaj = (id: string, izvor: Parameters<Karta['addSource']>[1]): void => {
      kt.addSource(id, izvor);
      kt.addLayer(
        {
          id,
          type: 'raster',
          source: id,
          paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 },
        },
        ispod
      );
    };

    if (okviri) {
      okviri.okviri.forEach((o: Okvir, i) => {
        const id = `radar-${o.time}`;
        dodaj(id, {
          type: 'raster',
          // 512 px slike: upola manje upita od 256 (RainViewer dozvoljava ~100 u minuti).
          tiles: [`${okviri.host}${o.path}/512/{z}/{x}/{y}/2/1_1.png`],
          tileSize: 512,
          maxzoom: 7,
        });
        kadrovi.push({
          sloj: id,
          vrijeme: o.time * 1000,
          vrsta: i === okviri.okviri.length - 1 ? 'snimak' : 'proslo',
        });
      });
    }

    if (radar?.kretanje && okviri) {
      const s = radar.polje.sirina;
      const v = radar.polje.visina;
      const uglovi = [
        lonLat(radar.x0, radar.y0, radar.zoom),
        lonLat(radar.x0 + s, radar.y0, radar.zoom),
        lonLat(radar.x0 + s, radar.y0 + v, radar.zoom),
        lonLat(radar.x0, radar.y0 + v, radar.zoom),
      ] as [[number, number], [number, number], [number, number], [number, number]];
      for (const min of BUDUCE_MIN) {
        const id = `radar-za-${min}`;
        dodaj(id, {
          type: 'image',
          url: buduciKadar(radar, min),
          coordinates: uglovi,
        });
        (kt.getSource(id) as ImageSource | undefined)?.setCoordinates(uglovi);
        kadrovi.push({
          sloj: id,
          vrijeme: radar.snimak + min * 60_000,
          vrsta: 'buduce',
        });
      }
    }

    klizac.max = String(Math.max(0, kadrovi.length - 1));
    const snimak = kadrovi.findIndex((k) => k.vrsta === 'snimak');
    if (!kadrovi.length) {
      vrijemeEl.textContent = '';
      opisEl.textContent = 'Radar trenutno ne odgovara.';
      return;
    }
    if (mirno.matches) prikazi(snimak);
    else {
      prikazi(0);
      pusti();
    }
  }

  return {
    otvori(m, radar) {
      if (!dijalog.open) dijalog.showModal();
      opisEl.textContent = 'Učitavam radar';
      vrijemeEl.textContent = '';
      void napuni(m, radar).catch(() => {
        opisEl.textContent = 'Mapa se nije učitala. Provjeri internet.';
      });
    },
  };
}
