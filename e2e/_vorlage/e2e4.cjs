const { chromium, devices } = require('playwright');
const SP = __dirname;
const URL = 'http://localhost:4173/';
const errors = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', (d) => d.accept());
  const shot = (n) => page.screenshot({ path: `${SP}/shots/${n}.png` });
  const main = page.locator('.main');

  await page.goto(URL + '#/neu');
  await page.getByLabel('Bezeichnung *').fill('Heizung Müller');
  await page.getByRole('button', { name: 'Heizung', exact: true }).click();
  await page.getByRole('button', { name: 'Baustelle anlegen' }).click();
  await page.getByRole('link', { name: 'Stunden', exact: true }).click();

  // Doppeltipp auf Speichern
  await page.getByRole('button', { name: 'Stunden eintragen' }).click();
  await page.getByLabel('… oder Stunden direkt').fill('3');
  await page.getByRole('button', { name: 'Speichern', exact: true }).dblclick();
  await page.locator('.sheet').waitFor({ state: 'detached' });
  await page.waitForTimeout(300);
  ok((await main.locator('.rows li').count()) === 1, 'Doppeltipp auf Speichern erzeugt nur einen Eintrag');

  // Vergessener Timer (seit 20 h)
  await page.getByRole('button', { name: 'Start' }).click();
  await main.getByText('Zeit läuft', { exact: true }).waitFor();
  await page.evaluate(() => new Promise((r) => { const q = indexedDB.open('baustellenbuch'); q.onsuccess = () => { const t = q.result.transaction('settings', 'readwrite'); const s = t.objectStore('settings'); const g = s.get('timer'); g.onsuccess = () => { const v = g.result; v.value.start = Date.now() - 20 * 3600000; s.put(v); }; t.oncomplete = r; }; }));
  await page.reload();
  await main.getByText('vergessen zu stoppen?').waitFor();
  ok(true, 'Hinweis auf vergessenen Timer');
  await page.getByRole('button', { name: 'Stopp' }).click();
  ok((await page.getByLabel('Ende', { exact: true }).inputValue()) === '', 'Ende wird nicht geraten');
  ok(await page.getByText('Bitte das tatsächliche Ende eintragen').isVisible(), 'Aufforderung, das Ende einzutragen');
  ok(await page.getByRole('button', { name: 'Speichern', exact: true }).isDisabled(), 'Speichern erst mit Ende möglich');
  await shot('60-timer-vergessen');
  const von = await page.getByLabel('Beginn', { exact: true }).inputValue();
  const [h, m] = von.split(':').map(Number);
  const bis = `${String((h + 8) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  await page.getByLabel('Ende', { exact: true }).fill(bis);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.locator('.sheet').waitFor({ state: 'detached' });
  ok(await main.getByText('8,00 h').first().isVisible(), 'Vergessener Timer mit echtem Ende gespeichert (8 h, Vortag)');
  ok(await main.getByText('Zeiterfassung').isVisible(), 'Timer beendet');

  // Fehleranzeige bei vollem Speicher
  await page.evaluate(() => { Promise.reject(Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' })); });
  await page.getByRole('alert').waitFor();
  ok((await page.getByRole('alert').innerText()).includes('Speicher des Geräts ist voll'), 'Voller Speicher wird gemeldet');
  await shot('61-speicher-voll');
  await page.getByRole('alert').getByRole('button', { name: 'OK' }).click();
  await page.evaluate(() => { Promise.reject(new Error('irgendwas anderes')); });
  await page.waitForTimeout(300);
  ok((await page.getByRole('alert').count()) === 0, 'Fremde Fehler lösen keinen Fehlalarm aus');

  // iPad quer
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto(URL + '#/');
  await page.locator('.card-link').click();
  await main.getByText('Materialpositionen').waitFor();
  await shot('62-ipad-uebersicht');
  await page.getByRole('link', { name: 'Bericht / PDF / Export' }).click();
  await page.locator('.report table').first().waitFor();
  await shot('63-ipad-bericht');
  await page.goto(URL + '#/woche');
  await main.getByText('Je Baustelle').waitFor();
  await shot('64-ipad-woche');

  console.log('Seitenfehler:', errors.filter((e) => !/quota|irgendwas/i.test(e)).length ? errors : 'keine (außer den zwei absichtlich ausgelösten)');
  await browser.close();
})().catch((e) => { console.error('ABBRUCH', e.message.split('\n').slice(0, 6).join('\n')); console.log('Fehler bisher:', errors); process.exit(1); });
