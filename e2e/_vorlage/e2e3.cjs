const { chromium, devices } = require('playwright');
const SP = __dirname;
const URL = 'http://localhost:4173/';
const errors = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', (d) => d.accept());
  const shot = (n) => page.screenshot({ path: `${SP}/shots/${n}.png` });
  const main = page.locator('.main');
  const side = page.locator('.sidebar');

  await page.goto(URL + '#/neu');
  await page.getByLabel('Bezeichnung *').fill('Praxis Dr. Lang');
  await page.getByRole('button', { name: 'Elektro', exact: true }).click();
  await page.getByRole('button', { name: 'Baustelle anlegen' }).click();
  await main.getByText('Materialpositionen').waitFor();

  // Schnellstart von der Startseite + Verwerfen
  await page.goto(URL + '#/');
  await page.getByLabel('Zeit starten: Praxis Dr. Lang').click();
  await side.getByText('Zeit läuft', { exact: true }).waitFor();
  ok(true, 'Zeit von der Startseite gestartet');
  await shot('50-start-timer');
  await page.getByLabel('Laufende Zeit stoppen: Praxis Dr. Lang').click();
  await page.getByRole('button', { name: 'Stopp' }).click();
  await page.getByRole('button', { name: /Zeit verwerfen/ }).click();
  await main.getByText('Zeiterfassung').waitFor();
  ok((await main.locator('.rows li').count()) === 0, 'Verworfene Zeit erzeugt keinen Eintrag');

  // Stunden: normal + Regie, dann kopieren
  const addTime = async (von, bis, text, regie) => {
    await page.getByRole('button', { name: 'Stunden eintragen' }).click();
    await page.getByLabel('Beginn', { exact: true }).fill(von);
    await page.getByLabel('Ende', { exact: true }).fill(bis);
    await page.locator('.sheet textarea').fill(text);
    if (regie) await page.getByText('Regiearbeit').click();
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.locator('.sheet').waitFor({ state: 'detached' });
  };
  await addTime('07:00', '12:00', 'Leitungen verlegt', false);
  await addTime('13:00', '15:00', 'Zusätzliche Steckdosen Empfang', true);
  await main.locator('.rows li').first().click();
  await page.getByRole('button', { name: 'Als neuen Eintrag für heute kopieren' }).click();
  await page.locator('.sheet').waitFor({ state: 'detached' });
  ok((await main.locator('.rows li').count()) === 3, 'Eintrag kopiert (3 Einträge)');

  // Material + Summen
  await page.getByRole('link', { name: 'Material', exact: true }).click();
  const addMat = async (name, menge, regie) => {
    await page.getByRole('button', { name: 'Material erfassen' }).click();
    await page.getByLabel('Bezeichnung *').fill(name);
    await page.getByLabel('Menge *').fill(menge);
    if (regie) await page.getByText('Regie (Zusatzleistung)').click();
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.locator('.sheet').waitFor({ state: 'detached' });
  };
  await addMat('NYM-J 3x1,5', '40', false);
  await addMat('NYM-J 3x1,5', '25,5', false);
  await addMat('Steckdose', '3', true);
  await page.getByRole('button', { name: 'Summen' }).click();
  ok(await main.getByText('65,5 Stk').isVisible(), 'Materialsumme 40 + 25,5 = 65,5');
  await shot('51-material-summen');

  // Regiebericht
  await page.getByRole('link', { name: 'Übersicht', exact: true }).click();
  await page.getByRole('link', { name: 'Bericht / PDF / Export' }).click();
  await page.locator('.report table').first().waitFor();
  await page.getByRole('button', { name: 'Nur Regie' }).click();
  ok(await page.locator('.report h1').innerText() === 'Regiebericht', 'Titel wechselt auf Regiebericht');
  ok((await page.locator('.report table').first().locator('tbody tr').count()) === 1, 'Regiebericht enthält nur die Regiestunden');
  ok(!(await page.locator('.report').getByText('NYM-J').count()), 'Regiebericht ohne normales Material');
  ok(await page.locator('.report').getByText('Steckdose', { exact: true }).isVisible(), 'Regiebericht mit Regiematerial');
  await page.locator('.report h1').scrollIntoViewIfNeeded();
  await shot('52-regiebericht');
  await page.getByRole('button', { name: 'Gesamtbericht' }).click();
  await page.getByText('Material summieren').click();
  ok(await page.locator('.report').getByText('Material (summiert)').isVisible(), 'Bericht mit summiertem Material');
  await page.getByRole('button', { name: /Als Text teilen/ }).click();
  await page.getByText('Zwischenablage kopiert').waitFor({ timeout: 5000 }).catch(() => {});
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  console.log('--- Text ---\n' + clip + '\n------------');
  ok(clip.includes('Summe: 12,00 h') && clip.includes('65,5 Stk NYM-J 3x1,5'), 'Textzusammenfassung enthält Summen');

  // Abschließen → Rechnung offen → abgerechnet
  await page.goto(URL + '#/');
  await page.locator('.card-link').click();
  await page.getByRole('button', { name: 'Baustelle abschließen' }).click();
  await main.getByText('Rechnung offen').waitFor();
  await page.goto(URL + '#/');
  await page.getByRole('button', { name: /ohne Rechnung/ }).click();
  ok(await side.locator('.project-card').getByText('Rechnung offen').isVisible(), 'Startseite führt zu Baustellen ohne Rechnung');
  await shot('53-rechnung-offen');
  await page.locator('.card-link').click();
  await page.getByRole('button', { name: 'Als abgerechnet markieren' }).click();
  await main.getByText('abgerechnet', { exact: true }).waitFor();
  await page.goto(URL + '#/');
  ok((await page.getByRole('button', { name: /ohne Rechnung/ }).count()) === 0, 'Hinweis verschwindet nach Abrechnung');

  // Fotos: Kamera-Eingang vorhanden
  await page.getByRole('button', { name: /Abgeschlossen/ }).click();
  await page.locator('.card-link').click();
  await page.getByRole('link', { name: 'Fotos', exact: true }).click();
  await main.getByRole('button', { name: 'Aus Mediathek wählen' }).waitFor();
  ok((await page.locator('input[capture=environment]').count()) === 1, 'Kamera-Direktzugriff vorhanden');
  await page.locator('input[type=file][multiple]').setInputFiles(['/home/user/humphump/public/icon-512.png', '/home/user/humphump/public/icon-192.png']);
  await main.locator('.thumb img').nth(1).waitFor();
  ok(true, 'Mehrere Bilder aus der Mediathek übernommen');

  console.log('Konsolenfehler:', errors.length ? errors : 'keine');
  ok(errors.length === 0, 'Keine Konsolenfehler');
  await browser.close();
})().catch((e) => { console.error('ABBRUCH', e.message.split('\n').slice(0, 6).join('\n')); console.log('Fehler bisher:', errors); process.exit(1); });
