// Playwright: (ponovo) napravi telefon 390×844 @3x sa scenarijem (page.__p3, page.__fn). Treba `npm run dev` (5173).
async (page) => {
  const src = await (await page.request.get('http://localhost:5173/web/pokazno/scenarij.js?raw&v=' + Date.now())).text();
  page.__fn = eval(JSON.parse(src.replace(/^export default /, '').replace(/;?\s*$/, '')).replace(/^\s*\/\/.*$/gm, ''));
  if (page.__p3) await page.__p3.context().close().catch(() => {});
  const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'bs-BA', timezoneId: 'Europe/Sarajevo' });
  const p = await ctx.newPage();
  p.__scen = { toplije: 2, vjetar: 14, udari: 22, kisaOd: 15, kisaDo: 19, ...(page.__scenPocetni || {}) };
  await page.__fn(p);
  await p.addStyleTag({ content: '::-webkit-scrollbar{display:none} *{scrollbar-width:none}' });
  page.__p3 = p;
  const t = await p.evaluate(() => document.body.innerText);
  return t.slice(0, 40) + ' | ' + t.slice(t.indexOf('Veš'), t.indexOf('Veš') + 45);
}
