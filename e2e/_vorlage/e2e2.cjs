const { chromium, devices } = require('playwright');
const SP = __dirname;
const URL = 'http://localhost:4173/';
const errors = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'], acceptDownloads: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', (d) => d.accept());
  const shot = (n) => page.screenshot({ path: `${SP}/shots/${n}.png` });
  const main = page.locator('.main');
  const idb = (fn) => page.evaluate(fn);

  await page.goto(URL + '#/neu');
  await page.getByLabel('Bezeichnung *').fill('Bad Familie Huber');
  await page.getByLabel('Ansprechpartner vor Ort').fill('Frau Huber');
  await page.getByLabel('Telefon').fill('0171 234 56 78');
  await page.getByRole('button', { name: 'Sanitär', exact: true }).click();
  await page.getByRole('button', { name: 'Baustelle anlegen' }).click();
  const tel = await main.locator('a[href^="tel:"]').getAttribute('href');
  ok(tel === 'tel:01712345678', 'Telefonnummer antippbar: ' + tel);

  // Timer: Start vor 7 h 40 min simulieren → gerundet + Pausenvorschlag 30
  await page.getByRole('link', { name: 'Stunden', exact: true }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await main.getByText('Zeit läuft', { exact: true }).waitFor();
  await idb(() => new Promise((r) => { const q = indexedDB.open('baustellenbuch'); q.onsuccess = () => { const t = q.result.transaction('settings', 'readwrite'); const s = t.objectStore('settings'); const g = s.get('timer'); g.onsuccess = () => { const v = g.result; v.value.start = Date.now() - (7 * 60 + 40) * 60000; s.put(v); }; t.oncomplete = r; }; }));
  await page.reload();
  await page.getByRole('button', { name: 'Stopp' }).click();
  const von = await page.getByLabel('Beginn', { exact: true }).inputValue();
  const bis = await page.getByLabel('Ende', { exact: true }).inputValue();
  ok(/:(00|15|30|45)$/.test(von) && /:(00|15|30|45)$/.test(bis), `Timer auf Viertelstunden gerundet: ${von}–${bis}`);
  ok((await page.getByLabel('Pause (min)').inputValue()) === '30', 'Pause 30 min vorgeschlagen bei > 6 h');
  await page.locator('.sheet textarea').fill('Rohinstallation, Sonderwunsch Nische');
  await page.getByLabel('Gefahrene Kilometer (optional)').fill('24,5');
  await shot('30-timer-stopp');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await main.getByText('24,5 km').waitFor();
  ok(await main.getByText('Zeiterfassung').isVisible(), 'Timer nach dem Speichern beendet');
  // Eigene Tätigkeit wird beim nächsten Mal vorgeschlagen
  await page.getByRole('button', { name: 'Stunden eintragen' }).click();
  ok(await page.getByRole('button', { name: 'Sonderwunsch Nische' }).isVisible(), 'Eigene Tätigkeit erscheint als Vorschlag');
  await page.getByRole('button', { name: 'Abbrechen' }).click();

  // Material: eigener Eintrag wird Vorschlag
  await page.getByRole('link', { name: 'Material', exact: true }).click();
  await page.getByRole('button', { name: 'Material erfassen' }).click();
  await page.getByLabel('Bezeichnung *').fill('Duschrinne 80 cm');
  await page.getByLabel('Menge *').fill('1');
  await page.getByRole('button', { name: 'Speichern & nächste Position' }).click();
  ok(await page.locator('.suggest button').first().innerText() === 'Duschrinne 80 cm', 'Eigenes Material steht als erster Vorschlag');
  await page.getByRole('button', { name: 'Abbrechen' }).click();

  // Offene Punkte
  await page.getByRole('link', { name: 'Notizen', exact: true }).click();
  await page.getByRole('button', { name: 'Notiz schreiben' }).click();
  await page.getByLabel('Titel', { exact: true }).fill('Silikon grau mitbringen');
  await page.getByText('Offener Punkt').click();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await main.getByText('Offene Punkte').waitFor();
  await shot('31-offene-punkte');
  await page.goto(URL + '#/');
  ok(await page.locator('.project-card').getByText('1 offen').isVisible(), 'Startseite zeigt offene Punkte');
  ok(await page.getByText('Datensicherung fällig').isVisible(), 'Startseite erinnert an Sicherung');
  await shot('32-start');
  await page.locator('.card-link').click();
  await page.getByRole('link', { name: 'Notizen', exact: true }).click();
  await page.getByLabel('Als erledigt abhaken').click();
  await page.getByLabel('Wieder öffnen').waitFor();
  ok(!(await main.getByText('Offene Punkte').isVisible()), 'Abgehakter Punkt verlässt die offene Liste');

  // Unterschrift
  await page.goto(URL + '#/');
  await page.locator('.card-link').click();
  await page.getByRole('link', { name: 'Bericht / PDF / Export' }).click();
  await page.getByRole('button', { name: 'Kunde unterschreiben lassen' }).click();
  const c = page.locator('.signpad canvas');
  const b = await c.boundingBox();
  await page.mouse.move(b.x + 40, b.y + b.height * 0.6); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + 40 + i * 20, b.y + b.height * (0.6 + 0.25 * Math.sin(i)), { steps: 3 });
  await page.mouse.up();
  await page.getByLabel('Name des Unterzeichners').fill('M. Huber');
  await shot('33-unterschrift');
  await page.getByRole('button', { name: 'Unterschrift übernehmen' }).click();
  await page.locator('.signatures img').waitFor();
  ok(await page.getByText(/M\. Huber, unterschrieben am/).isVisible(), 'Unterschrift erscheint im Bericht');
  ok(await page.getByText('Gefahrene Kilometer').isVisible(), 'Bericht summiert Kilometer');
  await page.locator('.report .signatures').scrollIntoViewIfNeeded();
  await shot('34-bericht-unterschrift');
  await page.pdf({ path: `${SP}/shots/bericht2.pdf`, format: 'A4' });
  // anderer Zeitraum → Unterschrift gilt nicht
  await page.getByRole('button', { name: 'Nur heute' }).click();
  ok((await page.locator('.signatures img').count()) === 0, 'Unterschrift gilt nur für den unterschriebenen Zeitraum');

  // Woche
  await page.goto(URL + '#/woche');
  await main.getByText('Je Baustelle').waitFor();
  ok(await main.getByText('24,5 km').first().isVisible(), 'Wochenübersicht zeigt Kilometer');
  await shot('35-woche');
  await page.getByLabel('Vorherige Woche').click();
  await main.getByText('Keine Stunden in dieser Woche').waitFor();

  // Sicherung enthält Unterschrift
  await page.goto(URL + '#/einstellungen');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Sicherung erstellen' }).click()]);
  const json = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
  ok(json.tables.signatures.length === 1 && json.tables.signatures[0].data.__b64.length > 100, 'Sicherung enthält die Unterschrift');
  await page.goto(URL + '#/');
  await page.locator('.project-card').waitFor();
  ok(!(await page.getByText('Datensicherung fällig').isVisible()), 'Erinnerung verschwindet nach Sicherung');

  console.log('Konsolenfehler:', errors.length ? errors : 'keine');
  ok(errors.length === 0, 'Keine Konsolenfehler');
  await browser.close();
})().catch((e) => { console.error('ABBRUCH', e.message.split('\n').slice(0, 6).join('\n')); console.log('Fehler bisher:', errors); process.exit(1); });
