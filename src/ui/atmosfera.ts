import { jeGrmljavina, jeKisa, jeMagla, jeSnijeg } from '../logic/kodovi';

/*
 * Živo nebo: kiša, snijeg, oblaci, zvijezde, munje. Jedan <canvas> iza kartica.
 *
 * - Crta ~30 sličica u sekundi, i staje kad aplikacija nije na ekranu.
 * - "Smanji pokrete" u telefonu: jedna mirna slika (oblaci, zvijezde), bez kiše i bljeskova.
 * - Ako telefon ne stiže (sličice kasne), animacija se sama zaustavi na mirnoj slici.
 * - Prelaz između stanja je prirodan: nove kapi počnu padati odozgo, stare dopadnu do dna.
 */

export interface Atmosfera {
  postavi(kod: number, noc: boolean): void;
}

interface Kap { x: number; y: number; duz: number; brz: number; a: number }
interface Pahulja { x: number; y: number; r: number; brz: number; faza: number }
interface Zvijezda { x: number; y: number; r: number; faza: number; brz: number }
interface Oblak { x: number; y: number; s: number; brz: number; a: number }

interface Cilj {
  kapi: number;
  pahulje: number;
  zvijezde: boolean;
  oblaci: number;
  magla: boolean;
  munje: boolean;
}

/** Koliko jako pada, po WMO kodu (1 = obična kiša). */
const JACINA: Record<number, number> = {
  51: 0.3, 53: 0.4, 55: 0.5, 56: 0.4, 57: 0.6,
  61: 0.5, 63: 0.8, 65: 1.15, 66: 0.6, 67: 0.9,
  80: 0.6, 81: 0.9, 82: 1.25,
  71: 0.5, 73: 0.8, 75: 1.1, 77: 0.4, 85: 0.6, 86: 1,
  95: 1, 96: 1.1, 99: 1.2,
};

export function ciljZa(kod: number, noc: boolean): Cilj {
  const jacina = JACINA[kod] ?? 0;
  const snijeg = jeSnijeg(kod);
  const pada = jeKisa(kod) || jeGrmljavina(kod);
  return {
    kapi: pada ? Math.round(110 * jacina) : 0,
    pahulje: snijeg ? Math.round(90 * jacina) : 0,
    zvijezde: noc && kod <= 2,
    oblaci: pada || snijeg ? 7 : kod === 3 ? 6 : kod === 2 ? 4 : kod === 1 ? 2 : 0,
    magla: jeMagla(kod),
    munje: jeGrmljavina(kod),
  };
}

const SLICICA_MS = 33;
/** Ako je prosječna sličica sporija od ovoga, telefon ne stiže. */
const SPORO_MS = 55;
const NAGIB = 0.14;

const slucajno = (od: number, do_: number): number => od + Math.random() * (do_ - od);

/** Mekani oblak, nacrtan jednom pa se samo kopira (jeftino). */
function sablonOblaka(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  if (!g) return c;
  const mrlja = (x: number, y: number, r: number): void => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 128);
  };
  mrlja(90, 72, 60);
  mrlja(140, 58, 58);
  mrlja(180, 76, 48);
  mrlja(120, 82, 56);
  return c;
}

