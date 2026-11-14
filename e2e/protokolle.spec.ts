import { test, expect, hauptbereich, baustelleAnlegen, tab, tabelle } from './helpers';

async function neuesProtokoll(page: import('@playwright/test').Page, vorlage: string | RegExp) {
  await tab(page, 'Protokolle');
  await page.getByRole('button', { name: 'Neues Protokoll' }).click();
  await page.locator('.sheet').getByText(vorlage).first().click();
  await page.waitForURL(/\/protokoll\//);
}

test.describe('Protokolle', () => {
  test('Vorlagen richten sich nach den Gewerken der Baustelle', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Schule – MSR', gewerke: ['MSR'] });
    await tab(page, 'Protokolle');
    await page.getByRole('button', { name: 'Neues Protokoll' }).click();
    const auswahl = page.locator('.sheet');
    await expect(auswahl.getByText('Datenpunktprüfung')).toBeVisible();
    await expect(auswahl.getByText('Aufmaß Fläche')).toBeVisible(); // allgemeine Vorlagen immer
    await expect(auswahl.getByText('Luftmengenmessung')).toHaveCount(0); // fremdes Gewerk nicht
  });

  test('Luftmengenmessung rechnet Abweichung und Summen, speichert automatisch und erscheint im Bericht', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Halle – Lüftung', gewerke: ['Lüftung'] });
    await neuesProtokoll(page, 'Luftmengenmessung');
    const main = hauptbereich(page);
    await main.getByRole('button', { name: '+ Auslass' }).click();
    await main.getByLabel(/Soll/).first().fill('100');
    await main.getByLabel(/Ist/).first().fill('112,5');
    await expect(main.locator('.proto-calc').first()).toHaveText(/12,5/);

    // Automatisch gespeichert – an der Datenbank festmachen, nicht an der Anzeige.
    await expect.poll(async () => JSON.stringify((await tabelle(page, 'protocols'))[0]?.values ?? {})).toContain('112');
    await page.reload();
    await expect(hauptbereich(page).getByLabel(/Ist/).first()).toHaveValue('112,5');

    const [p] = await tabelle(page, 'protocols');
    await page.goto(`/#/p/${p.projectId}/bericht`);
    const bericht = page.locator('.report');
    await expect(bericht.getByText('Luftmengenmessung')).toBeVisible();
    await expect(bericht.getByText('12,5').first()).toBeVisible();
  });

  test('Prüfpunkte: Mangel erscheint in der Liste, abgeschlossenes Protokoll ist gesperrt', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Büro – MSR', gewerke: ['MSR'] });
    await neuesProtokoll(page, /Inbetriebnahme/);
    const main = hauptbereich(page);
    const pruefpunkte = main.locator('.proto-choice');
    await expect(pruefpunkte.first()).toBeVisible();
    await pruefpunkte.nth(0).getByRole('button', { name: 'i. O.' }).click();
    await pruefpunkte.nth(1).getByRole('button', { name: 'Mangel' }).click();
    await expect.poll(async () => JSON.stringify((await tabelle(page, 'protocols'))[0]?.values ?? {})).toContain('mangel');

    await main.getByRole('button', { name: 'Protokoll abschließen' }).click();
    await expect.poll(async () => (await tabelle(page, 'protocols'))[0]?.abgeschlossen).toBe(true);
    await expect(pruefpunkte.nth(0).getByRole('button', { name: 'i. O.' })).toBeDisabled();

    const [p] = await tabelle(page, 'protocols');
    await page.goto(`/#/p/${p.projectId}/protokolle`);
    const zeile = hauptbereich(page).locator('.rows li').first();
    await expect(zeile).toContainText('1 Mangel');
    await expect(zeile).toContainText('abgeschlossen');
  });

  test('Bautagesbericht: Personal und Stunden werden summiert, gespeichert und im Bericht gezeigt', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Neubau – Tagesbericht', gewerke: ['Heizung'] });
    await neuesProtokoll(page, 'Bautagesbericht');
    const main = hauptbereich(page);
    await main.getByRole('button', { name: '+ Person' }).click();
    await main.getByLabel('Name, Person 1', { exact: true }).fill('Anna Muster');
    await main.getByLabel('Tätigkeit, Person 1', { exact: true }).fill('Rohrleitungen');
    await main.getByLabel('Stunden (h), Person 1', { exact: true }).fill('7,5');
    await main.getByRole('button', { name: '+ Person' }).click();
    await main.getByLabel('Name, Person 2', { exact: true }).fill('Bernd Beispiel');
    await main.getByLabel('Stunden (h), Person 2', { exact: true }).fill('8');
    await expect(main.locator('.proto-sums')).toContainText('Stunden gesamt');
    await expect(main.locator('.proto-sums')).toContainText('15,5 h');

    await expect.poll(async () => JSON.stringify((await tabelle(page, 'protocols'))[0]?.values ?? {})).toContain('Bernd Beispiel');
    await page.reload();
    await expect(hauptbereich(page).getByLabel('Name, Person 2', { exact: true })).toHaveValue('Bernd Beispiel');
    await expect(hauptbereich(page).getByLabel('Stunden (h), Person 1', { exact: true })).toHaveValue('7,5');
    await expect(hauptbereich(page).locator('.proto-sums')).toContainText('15,5 h');

    const [p] = await tabelle(page, 'protocols');
    await page.goto(`/#/p/${p.projectId}/bericht`);
    const bericht = page.locator('.report');
    await expect(bericht.getByText('Bautagesbericht')).toBeVisible();
    await expect(bericht.getByText('Anna Muster')).toBeVisible();
    await expect(bericht.getByText('Rohrleitungen')).toBeVisible();
    await expect(bericht.getByText('Stunden gesamt')).toBeVisible();
    await expect(bericht.getByText('15,5').first()).toBeVisible();
  });
});

