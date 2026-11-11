import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import {
  FOTO,
  ZEICHENFLAECHE,
  anzahl,
  baustelleAnlegen,
  expect,
  hauptbereich,
  materialErfassen,
  seitenleiste,
  sicherungErstellen,
  speichern,
  stundenDirekt,
  tab,
  tabelle,
  test,
  unterschreiben,
  zeichne,
} from './helpers';

const ABHAENGIGE = ['times', 'materials', 'notes', 'photos', 'sketches', 'blobs', 'signatures', 'protocols'];

/** Baustelle mit Stunden, Material, Notiz, Foto, Skizze und Unterschrift. */
async function vollstaendigeBaustelle(page: Page) {
  await baustelleAnlegen(page, { name: 'Schule Musterstadt', gewerke: ['MSR', 'Lüftung'] });
  await tab(page, 'Stunden');
  await stundenDirekt(page, '10,75', 'Datenpunktprüfung');
  await tab(page, 'Material');
  await materialErfassen(page, 'Wickelfalzrohr DN125', '12,5');
  await tab(page, 'Notizen');
  await page.getByRole('button', { name: 'Notiz schreiben' }).click();
  await page.getByLabel('Titel', { exact: true }).fill('Absprache Bauleitung');
  await speichern(page);
  await tab(page, 'Fotos');
  await page.locator('input[type=file][multiple]').setInputFiles(FOTO);
  await hauptbereich(page).locator('.thumb img').first().waitFor();
  await tab(page, 'Skizzen');
  await page.getByLabel('Neue Skizze').click();
  const flaeche = page.locator(ZEICHENFLAECHE);
  await flaeche.waitFor();
  await zeichne(page, flaeche, [[0.1, 0.1], [0.5, 0.3], [0.2, 0.6]]);
  await page.getByRole('button', { name: 'Fertig' }).click();
  await hauptbereich(page).locator('.thumbs.wide .thumb').first().waitFor();
  await tab(page, 'Übersicht');
  await page.getByRole('link', { name: 'Bericht / PDF / Export' }).click();
  await unterschreiben(page);
}

test.describe('Sicherung', () => {
  test('Sicherung in frischem Kontext einspielen: Daten und Foto sind da', async ({ page, browser }, testInfo) => {
    await vollstaendigeBaustelle(page);
    const datei = testInfo.outputPath('sicherung.json');
    const json = JSON.parse(await sicherungErstellen(page, datei));
    expect(json.tables.signatures).toHaveLength(1);
    expect(json.tables.signatures[0].data.__b64.length).toBeGreaterThan(100);

    const u = testInfo.project.use;
    const kontext = await browser.newContext({
      baseURL: u.baseURL,
      locale: 'de-DE',
      viewport: u.viewport,
      userAgent: u.userAgent,
      deviceScaleFactor: u.deviceScaleFactor,
      isMobile: u.isMobile,
      hasTouch: u.hasTouch,
      acceptDownloads: true,
    });
    try {
      const neu = await kontext.newPage();
      neu.on('dialog', (d) => d.accept());
      await neu.goto('/#/');
      await neu.getByText('Noch keine Baustelle').waitFor();
      expect(await anzahl(neu, ['projects', 'times', 'photos'])).toBe(0);

      await neu.goto('/#/einstellungen');
      await neu.locator('input[type=file]').setInputFiles(datei);
      // An den Daten festmachen, nicht an der Erfolgsmeldung.
      await expect.poll(() => tabelle(neu, 'projects').then((p) => p.length)).toBe(1);
      await expect.poll(() => anzahl(neu, ['times', 'materials', 'notes', 'photos', 'sketches', 'signatures'])).toBe(6);

      await neu.goto('/#/');
      const karte = seitenleiste(neu).locator('.project-card');
      await expect(karte).toContainText('Schule Musterstadt');
      await expect(karte.getByText('10,75 h')).toBeVisible();
      await karte.locator('.card-link').click();
      await tab(neu, 'Fotos');
      const bild = hauptbereich(neu).locator('.thumb img').first();
      await bild.waitFor();
      const breite = await bild.evaluate((i: HTMLImageElement) => i.decode().then(() => i.naturalWidth));
      expect(breite).toBeGreaterThan(0);
      // Foto-Vollbild und Skizzenbild (Blobs) sind mit zurückgekommen.
      await expect.poll(() => tabelle(neu, 'blobs').then((b) => b.length)).toBeGreaterThanOrEqual(2);
      expect(readFileSync(datei, 'utf8').length).toBeGreaterThan(1000);
    } finally {
      await kontext.close();
    }
  });

  test('Löschen einer Baustelle hinterlässt keine abhängigen Daten', async ({ page }) => {
    await vollstaendigeBaustelle(page);
    expect(await anzahl(page, ABHAENGIGE)).toBeGreaterThan(6);

    await page.goto('/#/');
    await seitenleiste(page).locator('.card-link').click();
    await page.getByRole('button', { name: 'Baustelle löschen' }).click();
    await expect(page.getByText('Noch keine Baustelle')).toBeVisible();
    expect(await tabelle(page, 'projects')).toHaveLength(0);
    expect(await anzahl(page, ABHAENGIGE)).toBe(0);
  });
});

test.describe('Offline und Fehlerfälle', () => {
  test('App startet ohne Netz aus dem Service Worker', async ({ page, context }) => {
    await baustelleAnlegen(page, { name: 'Heizung Müller', gewerke: ['Heizung'] });
    await page.goto('/#/');
    await seitenleiste(page).locator('.project-card').waitFor();
    // Service Worker aktiv und die Seite von ihm kontrolliert (dafür einmal neu laden).
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(seitenleiste(page).locator('.project-card')).toContainText('Heizung Müller');
    } finally {
      await context.setOffline(false);
    }
  });

  test('Voller Speicher wird gemeldet, fremde Fehler lösen keinen Alarm aus', async ({ page, seitenfehler }) => {
    seitenfehler.erlaube(/quota|irgendwas anderes/i);
    await baustelleAnlegen(page, { name: 'Heizung Müller', gewerke: ['Heizung'] });

    // Fremder Fehler zuerst: kein Alarm. Zwei Frames abwarten, damit React sicher gerendert hätte.
    await page.evaluate(() => {
      Promise.reject(new Error('irgendwas anderes'));
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.evaluate(() => {
      Promise.reject(Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' }));
    });
    const alarm = page.getByRole('alert');
    await expect(alarm).toBeVisible();
    await expect(alarm).toContainText('voll');
    await alarm.getByRole('button', { name: 'OK' }).click();
    await expect(alarm).toHaveCount(0);
  });
});
