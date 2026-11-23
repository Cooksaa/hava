import { defineConfig } from 'vite';

/*
 * Provjera u pozadini (src/pozadina/pozadina.ts) kao jedan običan JS fajl.
 * Background Runner ga čita iz APK-a (assets/public/runners/pozadina.js), u malom
 * JS okruženju bez modula: zato IIFE i stariji JavaScript.
 * Gradi se poslije glavnog builda, u isti dist (npm run android).
 */
export default defineConfig({
  build: {
    outDir: 'dist/runners',
    emptyOutDir: false,
    target: 'es2019',
    minify: true,
    copyPublicDir: false,
    lib: {
      entry: 'src/pozadina/pozadina.ts',
      formats: ['iife'],
      name: 'HavaPozadina',
      fileName: () => 'pozadina.js',
    },
  },
});
