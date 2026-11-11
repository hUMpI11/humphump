import type { Page } from '@playwright/test';
import {
  FOTO,
  ZEICHENFLAECHE,
  baustelleAnlegen,
  downloadText,
  expect,
  hauptbereich,
  materialErfassen,
  stundenDirekt,
  stundenUhrzeit,
  tab,
  test,
  unterschreiben,
  zeichne,
} from './helpers';

/** Baustelle mit Normal- und Regiestunden, Material, einem Foto und einer Skizze. */
async function berichtsDaten(page: Page) {
  await baustelleAnlegen(page, { name: 'Praxis Dr. Lang', gewerke: ['Elektro'] });
  await tab(page, 'Stunden');
  await stundenUhrzeit(page, '07:00', '12:00', 'Leitungen verlegt');
  await stundenUhrzeit(page, '13:00', '15:00', 'Zusätzliche Steckdosen Empfang', true);
  await page.getByRole('button', { name: 'Stunden eintragen' }).click();
  await page.getByLabel('Beginn', { exact: true }).fill('08:00');
  await page.getByLabel('Ende', { exact: true }).fill('10:00');
  await page.getByLabel('Gefahrene Kilometer (optional)').fill('24,5');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.locator('.sheet').waitFor({ state: 'detached' });

  await tab(page, 'Material');
  await materialErfassen(page, 'NYM-J 3x1,5', '40');
  await materialErfassen(page, 'NYM-J 3x1,5', '25,5');
  await materialErfassen(page, 'Steckdose', '3', true);

  await tab(page, 'Fotos');
  await page.locator('input[type=file][multiple]').setInputFiles(FOTO);
  await hauptbereich(page).locator('.thumb img').first().waitFor();

  await tab(page, 'Skizzen');
  await page.getByLabel('Neue Skizze').click();
  const flaeche = page.locator(ZEICHENFLAECHE);
  await flaeche.waitFor();
  await page.getByLabel('Titel der Skizze').fill('Schema Empfang');
  await zeichne(page, flaeche, [[0.1, 0.1], [0.5, 0.3], [0.2, 0.6]]);
  await page.getByRole('button', { name: 'Fertig' }).click();
  await hauptbereich(page).getByText('Schema Empfang').waitFor();

  await tab(page, 'Übersicht');
  await page.getByRole('link', { name: 'Bericht / PDF / Export' }).click();
  await page.locator('.report table').first().waitFor();
}

test.describe('Bericht', () => {
  test.beforeEach(async ({ page }) => {
    await berichtsDaten(page);
  });

  test('Gesamtbericht: Stunden, Regieanteil, Kilometer, Material, Bilder', async ({ page }) => {
    const bericht = page.locator('.report');
    await expect(bericht.locator('h1')).not.toHaveText('Regiebericht');
    await expect(bericht.getByText('Leitungen verlegt')).toBeVisible();
    await expect(bericht.getByText('davon Regie: 2,00 h')).toBeVisible();
    await expect(page.getByText('Gefahrene Kilometer')).toBeVisible();
    await expect(bericht.getByText('NYM-J 3x1,5').first()).toBeVisible();
    // Foto und Skizze erscheinen als Bilder im Bericht.
    await expect(page.locator('.report-images img')).toHaveCount(2);
  });

  test('Regiebericht enthält nur Regiestunden und Regiematerial', async ({ page }) => {
    await page.getByRole('button', { name: 'Nur Regie' }).click();
    const bericht = page.locator('.report');
    await expect(bericht.locator('h1')).toHaveText('Regiebericht');
    await expect(bericht.locator('table').first().locator('tbody tr')).toHaveCount(1);
    await expect(bericht.getByText('Zusätzliche Steckdosen Empfang')).toBeVisible();
    await expect(bericht.getByText('Leitungen verlegt')).toHaveCount(0);
    await expect(bericht.getByText('NYM-J')).toHaveCount(0);
    await expect(bericht.getByText('Steckdose', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Gesamtbericht' }).click();
    await expect(bericht.locator('h1')).not.toHaveText('Regiebericht');
  });

  test('Material summieren fasst gleiche Positionen zusammen', async ({ page }) => {
    await page.getByText('Material summieren').click();
    const bericht = page.locator('.report');
    await expect(bericht.getByText('Material (summiert)')).toBeVisible();
    await expect(bericht.getByText('65,5')).toBeVisible();
  });

  test('Text teilen legt die Zusammenfassung in die Zwischenablage', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Zwischenablage-Rechte nur in Chromium');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: /Als Text teilen/ }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()).catch(() => ''))
      .toContain('Summe: 9,00 h');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('65,5 Stk NYM-J 3x1,5');
    expect(text).toContain('Praxis Dr. Lang');
  });

  test('Stunden-CSV enthält Stunden, Regie-Kennzeichen und Kilometer', async ({ page }) => {
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Stunden als CSV' }).click(),
    ]);
    const csv = await downloadText(dl);
    const zeilen = csv.split(/\r?\n/).filter((z) => z.trim() !== '');
    // Kopfzeile + drei Einträge.
    expect(zeilen).toHaveLength(4);
    expect(zeilen.some((z) => /;07:00;12:00;0;5;0;.*;nein;Leitungen verlegt$/.test(z))).toBe(true);
    expect(zeilen.some((z) => /;13:00;15:00;0;2;0;.*;ja;Zusätzliche Steckdosen Empfang$/.test(z))).toBe(true);
    expect(zeilen.some((z) => /;08:00;10:00;0;2;24,5;/.test(z))).toBe(true);
  });

  test('Unterschrift gilt nur für den unterschriebenen Zeitraum', async ({ page }) => {
    await unterschreiben(page);
    await expect(page.locator('.signatures img')).toHaveCount(1);
    await expect(page.getByText(/M\. Huber, unterschrieben am/)).toBeVisible();

    // Anderer Zeitraum: die Unterschrift gilt dort nicht.
    await page.getByRole('button', { name: 'Nur heute' }).click();
    await expect(page.locator('.signatures img')).toHaveCount(0);
  });
});