export function stvoriAtmosferu(roditelj: HTMLElement): Atmosfera {
  const platno = document.createElement('canvas');
  platno.className = 'atmosfera';
  platno.setAttribute('aria-hidden', 'true');
  roditelj.append(platno);
  const g = platno.getContext('2d');
  if (!g) return { postavi() {} };

  const mirno = matchMedia('(prefers-reduced-motion: reduce)');
  const oblak = sablonOblaka();

  let s = 1; // gustina piksela
  let w = 0;
  let h = 0;
  let cilj: Cilj = ciljZa(0, false);
  let noc = false;
  const kapi: Kap[] = [];
  const pahulje: Pahulja[] = [];
  let zvijezde: Zvijezda[] = [];
  let oblaci: Oblak[] = [];
  let bljesak = { od: 0, sljedeci: 0 };

  let okvir = 0;
  let zadnje = 0;
  let sporih = 0;
  let mjerenih = 0;
  let stedi = false;

  function velicina(): void {
    s = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.round(platno.clientWidth * s);
    h = Math.round(platno.clientHeight * s);
    platno.width = w;
    platno.height = h;
    zvijezde = Array.from({ length: Math.round((w * h) / (9000 * s * s)) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.5,
      r: slucajno(0.5, 1.3) * s,
      faza: Math.random() * Math.PI * 2,
      brz: slucajno(0.4, 1.2),
    }));
    oblaci = [];
  }

  const novaKap = (gore: boolean): Kap => ({
    x: Math.random() * (w + h * NAGIB),
    y: gore ? slucajno(-h * 0.3, 0) : Math.random() * h,
    duz: slucajno(12, 26) * s,
    brz: slucajno(700, 1000) * s,
    a: slucajno(0.16, 0.38),
  });

  const novaPahulja = (gore: boolean): Pahulja => ({
    x: Math.random() * w,
    y: gore ? slucajno(-40, 0) * s : Math.random() * h,
    r: slucajno(1, 2.6) * s,
    brz: slucajno(30, 70) * s,
    faza: Math.random() * Math.PI * 2,
  });

  function uskladiOblake(): void {
    const n = cilj.magla ? 6 : cilj.oblaci;
    while (oblaci.length < n) {
      const magla = cilj.magla;
      oblaci.push({
        x: Math.random() * w,
        y: magla ? slucajno(0.35, 0.85) * h : slucajno(-0.05, 0.4) * h,
        s: (magla ? slucajno(3, 4.5) : slucajno(1.4, 2.6)) * s,
        brz: slucajno(5, 12) * s,
        a: magla ? slucajno(0.05, 0.09) : slucajno(0.04, 0.09),
      });
    }
    oblaci.length = Math.min(oblaci.length, n);
  }

  function crtaj(t: number, dt: number, mirna: boolean): void {
    g!.clearRect(0, 0, w, h);

    // Oblaci: noću tamniji, da ne svijetle.
    g!.globalAlpha = 1;
    for (const o of oblaci) {
      if (!mirna) {
        o.x += o.brz * dt;
        if (o.x - 128 * o.s > w) o.x = -128 * o.s;
      }
      g!.globalAlpha = o.a * (noc ? 0.55 : 1);
      g!.drawImage(oblak, o.x - 128 * o.s, o.y - 64 * o.s, 256 * o.s, 128 * o.s);
    }

    if (cilj.zvijezde) {
      g!.fillStyle = '#fff';
      for (const z of zvijezde) {
        g!.globalAlpha = mirna ? 0.45 : 0.3 + 0.3 * Math.sin(t / 1000 * z.brz + z.faza);
        g!.beginPath();
        g!.arc(z.x, z.y, z.r, 0, Math.PI * 2);
        g!.fill();
      }
    }

    if (!mirna) {
      // Kiša: nove kapi kreću odozgo dok se ne dostigne cilj; višak samo dopadne.
      if (kapi.length < cilj.kapi) kapi.push(...Array.from({ length: Math.min(4, cilj.kapi - kapi.length) }, () => novaKap(true)));
      g!.lineWidth = s;
      g!.lineCap = 'round';
      g!.strokeStyle = 'rgb(205 222 255)';
      for (let i = kapi.length - 1; i >= 0; i--) {
        const k = kapi[i]!;
        k.y += k.brz * dt;
        k.x -= k.brz * dt * NAGIB;
        if (k.y - k.duz > h) {
          if (kapi.length > cilj.kapi) kapi.splice(i, 1);
          else Object.assign(k, novaKap(true));
          continue;
        }
        g!.globalAlpha = k.a;
        g!.beginPath();
        g!.moveTo(k.x, k.y);
        g!.lineTo(k.x + k.duz * NAGIB, k.y - k.duz);
        g!.stroke();
      }

      if (pahulje.length < cilj.pahulje) pahulje.push(...Array.from({ length: Math.min(3, cilj.pahulje - pahulje.length) }, () => novaPahulja(true)));
      g!.fillStyle = '#fff';
      for (let i = pahulje.length - 1; i >= 0; i--) {
        const p = pahulje[i]!;
        p.y += p.brz * dt;
        p.faza += dt * 1.3;
        const x = p.x + Math.sin(p.faza) * 12 * s;
        if (p.y - p.r > h) {
          if (pahulje.length > cilj.pahulje) pahulje.splice(i, 1);
          else Object.assign(p, novaPahulja(true));
          continue;
        }
        g!.globalAlpha = 0.55;
        g!.beginPath();
        g!.arc(x, p.y, p.r, 0, Math.PI * 2);
        g!.fill();
      }

      // Munja: rijetko i blago (najviše jedan dvostruki bljesak u 6–14 s).
      if (cilj.munje) {
        if (!bljesak.sljedeci) bljesak.sljedeci = t + slucajno(3000, 8000);
        if (t >= bljesak.sljedeci) {
          bljesak = { od: t, sljedeci: t + slucajno(6000, 14000) };
        }
        const proslo = t - bljesak.od;
        const jacina = proslo < 80 ? 0.16 : proslo < 160 ? 0.04 : proslo < 230 ? 0.1 : proslo < 380 ? 0.1 * (1 - (proslo - 230) / 150) : 0;
        if (jacina > 0) {
          g!.globalAlpha = jacina;
          g!.fillStyle = '#e8eeff';
          g!.fillRect(0, 0, w, h);
        }
      }
    }
    g!.globalAlpha = 1;
  }

  function korak(t: number): void {
    okvir = requestAnimationFrame(korak);
    const proslo = t - zadnje;
    if (proslo < SLICICA_MS - 2) return;

    // Prvih ~3 s se mjeri da li telefon stiže.
    if (zadnje && mjerenih < 90) {
      mjerenih++;
      if (proslo > SPORO_MS) sporih++;
      if (mjerenih === 90 && sporih > 45) {
        stedi = true;
        zaustavi();
        crtaj(t, 0, true);
        return;
      }
    }
    const dt = zadnje ? Math.min(proslo, 100) / 1000 : 0;
    zadnje = t;
    crtaj(t, dt, false);
    // Sve je dopalo, a nema ničega što se kreće: nema potrebe crtati dalje.
    if (!kapi.length && !pahulje.length && !imaPokreta()) zaustavi();
  }

  function imaPokreta(): boolean {
    return Boolean(cilj.kapi || cilj.pahulje || cilj.oblaci || cilj.magla || cilj.zvijezde || cilj.munje);
  }

  function zaustavi(): void {
    cancelAnimationFrame(okvir);
    okvir = 0;
    zadnje = 0;
  }

  function pokreni(): void {
    zaustavi();
    const mirna = mirno.matches || stedi;
    if (mirna || document.hidden || !(imaPokreta() || kapi.length || pahulje.length)) {
      crtaj(performance.now(), 0, true);
      return;
    }
    okvir = requestAnimationFrame(korak);
  }

  velicina();
  window.addEventListener('resize', () => {
    velicina();
    uskladiOblake();
    pokreni();
  });
  document.addEventListener('visibilitychange', pokreni);
  mirno.addEventListener('change', pokreni);

  return {
    postavi(kod: number, jeNoc: boolean) {
      cilj = ciljZa(kod, jeNoc);
      noc = jeNoc;
      if (!cilj.munje) bljesak = { od: 0, sljedeci: 0 };
      // Pri prvom crtanju kiša već pada po cijelom ekranu, ne kreće tek od vrha.
      if (!kapi.length && cilj.kapi) kapi.push(...Array.from({ length: cilj.kapi }, () => novaKap(false)));
      if (!pahulje.length && cilj.pahulje) pahulje.push(...Array.from({ length: cilj.pahulje }, () => novaPahulja(false)));
      uskladiOblake();
      pokreni();
    },
  };
}
