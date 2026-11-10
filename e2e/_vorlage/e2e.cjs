const { chromium, devices } = require('playwright');
const fs = require('fs');
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

  await page.goto(URL);
  await page.getByText('Noch keine Baustelle').waitFor();
  await shot('01-leer');

  // Profil
  await page.getByLabel('Einstellungen').click();
  await page.getByLabel('Dein Name').fill('Max Muster');
  await page.getByLabel('Firma').fill('Muster Gebäudetechnik GmbH');
  await page.getByLabel('Zurück').click();

  // Baustelle
  await page.getByLabel('Neue Baustelle').click();
  await page.getByLabel('Bezeichnung *').fill('Schule Musterstadt – Lüftung Turnhalle');
  await page.getByLabel('Kunde / Auftraggeber').fill('Stadt Musterstadt');
  await page.getByLabel('Adresse').fill('Schulstraße 1, 12345 Musterstadt');
  await page.getByLabel('Auftrags- / Projektnummer').fill('S26-0042');
  await page.getByRole('button', { name: 'MSR', exact: true }).click();
  await page.getByRole('button', { name: 'Lüftung', exact: true }).click();
  await shot('02-neue-baustelle');
  await page.getByRole('button', { name: 'Baustelle anlegen' }).click();
  await page.getByText('Materialpositionen').waitFor();
  await shot('03-uebersicht');

  // Stunden
  await page.getByRole('link', { name: 'Stunden', exact: true }).click();
  await page.getByRole('button', { name: 'Stunden eintragen' }).click();
  ok((await page.getByLabel('Mitarbeiter').inputValue()) === 'Max Muster', 'Mitarbeiter aus Profil vorbelegt');
  await page.getByLabel('Beginn', { exact: true }).fill('07:00');
  await page.getByLabel('Ende', { exact: true }).fill('16:00');
  await page.getByLabel('Pause (min)').fill('45');
  ok(await page.getByText('8,25 h').first().isVisible(), 'Arbeitszeit 07–16 Uhr minus 45 min = 8,25 h');
  await page.getByRole('button', { name: 'Datenpunktprüfung' }).click();
  await page.getByRole('button', { name: 'Inbetriebnahme' }).click();
  await shot('04-stunden-form');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.getByText('Datenpunktprüfung, Inbetriebnahme').waitFor();
  // Direkteingabe + Regie
  await page.getByRole('button', { name: 'Stunden eintragen' }).click();
  await page.getByLabel('… oder Stunden direkt').fill('2,5');
  await page.getByLabel('Tätigkeit').fill('Zusätzlicher Fühler nach Wunsch Bauleitung');
  await page.getByText('Regiearbeit').click();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.getByText('Regie', { exact: true }).waitFor();
  ok(await page.getByText('Gesamt: 10,75 h').isVisible(), 'Summe Stunden 10,75 h');
  // Timer
  await page.getByRole('button', { name: 'Start' }).click();
  await page.locator('.main').getByText('Zeit läuft', { exact: true }).waitFor();
  await page.reload();
  ok(await page.locator('.main').getByText('Zeit läuft', { exact: true }).waitFor().then(() => true, () => false), 'Timer übersteht Neuladen');
  await shot('05-stunden');
  await page.getByRole('button', { name: 'Stopp' }).click();
  ok((await page.getByLabel('Beginn', { exact: true }).inputValue()) !== '', 'Timer-Stopp belegt Beginn vor');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  ok(await page.locator('.main').getByText('Zeit läuft', { exact: true }).isVisible(), 'Abbrechen lässt Timer weiterlaufen');
  await page.evaluate(() => new Promise((r) => { const q = indexedDB.open('baustellenbuch'); q.onsuccess = () => { const t = q.result.transaction('settings', 'readwrite'); t.objectStore('settings').delete('timer'); t.oncomplete = r; }; }));
  await page.reload();

  // Material
  await page.getByRole('link', { name: 'Material', exact: true }).click();
  await page.getByRole('button', { name: 'Material erfassen' }).click();
  await page.getByRole('button', { name: 'Temperaturfühler PT1000' }).click();
  await page.getByLabel('Menge *').fill('4');
  await page.getByRole('button', { name: 'Speichern & nächste Position' }).click();
  await page.locator('.sheet select').first().selectOption('lueftung');
  await page.getByLabel('Bezeichnung *').fill('wickel');
  await page.getByRole('button', { name: 'Wickelfalzrohr DN125' }).click();
  ok((await page.getByLabel('Einheit').inputValue()) === 'm', 'Vorschlag setzt Einheit m');
  await page.getByLabel('Menge *').fill('12,5');
  await shot('06-material-form');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.getByText('12,5 m').waitFor();
  await shot('07-material');

  // Notiz
  await page.getByRole('link', { name: 'Notizen', exact: true }).click();
  await page.getByRole('button', { name: 'Notiz schreiben' }).click();
  await page.getByLabel('Titel', { exact: true }).fill('Absprache Bauleitung');
  await page.locator('.sheet textarea').fill('Zusätzlicher Raumfühler in der Umkleide gewünscht.\nAbrechnung als Regie.');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.getByText('Absprache Bauleitung').waitFor();

  // Foto
  await page.getByRole('link', { name: 'Fotos', exact: true }).click();
  await page.locator('input[type=file][multiple]').setInputFiles('/home/user/humphump/public/icon-512.png');
  await page.locator('.thumb img').first().waitFor();
  await page.locator('.thumb').first().click();
  await page.getByLabel('Beschreibung').fill('Verteiler UG');
  await page.locator('img.photo-full').waitFor();
  await shot('08-foto');
  await page.getByRole('button', { name: 'Im Foto zeichnen / bemaßen' }).click();

  // Skizze auf Foto
  const canvas = page.locator('.paper canvas:not(.bg)');
  await canvas.waitFor();
  let box = await canvas.boundingBox();
  const drag = async (pts) => { await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down(); for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1], { steps: 6 }); await page.mouse.up(); };
  const P = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  await page.getByLabel('Farbe #d92d20').click();
  await drag([P(0.2, 0.2), P(0.4, 0.35), P(0.3, 0.5), P(0.6, 0.6)]);
  await page.getByLabel('Linie').click();
  await drag([P(0.1, 0.85), P(0.9, 0.85)]);
  await page.getByLabel('Text / Maß', { exact: true }).click();
  await page.mouse.click(...P(0.4, 0.78));
  await page.locator('input[name=text]').fill('2,45 m');
  await page.getByRole('button', { name: 'Einfügen' }).click();
  await page.getByLabel('Rechteck').click();
  await drag([P(0.6, 0.15), P(0.85, 0.4)]);
  await page.getByLabel('Rückgängig').click();
  await page.getByLabel('Wiederholen').click();
  await shot('09-skizze-foto');
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.locator('.thumbs.wide .thumb img').waitFor();

  // Freie Skizze
  await page.getByLabel('Neue Skizze').click();
  await canvas.waitFor();
  box = await canvas.boundingBox();
  await page.getByLabel('Titel der Skizze').fill('Schema Lüftung');
  await drag([P(0.1, 0.1), P(0.5, 0.3), P(0.2, 0.6), P(0.8, 0.8)]);
  await page.getByLabel('Radierer').click();
  await drag([P(0.3, 0.1), P(0.3, 0.4)]);
  await shot('10-skizze-frei');
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.getByText('Schema Lüftung').waitFor();
  ok((await page.locator('.thumbs.wide .thumb').count()) === 2, 'Zwei Skizzen gespeichert');
  await shot('11-skizzen');
  // Leere Skizze wird verworfen
  await page.getByLabel('Neue Skizze').click();
  await canvas.waitFor();
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.getByText('Schema Lüftung').waitFor();
  ok((await page.locator('.thumbs.wide .thumb').count()) === 2, 'Leere Skizze wird nicht gespeichert');
  // Skizze erneut öffnen: Striche noch da?
  const strokes = await page.evaluate(() => new Promise((r) => { const q = indexedDB.open('baustellenbuch'); q.onsuccess = () => { const g = q.result.transaction('sketches').objectStore('sketches').getAll(); g.onsuccess = () => r(g.result.map((s) => s.strokes.length).sort()); }; }));
  ok(JSON.stringify(strokes) === '[2,4]', 'Striche als Vektordaten gespeichert: ' + JSON.stringify(strokes));

  // Bericht
  await page.getByRole('link', { name: 'Übersicht', exact: true }).click();
  await page.getByRole('link', { name: 'Bericht / PDF / Export' }).click();
  await page.locator('.report-images img').nth(2).waitFor();
  ok(await page.getByText('davon Regie: 2,50 h').isVisible(), 'Bericht weist Regiestunden aus');
  await shot('12-bericht');
  await page.pdf({ path: `${SP}/shots/bericht.pdf`, format: 'A4' });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Stunden als CSV' }).click()]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  console.log(csv);
  ok(csv.includes('8,25') && csv.includes(';ja;'), 'CSV enthält Stunden und Regie');

  // Sicherung → alles löschen → einspielen
  await page.goto(URL + '#/einstellungen');
  const [bdl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Sicherung erstellen' }).click()]);
  const bpath = `${SP}/backup.json`;
  await bdl.saveAs(bpath);
  console.log('Backup-Größe', fs.statSync(bpath).size);
  await page.goto(URL + '#/');
  await page.locator('.card-link').click();
  await page.getByRole('button', { name: 'Baustelle löschen' }).click();
  await page.getByText('Noch keine Baustelle').waitFor();
  const left = await page.evaluate(() => new Promise((r) => { const q = indexedDB.open('baustellenbuch'); q.onsuccess = () => { const db = q.result; const names = ['times', 'materials', 'notes', 'photos', 'sketches', 'blobs']; const t = db.transaction(names); let n = 0, done = 0; names.forEach((s) => { const c = t.objectStore(s).count(); c.onsuccess = () => { n += c.result; if (++done === names.length) r(n); }; }); }; }));
  ok(left === 0, 'Löschen entfernt alle abhängigen Daten (Rest: ' + left + ')');
  await page.getByLabel('Einstellungen').click();
  await page.locator('input[type=file]').setInputFiles(bpath);
  await page.getByText('Sicherung eingespielt').waitFor();
  await page.getByLabel('Zurück').click();
  await page.locator('.project-card').waitFor();
  ok(await page.locator('.project-card').getByText('10,75 h').isVisible(), 'Nach Wiederherstellung: Baustelle mit 10,75 h');
  await page.locator('.card-link').click();
  await page.getByRole('link', { name: 'Fotos', exact: true }).click();
  await page.locator('.thumb img').first().waitFor();
  const nat = await page.locator('.thumb img').first().evaluate((i) => i.decode().then(() => i.naturalWidth));
  ok(nat > 0, 'Foto nach Wiederherstellung darstellbar');
  await page.goto(URL + '#/');
  await shot('13-liste');

  // Offline
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {});
  await ctx.setOffline(true);
  await page.reload().catch((e) => errors.push('OFFLINE ' + e.message));
  ok(await page.locator('.project-card').isVisible().catch(() => false), 'App startet offline (Service Worker)');
  await ctx.setOffline(false);

  // iPad quer: gleiche Daten über storageState geht nicht für IndexedDB → gleiches Context, andere Viewport-Größe
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto(URL + '#/');
  await page.locator('.card-link').click();
  await page.getByRole('link', { name: 'Stunden', exact: true }).click();
  await page.getByText('Datenpunktprüfung, Inbetriebnahme').waitFor();
  await shot('20-ipad-stunden');
  await page.getByRole('link', { name: 'Skizzen', exact: true }).click();
  await page.locator('.thumbs.wide .thumb').first().click();
  await canvas.waitFor();
  await shot('21-ipad-skizze');
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(URL + '#/');
  await page.locator('.card-link').click();
  await shot('22-ipad-hoch');

  console.log('Konsolenfehler:', errors.length ? errors : 'keine');
  ok(errors.length === 0, 'Keine Konsolenfehler');
  await browser.close();
})().catch((e) => { console.error('ABBRUCH', e.message.split('\n').slice(0, 6).join('\n')); console.log('Fehler bisher:', errors); process.exit(1); });
