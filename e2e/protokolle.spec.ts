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
