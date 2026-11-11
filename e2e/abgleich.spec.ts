import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect, hauptbereich, baustelleAnlegen, tab, tabelle, stundenDirekt, sicherungErstellen, sheetGeschlossen } from './helpers';

/** Zweites „Gerät“: eigener Browser-Kontext mit leerer Datenbank. */
async function geraet(browser: Browser, info: TestInfo): Promise<{ kontext: BrowserContext; seite: Page }> {
  const u = info.project.use;
  const kontext = await browser.newContext({ baseURL: u.baseURL, locale: 'de-DE', viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, acceptDownloads: true });
  const seite = await kontext.newPage();
  seite.on('dialog', (d) => d.accept());
  return { kontext, seite };
}

async function einspielen(page: Page, datei: string) {
  await page.goto('/#/einstellungen');
  await page.locator('input[type=file]').setInputFiles(datei);
  // Ergebniszeile nennt immer „unverändert“ – das markiert das Ende des Zusammenführens.
  await expect(hauptbereich(page).getByText(/unverändert/)).toBeVisible();
}

async function notiz(page: Page, titel: string) {
  await page.getByRole('button', { name: 'Notiz schreiben' }).click();
  await page.getByLabel('Titel', { exact: true }).fill(titel);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await sheetGeschlossen(page);
}

test.describe('Geräteabgleich per Sicherungsdatei', () => {
  test('Änderungen und Löschungen wandern mit; ältere Sicherung überschreibt nichts Neueres', async ({ page, browser }, info) => {
    // Gerät A legt an.
    await baustelleAnlegen(page, { name: 'Bad Huber', gewerke: ['Sanitär'] });
    await tab(page, 'Stunden');
    await stundenDirekt(page, '3', 'Rohinstallation');
    await tab(page, 'Notizen');
    await notiz(page, 'Silikon grau');
    // Bewusst ein Pfad ohne Umlaute: Der Ausgabeordner trägt den Testtitel, und mit Umlauten im Pfad
    // übernimmt Chromium die Datei im Datei-Eingabefeld nicht.
    const ordner = mkdtempSync(join(tmpdir(), 'abgleich-'));
    const a1 = join(ordner, 'a1.json');
    await sicherungErstellen(page, a1);

    const { kontext, seite: b } = await geraet(browser, info);
    try {
      // Gerät B übernimmt alles.
      await b.goto('/#/');
      await b.getByText('Noch keine Baustelle').waitFor();
      await einspielen(b, a1);
      expect((await tabelle(b, 'times')).length).toBe(1);

      // B ändert die Notiz und löscht den Stundeneintrag.
      await b.goto('/#/');
      await b.locator('.card-link').first().click();
      await tab(b, 'Notizen');
      await hauptbereich(b).getByText('Silikon grau').click();
      await b.getByLabel('Titel', { exact: true }).fill('Silikon anthrazit');
      await b.getByRole('button', { name: 'Speichern', exact: true }).click();
      await sheetGeschlossen(b);
      await tab(b, 'Stunden');
      await hauptbereich(b).locator('.rows li').first().click();
      await b.getByRole('button', { name: 'Löschen' }).click();
      await sheetGeschlossen(b);
      await expect.poll(() => tabelle(b, 'tombstones').then((t) => t.some((x) => x.table === 'times'))).toBe(true);
      const b1 = join(ordner, 'b1.json');
      await sicherungErstellen(b, b1);

      // A spielt den Stand von B ein: Änderung und Löschung kommen an – und die Rückfrage kündigt die Löschung vorher an.
      const rueckfragen: string[] = [];
      page.on('dialog', (d) => rueckfragen.push(d.message()));
      await einspielen(page, b1);
      expect(rueckfragen.join('\n')).toMatch(/1 (Eintrag|Einträge)? ?.*gelöscht/);
      expect((await tabelle(page, 'notes'))[0].titel).toBe('Silikon anthrazit');
      expect((await tabelle(page, 'times')).length).toBe(0);

      // A ändert weiter und spielt danach die ALTE eigene Sicherung ein.
      await page.goto('/#/');
      await page.locator('.card-link').first().click();
      await tab(page, 'Notizen');
      await hauptbereich(page).getByText('Silikon anthrazit').click();
      await page.getByLabel('Titel', { exact: true }).fill('Silikon schwarz');
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await sheetGeschlossen(page);
      await einspielen(page, a1);
      expect((await tabelle(page, 'notes'))[0].titel).toBe('Silikon schwarz'); // lokal neuer → bleibt
      expect((await tabelle(page, 'times')).length).toBe(0); // gelöscht bleibt gelöscht
    } finally {
      await kontext.close();
    }
  });
});
