import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { FOTO, ZEICHENFLAECHE, baustelleAnlegen, expect, hauptbereich, sicherungErstellen, tab, tabelle, test, zeichne } from './helpers';

const ALLE = ['projects', 'times', 'materials', 'notes', 'photos', 'sketches', 'blobs', 'signatures', 'protocols', 'tombstones'];

/** Merkt sich die Texte aller Rückfragen (die Basis-Fixture bestätigt sie bereits). */
function dialogTexte(page: Page): string[] {
  const liste: string[] = [];
  page.on('dialog', (d) => liste.push(d.message()));
  return liste;
}

// Pfad ohne Umlaute, sonst übernimmt Chromium die Datei im Datei-Eingabefeld nicht.
const tempOrdner = () => mkdtempSync(join(tmpdir(), 'datenschutz-'));

test.describe('Datenschutz und Notausgang', () => {
  test('Hinweis zur Sicherungsdatei ist sichtbar', async ({ page }) => {
    await page.goto('/#/einstellungen');
    const text = hauptbereich(page).locator('.warnbox', { hasText: 'unverschlüsselt' });
    await expect(text).toBeVisible();
    await expect(text).toContainText('Kunden- und Mitarbeiterdaten');
    await expect(text).toContainText('Unterschriften');
  });

  test('Einspielen fragt mit Vorschau nach und zeigt das Ergebnis; Abbrechen ändert nichts', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Bad Huber', gewerke: ['Sanitär'] });
    const datei = join(tempOrdner(), 'a.json');
    await sicherungErstellen(page, datei);
    const dialoge = dialogTexte(page);
    await page.locator('input[type=file]').setInputFiles(datei);
    await expect(hauptbereich(page).getByText(/Sicherung zusammengeführt: .*unverändert/)).toBeVisible();
    expect(dialoge.some((t) => /neu.*aktualisiert.*gelöscht.*unverändert/s.test(t) && /Fortfahren/.test(t))).toBe(true);

    // Rückfrage ablehnen: kein Ergebnis, nichts verändert.
    page.removeAllListeners('dialog');
    page.on('dialog', (d) => d.dismiss());
    await page.locator('input[type=file]').setInputFiles(datei);
    await expect(hauptbereich(page).getByText('Einspielen abgebrochen')).toBeVisible();
    expect((await tabelle(page, 'projects')).length).toBe(1);
  });

  test('Eine ungültige Datei wird verständlich gemeldet', async ({ page }) => {
    const datei = join(tempOrdner(), 'kaputt.json');
    writeFileSync(datei, '{"irgendwas": 1}');
    await page.goto('/#/einstellungen');
    await page.locator('input[type=file]').setInputFiles(datei);
    await expect(hauptbereich(page).getByText(/Einspielen fehlgeschlagen/)).toBeVisible();
    await expect(hauptbereich(page).getByText(/Daten auf diesem Gerät sind unverändert/)).toBeVisible();
  });

  test('Alle Daten löschen leert alle Tabellen; Startseite zeigt den Leerzustand', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Bad Huber', gewerke: ['Sanitär'] });
    await baustelleAnlegen(page, { name: 'Keller Meier', gewerke: ['MSR'] });
    const dialoge = dialogTexte(page);
    await page.goto('/#/einstellungen');
    await expect(hauptbereich(page).getByText('Gefahrenbereich')).toBeVisible();
    const knopf = page.getByRole('button', { name: 'Alle Daten auf diesem Gerät löschen' });
    expect((await knopf.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await knopf.click();
    await page.getByText('Noch keine Baustelle').waitFor();
    expect(dialoge.length).toBe(3); // Sicherung anbieten, erste Rückfrage, zweite Rückfrage
    expect(dialoge[2]).toContain('2 Baustellen');
    for (const t of ALLE) expect(await tabelle(page, t), t).toEqual([]);
    expect(page.url()).toMatch(/#\/$/);
  });

  test('Fehlerbildschirm bietet Sicherung an und führt in die Einstellungen', async ({ page, seitenfehler }) => {
    seitenfehler.erlaube(/./); // React meldet den absichtlichen Darstellungsfehler in der Konsole
    await baustelleAnlegen(page, { name: 'Bad Huber', gewerke: ['Sanitär'] });
    await page.evaluate(
      () =>
        new Promise<void>((fertig, fehler) => {
          const q = indexedDB.open('baustellenbuch');
          q.onerror = () => fehler(q.error);
          q.onsuccess = () => {
            const t = q.result.transaction('projects', 'readwrite');
            t.objectStore('projects').put({ id: 'kaputt', name: { objekt: 1 }, status: 'aktiv', gewerke: [], createdAt: Date.now(), updatedAt: Date.now() });
            t.oncomplete = () => fertig();
            t.onerror = () => fehler(t.error);
          };
        }),
    );
    await page.goto('/#/');
    await page.reload();
    await expect(page.getByText('Da ist etwas schiefgelaufen')).toBeVisible();
    await expect(page.getByText(/Alle Daten auf diesem Gerät löschen/)).toBeVisible();

    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Sicherung erstellen' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^Baustellenbuch_Sicherung_.*\.json$/);

    await page.getByRole('link', { name: 'Zu den Einstellungen' }).click();
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
    await expect(page.getByText('Da ist etwas schiefgelaufen')).toHaveCount(0);
    await page.getByRole('button', { name: 'Alle Daten auf diesem Gerät löschen' }).click();
    await page.getByText('Noch keine Baustelle').waitFor();
  });

  test('Keine CSP-Verstöße bei Foto, Skizze und Sicherung', async ({ page }) => {
    const verstoesse: string[] = [];
    page.on('console', (m) => /content security policy|refused to/i.test(m.text()) && verstoesse.push(m.text()));
    await page.addInitScript(() =>
      document.addEventListener('securitypolicyviolation', (e) => ((window as any).__csp = [...((window as any).__csp ?? []), e.violatedDirective + ' ' + e.blockedURI])),
    );
    await baustelleAnlegen(page, { name: 'Schule Musterstadt', gewerke: ['MSR'] });
    await tab(page, 'Fotos');
    await page.locator('input[type=file][multiple]').setInputFiles([FOTO]);
    await expect(hauptbereich(page).locator('.thumb img')).toHaveCount(1);
    await hauptbereich(page).locator('.thumb').first().click();
    await expect(page.locator('img.photo-full')).toBeVisible();
    await page.goto('/#/');
    await page.locator('.card-link').first().click();
    await tab(page, 'Skizzen');
    await page.getByLabel('Neue Skizze').click();
    const flaeche = page.locator(ZEICHENFLAECHE);
    await flaeche.waitFor();
    await zeichne(page, flaeche, [[0.1, 0.1], [0.5, 0.3], [0.8, 0.8]]);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(hauptbereich(page).locator('.thumbs.wide .thumb')).toHaveCount(1);
    await sicherungErstellen(page, join(tempOrdner(), 's.json'));
    expect(await page.evaluate(() => (window as any).__csp ?? [])).toEqual([]);
    expect(verstoesse).toEqual([]);
    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').count()).toBe(1);
  });
});
