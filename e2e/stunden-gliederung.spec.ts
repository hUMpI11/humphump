import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { baustelleAnlegen, expect, hauptbereich, sicherungErstellen, speichern, stundenDirekt, tab, tabelle, test, unterschreiben } from './helpers';

// Feste Testdaten mit eigenen Datumswerten: Die Gliederung hängt nicht vom heutigen Datum ab.
// KW 38 = 14.–20.09.2026, KW 41 = 05.–11.10.2026, KW 45 = 02.–08.11.2026.
const DATEN = [
  { datum: '2026-09-14', minuten: 120, taetigkeit: 'Rohrleitung Keller', mitarbeiter: 'Anna', regie: false },
  { datum: '2026-10-05', minuten: 180, taetigkeit: 'Fühler setzen', mitarbeiter: 'Bernd', regie: true },
  { datum: '2026-10-06', minuten: 90, taetigkeit: 'Rohrleitung EG', mitarbeiter: 'Anna', regie: false },
  { datum: '2026-11-03', minuten: 240, taetigkeit: 'Pumpe tauschen', mitarbeiter: 'Anna', regie: true },
  { datum: '2026-11-05', minuten: 150, taetigkeit: 'Regler einstellen', mitarbeiter: 'Bernd', regie: false },
];

/** Schreibt Stundeneinträge direkt in die IndexedDB und lädt die Seite neu (Live-Abfragen sehen fremde Verbindungen nicht). */
async function eintraegeAnlegen(page: Page) {
  const [projekt] = await tabelle(page, 'projects');
  await page.evaluate(
    ({ pid, daten }) =>
      new Promise<void>((fertig, fehler) => {
        const q = indexedDB.open('baustellenbuch');
        q.onerror = () => fehler(q.error);
        q.onsuccess = () => {
          const db = q.result;
          const t = db.transaction('times', 'readwrite');
          daten.forEach((d, i) =>
            t.objectStore('times').put({ ...d, id: `test-${i}`, projectId: pid, von: '', bis: '', pauseMin: 0, gewerk: 'sonstiges', createdAt: 1000 + i }),
          );
          t.oncomplete = () => {
            db.close();
            fertig();
          };
          t.onerror = () => fehler(t.error);
        };
      }),
    { pid: projekt.id, daten: DATEN },
  );
  await page.reload();
  await hauptbereich(page).getByText('Gesamt: 13,00 h').waitFor();
}

async function vorbereiten(page: Page) {
  await baustelleAnlegen(page, { name: 'Heizung Gliederung', gewerke: ['Heizung'] });
  await tab(page, 'Stunden');
  await eintraegeAnlegen(page);
}

const modus = (page: Page, name: 'Tage' | 'Wochen' | 'Monate') => hauptbereich(page).getByRole('button', { name, exact: true }).click();
const koepfe = (page: Page) => hauptbereich(page).locator('.zeit-kopf');
const zeilen = (page: Page) => hauptbereich(page).locator('.rows li');
const auswahl = (page: Page) => hauptbereich(page).locator('.zeit-summe').filter({ hasText: 'Auswahl' });

