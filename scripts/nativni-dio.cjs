// Ispiše nativne pakete (Capacitor i dodaci) iz package.json sa stdin-a, jedan red.
// Koristi .github/workflows/apk.yml: ako se ovo promijeni, treba novi APK (hava.minApk).
let ulaz = '';
process.stdin.on('data', (d) => (ulaz += d));
process.stdin.on('end', () => {
  const p = JSON.parse(ulaz);
  const svi = { ...p.dependencies, ...p.devDependencies };
  const nativni = Object.keys(svi)
    .filter((ime) => /^@(capacitor|capgo)\//.test(ime) && !/\/(cli|assets)$/.test(ime))
    .sort()
    .map((ime) => `${ime}@${svi[ime]}`);
  console.log(nativni.join(' '));
});
