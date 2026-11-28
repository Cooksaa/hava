# Hava promo video (9:16, 25 s, petlja)

- `scena.html`: scena; `setT(t)` crta kadar u trenutku t (sekunde). Ekrani su pravi, iz `web/pokazno/ekran-*.png`.
- Ekrani: `web/pokazno/scenarij.js` (Playwright) presretne Open-Meteo i prepiše sate po scenariju (sunčano jutro, kiša od 15h) uz namješten sat 7:40. Aplikacija se ne mijenja. `kontekst.js` pravi telefon 390×844 @3x.
- Snimanje kadrova: `npm run dev`, pa u Playwrightu za svaki f od 0 do 749: `setT(f / 30)` i screenshot 1080×1920 u `okviri/f%04d.jpg` (JPEG 92).
- Zvuk (samo ffmpeg, bez instalacija): harmonija A-dur pa G-dur na kraju, kratki ton kad iskoči odgovor (1.25, 6.75, 11.55, 16.45, 20.7 s), šum kiše 13–20 s, `loudnorm I=-18`. Komanda je u istoriji commita / sesije; rezultat `zvuk.wav`.
- Spajanje:
  - `ffmpeg -framerate 30 -i okviri/f%04d.jpg -i zvuk.wav -c:v libx264 -crf 19 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart Hava-promo-9x16.mp4`
  - za stranicu 720×1280: `-vf scale=720:1280 -crf 21`, poster je kadar na 3 s.

`okviri/`, `*.mp4`, `*.jpg` i `zvuk.wav` nisu u repou (prave se ponovo).