test.describe('Stunden gliedern', () => {
  test('Monatsansicht: Summen je Monat, nur der neueste offen, Auf- und Zuklappen', async ({ page }) => {
    await vorbereiten(page);
    await modus(page, 'Monate');
    await expect(koepfe(page)).toHaveCount(3);
    await expect(koepfe(page).nth(0)).toContainText('November 2026');
    await expect(koepfe(page).nth(0)).toContainText('2 Einträge');
    await expect(koepfe(page).nth(0)).toContainText('6,50 h');
    await expect(koepfe(page).nth(1)).toContainText('Oktober 2026');
    await expect(koepfe(page).nth(1)).toContainText('4,50 h');
    await expect(koepfe(page).nth(2)).toContainText('September 2026');
    await expect(koepfe(page).nth(2)).toContainText('2,00 h');
    await expect(koepfe(page).nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(koepfe(page).nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(koepfe(page).nth(2)).toHaveAttribute('aria-expanded', 'false');
    await expect(zeilen(page)).toHaveCount(2);
    await expect(hauptbereich(page).getByText('Pumpe tauschen')).toBeVisible();

    await koepfe(page).nth(1).click();
    await expect(koepfe(page).nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(hauptbereich(page).getByText('Fühler setzen')).toBeVisible();
    await expect(zeilen(page)).toHaveCount(4);
    await koepfe(page).nth(0).click();
    await expect(koepfe(page).nth(0)).toHaveAttribute('aria-expanded', 'false');
    await expect(hauptbereich(page).getByText('Pumpe tauschen')).toHaveCount(0);
    // Touch-Ziel mindestens 44 px hoch.
    expect((await koepfe(page).nth(0).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test('Wochenansicht nennt die Kalenderwoche; Ansicht und Sortierung bleiben nach Neuladen', async ({ page }) => {
    await vorbereiten(page);
    await modus(page, 'Wochen');
    await expect(koepfe(page)).toHaveCount(3);
    await expect(koepfe(page).nth(0)).toContainText('KW 45 · 02.11.–08.11.2026');
    await expect(koepfe(page).nth(0)).toContainText('6,50 h');
    await expect(koepfe(page).nth(1)).toContainText('KW 41 · 05.10.–11.10.2026');
    await expect(koepfe(page).nth(2)).toContainText('KW 38 · 14.09.–20.09.2026');

    await hauptbereich(page).getByRole('button', { name: /Sortierung/ }).click();
    await expect(koepfe(page).nth(0)).toContainText('KW 38');
    // Der neueste Abschnitt bleibt der aufgeklappte, auch wenn er jetzt unten steht.
    await expect(koepfe(page).nth(2)).toHaveAttribute('aria-expanded', 'true');

    await page.reload();
    await expect(hauptbereich(page).getByRole('button', { name: 'Wochen', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(koepfe(page).nth(0)).toContainText('KW 38');
    await expect(hauptbereich(page).getByRole('button', { name: /Sortierung: älteste zuerst/ })).toBeVisible();
  });

  test('Tage: Sortierung dreht die Reihenfolge um', async ({ page }) => {
    await vorbereiten(page);
    const tage = hauptbereich(page).locator('.group h3 span:first-child');
    await expect(tage).toHaveCount(5);
    await expect(tage.first()).toContainText('05.11.2026');
    await hauptbereich(page).getByRole('button', { name: /Sortierung/ }).click();
    await expect(tage.first()).toContainText('14.09.2026');
    await expect(tage.last()).toContainText('05.11.2026');
  });

  test('Suche und „Nur Regie“ ändern Liste und Summe; Filter zurücksetzen', async ({ page }) => {
    await vorbereiten(page);
    const main = hauptbereich(page);
    await expect(auswahl(page)).toHaveCount(0);
    await main.getByLabel('Stunden durchsuchen').fill('ROHR');
    await expect(zeilen(page)).toHaveCount(2);
    await expect(auswahl(page)).toHaveText('Auswahl: 3,50 h von 13,00 h');
    await main.getByLabel('Stunden durchsuchen').fill('bernd'); // Mitarbeiter
    await expect(zeilen(page)).toHaveCount(2);
    await expect(auswahl(page)).toHaveText('Auswahl: 5,50 h von 13,00 h');
    await main.getByLabel('Stunden durchsuchen').fill('');
    await main.getByRole('button', { name: 'Nur Regie' }).click();
    await expect(zeilen(page)).toHaveCount(2);
    await expect(auswahl(page)).toHaveText('Auswahl: 7,00 h von 13,00 h');
    await main.getByLabel('Stunden durchsuchen').fill('rohr');
    await expect(main.getByText('Keine Treffer')).toBeVisible();
    await main.getByRole('button', { name: 'Filter zurücksetzen' }).click();
    await expect(zeilen(page)).toHaveCount(5);
    await expect(auswahl(page)).toHaveCount(0);
    // Suche wird nicht gemerkt.
    await main.getByLabel('Stunden durchsuchen').fill('pumpe');
    await page.reload();
    await expect(hauptbereich(page).getByLabel('Stunden durchsuchen')).toHaveValue('');
  });

  test('Am iPhone-Format (390 px) gibt es kein horizontales Scrollen und die Bedienelemente brauchen höchstens zwei Zeilen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await vorbereiten(page);
    const kein = async () => {
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(sw).toBeLessThanOrEqual(cw);
      const breit = await page.evaluate(() => [...document.querySelectorAll('.main *')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).length);
      expect(breit).toBe(0);
    };
    await kein();
    const zeile = hauptbereich(page).locator('.zeit-zeile');
    await expect(zeile).toHaveCount(2);
    expect((await zeile.nth(0).boundingBox())!.height).toBeLessThan(60);
    expect((await zeile.nth(1).boundingBox())!.height).toBeLessThan(60);
    await modus(page, 'Wochen');
    await kein();
    await modus(page, 'Monate');
    await koepfe(page).nth(1).click();
    await kein();
  });
});

/** Zweites „Gerät“: eigener Browser-Kontext mit leerer Datenbank. */
async function geraet(browser: Browser, info: TestInfo): Promise<{ kontext: BrowserContext; seite: Page }> {
  const u = info.project.use;
  const kontext = await browser.newContext({ baseURL: u.baseURL, locale: 'de-DE', viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, acceptDownloads: true });
  const seite = await kontext.newPage();
  seite.on('dialog', (d) => d.accept());
  return { kontext, seite };
}

test.describe('Abgerechnet und offen', () => {
  test('Einzelner Eintrag, Sammelaktion je Monat, Filter und Summenzeile', async ({ page }) => {
    await vorbereiten(page);
    const main = hauptbereich(page);
    const summe = main.locator('.zeit-summe').first();
    await expect(summe).toHaveText('Offen: 13,00 h · Abgerechnet: 0,00 h');

    // Einzeln im Formular ankreuzen (Regler einstellen, 2,5 h).
    await main.getByText('Regler einstellen').click();
    await page.getByLabel('Bereits abgerechnet').check();
    await speichern(page);
    await expect(main.locator('.rows li').filter({ hasText: 'Regler einstellen' }).locator('.chip.billed')).toHaveText('abgerechnet');
    await expect(summe).toHaveText('Offen: 10,50 h · Abgerechnet: 2,50 h');

    // Sammelaktion für den Oktober; die Rückfrage nennt Anzahl und Summe.
    const fragen: string[] = [];
    page.on('dialog', (d) => fragen.push(d.message()));
    await modus(page, 'Monate');
    await main.getByRole('button', { name: 'Oktober 2026: als abgerechnet markieren' }).click();
    await expect.poll(() => tabelle(page, 'times').then((t) => t.filter((x) => x.abgerechnet).length)).toBe(3);
    expect(fragen.at(-1)).toMatch(/Oktober 2026.*2 Einträge.*4,50 h.*als abgerechnet/);
    await expect(summe).toHaveText('Offen: 6,00 h · Abgerechnet: 7,00 h');
    await expect(main.getByRole('button', { name: 'Oktober 2026: wieder öffnen' })).toBeVisible();

    // Wieder öffnen.
    await main.getByRole('button', { name: 'Oktober 2026: wieder öffnen' }).click();
    await expect.poll(() => tabelle(page, 'times').then((t) => t.filter((x) => x.abgerechnet).length)).toBe(1);
    expect(fragen.at(-1)).toMatch(/Oktober 2026.*2 Einträge.*4,50 h.*offen/);
    await expect(summe).toHaveText('Offen: 10,50 h · Abgerechnet: 2,50 h');

    // Filter „Offen“ (Tage): nur offene Zeilen, Summenzeile stimmt.
    await modus(page, 'Tage');
    await main.getByLabel('Abrechnungsstatus').selectOption('offen');
    await expect(zeilen(page)).toHaveCount(4);
    await expect(main.locator('.chip.billed')).toHaveCount(0);
    await expect(auswahl(page)).toHaveText('Auswahl: 10,50 h von 13,00 h');
    await main.getByLabel('Abrechnungsstatus').selectOption('abgerechnet');
    await expect(zeilen(page)).toHaveCount(1);
    await expect(auswahl(page)).toHaveText('Auswahl: 2,50 h von 13,00 h');

    // Sammelaktion für die Auswahl: Offen + „Nur Regie“ = 2 Einträge, 7,00 h.
    await main.getByLabel('Abrechnungsstatus').selectOption('offen');
    await main.getByRole('button', { name: 'Nur Regie' }).click();
    await main.getByRole('button', { name: 'Alle angezeigten offenen Stunden als abgerechnet markieren' }).click();
    await expect.poll(() => tabelle(page, 'times').then((t) => t.filter((x) => x.abgerechnet).length)).toBe(3);
    expect(fragen.at(-1)).toMatch(/2 Einträge.*7,00 h/);
    await expect(main.getByText('Keine Treffer')).toBeVisible();
  });

  test('Bericht „Nur offene“ summiert nur offene; Unterschrift gilt nur für „Alle Stunden“', async ({ page }) => {
    await vorbereiten(page);
    const main = hauptbereich(page);
    // 14.09. (2,00 h) abgerechnet markieren.
    await main.getByText('Rohrleitung Keller').click();
    await page.getByLabel('Bereits abgerechnet').check();
    await speichern(page);
    const [p] = await tabelle(page, 'projects');
    await page.goto(`/#/p/${p.id}/bericht`);
    const bericht = page.locator('.report');
    await expect(bericht.locator('tfoot')).toContainText('13,00 h');
    await unterschreiben(page);

    await page.getByRole('button', { name: 'Nur offene', exact: true }).click();
    await expect(bericht.locator('tfoot')).toContainText('11,00 h');
    await expect(bericht.locator('tbody tr')).toHaveCount(4);
    await expect(bericht.getByText('Nur offene Stunden')).toBeVisible();
    await expect(bericht.locator('.signatures img')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kunde unterschreiben lassen' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Nur abgerechnete', exact: true }).click();
    await expect(bericht.locator('tfoot')).toContainText('2,00 h');
    await expect(bericht.locator('.signatures img')).toHaveCount(0);

    await page.getByRole('button', { name: 'Alle Stunden', exact: true }).click();
    await expect(bericht.locator('.signatures img')).toHaveCount(1);
  });

  test('Die Kennzeichnung übersteht Sicherung und Einspielen; Übersicht nennt die offenen Stunden', async ({ page, browser }, info) => {
    await baustelleAnlegen(page, { name: 'Bad Abgleich', gewerke: ['Sanitär'] });
    await tab(page, 'Stunden');
    await stundenDirekt(page, '3', 'Rohinstallation');
    await stundenDirekt(page, '2', 'Fliesen');
    await hauptbereich(page).getByText('Rohinstallation').click();
    await page.getByLabel('Bereits abgerechnet').check();
    await speichern(page);
    await tab(page, 'Übersicht');
    await expect(hauptbereich(page).locator('.stat').first()).toContainText('offen 2,00 h');

    const ordner = mkdtempSync(join(tmpdir(), 'stunden-'));
    const datei = join(ordner, 'sicherung.json');
    await sicherungErstellen(page, datei);

    const { kontext, seite: b } = await geraet(browser, info);
    try {
      await b.goto('/#/einstellungen');
      await b.locator('input[type=file]').setInputFiles(datei);
      await expect(hauptbereich(b).getByText(/unverändert/)).toBeVisible();
      const zeilenB = await tabelle(b, 'times');
      expect(zeilenB).toHaveLength(2);
      expect(zeilenB.find((t) => t.taetigkeit === 'Rohinstallation').abgerechnet).toBe(true);
      expect(zeilenB.find((t) => t.taetigkeit === 'Fliesen').abgerechnet).toBeFalsy();
      await b.goto('/#/');
      await b.locator('.card-link').first().click();
      await tab(b, 'Stunden');
      await expect(hauptbereich(b).locator('.chip.billed')).toHaveCount(1);
      await expect(hauptbereich(b).locator('.zeit-summe').first()).toHaveText('Offen: 2,00 h · Abgerechnet: 3,00 h');
    } finally {
      await kontext.close();
    }
  });
});
