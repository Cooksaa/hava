import type { CapacitorConfig } from '@capacitor/cli';

/*
 * Android (kasnije i iOS) aplikacija. Isti kod kao web verzija, zapakovan u
 * pravu aplikaciju. Gradi se sa `npm run android`, a APK pravi GitHub
 * (.github/workflows/apk.yml).
 */
const config: CapacitorConfig = {
  // Trajni ID. Kad app ode na Play Store, ovo se više nikad ne mijenja.
  appId: 'io.github.cooksaa.hava',
  appName: 'Hava',
  webDir: 'dist',
  android: {
    // Boja iza aplikacije dok se učitava: noćno nebo, kao na webu.
    backgroundColor: '#0a1322',
  },
  plugins: {
    SystemBars: {
      // Ubacuje prave vrijednosti sigurnih zona (izrez za kameru, traka za navigaciju),
      // i na starijim Android WebView verzijama gdje env(safe-area-inset-*) ne radi.
      insetsHandling: 'css',
      // index.html ima viewport-fit=cover: app ide do rubova ekrana.
      initialViewportFitValueHint: 'cover',
      // Gornji dio neba je uvijek taman, pa su ikone statusne trake svijetle.
      style: 'DARK',
    },
    // Ažuriranje web dijela bez novog APK-a (src/android.ts). Sami biramo kad i šta:
    // paket dolazi s GitHub izdanja. Prazne adrese = nikakvi upiti ni statistika
    // prema Capgo serverima.
    // Provjera u pozadini za obavijesti (src/pozadina, gradi se u dist/runners).
    // Android je pokreće otprilike svakih 15 minuta, i kad je aplikacija zatvorena.
    BackgroundRunner: {
      label: 'io.github.cooksaa.hava.provjera',
      src: 'runners/pozadina.js',
      event: 'provjeri',
      repeat: true,
      interval: 15,
      autoStart: true,
    },
    CapacitorUpdater: {
      autoUpdate: 'off',
      updateUrl: '',
      statsUrl: '',
      channelUrl: '',
    },
  },
};

export default config;