async function stundeAmTag(page: import('@playwright/test').Page, datum: string, name: string, stunden: string, taetigkeit: string, regie = false) {
  await page.getByRole('button', { name: 'Stunden eintragen' }).click();
  const sheet = page.locator('.sheet');
  await sheet.getByLabel('Datum').fill(datum);
  await sheet.getByLabel('Mitarbeiter').fill(name);
  await sheet.getByLabel('… oder Stunden direkt').fill(stunden);
  await sheet.getByLabel('Tätigkeit').fill(taetigkeit);
  if (regie) await sheet.getByText('Regiearbeit').click();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.locator('.sheet').waitFor({ state: 'detached' });
}

test.describe('Bautagesbericht: Stunden vom Tag übernehmen', () => {
  test('füllt die Tabelle aus dem Stunden-Reiter, ersetzt statt zu verdoppeln und lässt db.times unberührt', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Neubau – Stundenübernahme', gewerke: ['Heizung'] });
    await tab(page, 'Stunden');
    await stundeAmTag(page, '2026-03-10', 'Anna Muster', '7,5', 'Rohrleitungen');
    await stundeAmTag(page, '2026-03-10', 'Bernd Beispiel', '4', 'Pumpe tauschen', true);
    await stundeAmTag(page, '2026-03-11', 'Anna Muster', '8', 'Isolierung');
    const zeitenVorher = JSON.stringify(await tabelle(page, 'times'));
    expect(JSON.parse(zeitenVorher)).toHaveLength(3);

    await neuesProtokoll(page, 'Bautagesbericht');
    const main = hauptbereich(page);
    await main.getByLabel('Datum', { exact: true }).first().fill('2026-03-10');
    const knopf = main.getByRole('button', { name: 'Stunden vom Tag übernehmen' });
    await expect(knopf).toBeVisible();
    expect((await knopf.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(main.getByText(/Dort wird nichts verändert/)).toBeVisible();

    await knopf.click();
    await expect(main.getByLabel('Name, Person 1', { exact: true })).toHaveValue('Anna Muster');
    await expect(main.getByLabel('Stunden (h), Person 1', { exact: true })).toHaveValue('7,5');
    await expect(main.getByLabel('Tätigkeit, Person 2', { exact: true })).toHaveValue('Pumpe tauschen (Regie)');
    await expect(main.getByLabel('Name, Person 3', { exact: true })).toHaveCount(0);
    await expect(main.locator('.proto-sums')).toContainText('11,5 h');
    await page.screenshot({ path: test.info().outputPath('uebernommen.png') });

    // Zweites Übernehmen: Rückfrage (vom Basistest bestätigt), ersetzt, keine Dubletten.
    // Vorher einen Wert verändern: Erst wenn er wieder 7,5 ist, ist das Ersetzen wirklich durch.
    // (Ohne diese Marke liefe die nächste Eingabe in das noch laufende Übernehmen hinein.)
    await main.getByLabel('Stunden (h), Person 1', { exact: true }).fill('9');
    await knopf.click();
    await expect(main.getByLabel('Stunden (h), Person 1', { exact: true })).toHaveValue('7,5');
    await expect(main.getByLabel('Name, Person 3', { exact: true })).toHaveCount(0);
    await expect(main.locator('.proto-sums')).toContainText('11,5 h');

    // Rückfrage mit „Nein“: nichts ändert sich.
    await main.getByLabel('Stunden (h), Person 1', { exact: true }).fill('1');
    await page.evaluate(() => {
      window.confirm = () => false;
    });
    await knopf.click();
    await expect(main.getByLabel('Stunden (h), Person 1', { exact: true })).toHaveValue('1');

    // Tag ohne Einträge: Meldung, Tabelle bleibt.
    await main.getByLabel('Datum', { exact: true }).first().fill('2026-03-12');
    await knopf.click();
    await expect(main.getByRole('status')).toContainText('keine Stundeneinträge');
    await expect(main.getByLabel('Stunden (h), Person 1', { exact: true })).toHaveValue('1');

    // Gespeichert und Stunden-Reiter unverändert.
    await expect.poll(async () => JSON.stringify((await tabelle(page, 'protocols'))[0]?.values ?? {})).toContain('Bernd Beispiel');
    expect(JSON.stringify(await tabelle(page, 'times'))).toBe(zeitenVorher);
  });

  test('abgeschlossenes Protokoll: Knopf ist gesperrt', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Neubau – gesperrt', gewerke: ['Heizung'] });
    await neuesProtokoll(page, 'Bautagesbericht');
    const main = hauptbereich(page);
    await main.getByRole('button', { name: 'Protokoll abschließen' }).click();
    await expect.poll(async () => (await tabelle(page, 'protocols'))[0]?.abgeschlossen).toBe(true);
    await expect(main.getByRole('button', { name: 'Stunden vom Tag übernehmen' })).toBeDisabled();
  });
});
