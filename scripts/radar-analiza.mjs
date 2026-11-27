// Zbir provjera radara (radar/*.jsonl iz grane "podaci"): koliko kiše pogodi i
// koliko lažnih uzbuna, po vremenu unaprijed, za nowcast i za "kiša stoji".
//   node radar-analiza.mjs [dana=7]
import { readdirSync, readFileSync } from 'node:fs';

const DANA = Number(process.argv[2] ?? 7);
const od = Date.now() - DANA * 864e5;
const zbir = {};
let pokretanja = 0;
for (const f of readdirSync('radar').filter((x) => x.endsWith('.jsonl'))) {
  for (const linija of readFileSync(`radar/${f}`, 'utf8').split('\n')) {
    if (!linija.trim()) continue;
    const r = JSON.parse(linija);
    if (Date.parse(r.vrijeme) < od) continue;
    pokretanja++;
    for (const [nacin, po] of Object.entries(r.rez)) {
      for (const [lead, s] of Object.entries(po)) {
        const z = ((zbir[nacin] ??= {})[lead] ??= { h: 0, m: 0, f: 0, c: 0 });
        for (const k of ['h', 'm', 'f', 'c']) z[k] += s[k];
      }
    }
  }
}
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '—');
console.log(`### Radar minut po minut, zadnjih ${DANA} dana (${pokretanja} provjera)\n`);
console.log('| Unaprijed | Način | Pogođena kiša | Lažna uzbuna | CSI | Slučajeva kiše |\n|---|---|---|---|---|---|');
for (const lead of Object.keys(zbir.nowcast ?? {}).sort((a, b) => a - b)) {
  for (const nacin of ['nowcast', 'stoji']) {
    const s = zbir[nacin]?.[lead];
    if (!s) continue;
    console.log(`| ${lead} min | ${nacin} | ${pct(s.h, s.h + s.m)} | ${pct(s.f, s.h + s.f)} | ${pct(s.h, s.h + s.m + s.f)} | ${s.h + s.m} |`);
  }
}
