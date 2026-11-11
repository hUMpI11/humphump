import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect, hauptbereich, baustelleAnlegen, tab, tabelle, stundenDirekt, sicherungErstellen, sheetGeschlossen } from './helpers';

// Pfad ohne Umlaute: Mit Umlauten im Pfad übernimmt Chromium die Datei im Datei-Eingabefeld nicht.
const ordner = () => mkdtempSync(join(tmpdir(), 'haertung-'));

const ALLE_TABELLEN = ['projects', 'times', 'materials', 'notes', 'photos', 'sketches', 'blobs', 'signatures', 'protocols', 'tombstones', 'settings'];

type Zeile = Record<string, unknown>;

function sicherungsdatei(pfad: string, tables: Record<string, Zeile[]>) {
  writeFileSync(pfad, JSON.stringify({ format: 'baustellenbuch-backup', version: 1, erstellt: new Date().toISOString(), tables }));
  return pfad;
}

const projektZeile = (o: Zeile = {}): Zeile => ({
  id: 'fremd-1', name: 'Fremdbaustelle', kunde: '', adresse: '', auftragsnr: '', gewerke: [], status: 'aktiv', beschreibung: '', createdAt: 1000, updatedAt: 1000, ...o,
});

async function einspielen(page: Page, datei: string, erwartung: RegExp = /Sicherung zusammengeführt/) {
  await page.goto('/#/'); // Einstellungen neu aufbauen, damit keine Meldung vom vorherigen Einspielen stehen bleibt
  await page.goto('/#/einstellungen');
  await page.locator('input[type=file]').setInputFiles(datei);
  const meldung = hauptbereich(page).getByText(erwartung);
  await expect(meldung).toBeVisible();
  return (await meldung.first().textContent()) ?? '';
}

async function geraet(browser: Browser, info: TestInfo): Promise<{ kontext: BrowserContext; seite: Page }> {
  const u = info.project.use;
  const kontext = await browser.newContext({ baseURL: u.baseURL, locale: 'de-DE', viewport: u.viewport, userAgent: u.userAgent, isMobile: u.isMobile, hasTouch: u.hasTouch, acceptDownloads: true });
  const seite = await kontext.newPage();
  seite.on('dialog', (d) => d.accept());
  return { kontext, seite };
}

async function notizUmbenennen(page: Page, von: string, nach: string) {
  await page.goto('/#/');
  await page.locator('.card-link').first().click();
  await tab(page, 'Notizen');
  await hauptbereich(page).getByText(von).click();
  await page.getByLabel('Titel', { exact: true }).fill(nach);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await sheetGeschlossen(page);
}

test.describe('Einspielen: kaputte und präparierte Sicherungen', () => {
  test('kaputtes Base64 in einem späteren Datensatz: alles oder nichts, lokaler Stand unverändert', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Bad Huber', gewerke: ['Sanitär'] });
    await tab(page, 'Stunden');
    await stundenDirekt(page, '3', 'Rohinstallation');
    await page.goto('/#/einstellungen');
    const vorher: Record<string, unknown[]> = {};
    for (const n of ALLE_TABELLEN) vorher[n] = await tabelle(page, n);
    expect(vorher.projects).toHaveLength(1);

    const datei = sicherungsdatei(join(ordner(), 'kaputt.json'), {
      projects: [projektZeile({ id: 'gut-1', name: 'Gültig und früh in der Datei' })],
      photos: [{ id: 'f1', projectId: 'gut-1', datum: '2026-05-04', caption: '', thumb: { __b64: '@@@ kein base64 @@@' }, createdAt: 1000 }],
    });
    const meldung = await einspielen(page, datei, /Einspielen fehlgeschlagen/);
    expect(meldung).toMatch(/beschädigt/);
    expect(meldung).toMatch(/nichts verändert/);

    for (const n of ALLE_TABELLEN) expect(await tabelle(page, n), `Tabelle ${n}`).toEqual(vorher[n]);
  });

  test('Projekt mit name als Objekt wird übersprungen, die Startseite funktioniert weiter', async ({ page }) => {
    const datei = sicherungsdatei(join(ordner(), 'objekt.json'), {
      projects: [projektZeile({ id: 'bose-1', name: { eingeschmuggelt: true } }), projektZeile({ id: 'gut-1', name: 'Gültige Baustelle' })],
    });
    const meldung = await einspielen(page, datei);
    expect(meldung).toMatch(/1 neu/);
    expect(meldung).toMatch(/1 ungültig und übersprungen/);
    expect((await tabelle(page, 'projects')).map((p) => p.id)).toEqual(['gut-1']);

    await page.goto('/#/');
    await expect(page.locator('.card-link')).toHaveCount(1);
    await expect(page.locator('.card-link').first()).toContainText('Gültige Baustelle');
  });

  test('Löschvermerk mit deletedAt 1e15 löscht nicht dauerhaft', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Bad Huber', gewerke: ['Sanitär'] });
    const p0 = (await tabelle(page, 'projects'))[0];
    const dir = ordner();
    const alt = sicherungsdatei(join(dir, 'alt.json'), { projects: [p0] });
    const vermerk = sicherungsdatei(join(dir, 'vermerk.json'), {
      tombstones: [{ key: `projects:${p0.id}`, table: 'projects', id: p0.id, deletedAt: 1e15 }],
    });

    // Der Vermerk löscht die Baustelle, wird aber auf „jetzt“ begrenzt statt auf 1e15.
    const vorher = Date.now();
    const m1 = await einspielen(page, vermerk);
    expect(m1).toMatch(/1 gelöscht/);
    expect(m1).toMatch(/1 Zeitstempel korrigiert/);
    expect(await tabelle(page, 'projects')).toHaveLength(0);
    const tombs = await tabelle(page, 'tombstones');
    expect(tombs).toHaveLength(1);
    expect(tombs[0].deletedAt).toBeGreaterThanOrEqual(vorher);
    expect(tombs[0].deletedAt).toBeLessThan(Date.now() + 60_000);

    // Der alte Stand bleibt gelöscht …
    await einspielen(page, alt);
    expect(await tabelle(page, 'projects')).toHaveLength(0);

    // … eine spätere normale Sicherung (Baustelle danach bearbeitet) bringt sie zurück.
    const neuer = sicherungsdatei(join(dir, 'neuer.json'), { projects: [{ ...p0, updatedAt: tombs[0].deletedAt + 1000 }] });
    expect(await einspielen(page, neuer)).toMatch(/1 neu/);
    expect(await tabelle(page, 'projects')).toHaveLength(1);

    // Danach lokal geändert (Baustelle abschließen): Der lokale Löschvermerk (begrenzt auf „jetzt“, nicht 1e15)
    // und der alte Stand aus `alt.json` verdrängen die neuere lokale Änderung nicht.
    await page.goto('/#/');
    await page.locator('.card-link').first().click();
    await page.getByRole('button', { name: 'Baustelle abschließen' }).click();
    await expect.poll(async () => (await tabelle(page, 'projects'))[0]?.status).toBe('abgeschlossen');
    expect(await einspielen(page, alt)).toMatch(/1 unverändert/);
    const nach = await tabelle(page, 'projects');
    expect(nach).toHaveLength(1);
    expect(nach[0].status).toBe('abgeschlossen');
  });

  test('Datensatz mit updatedAt 9e15: übernommen mit begrenztem Zeitstempel, danach änderbar und abgleichbar', async ({ page, browser }, info) => {
    const dir = ordner();
    const vorher = Date.now();
    const datei = sicherungsdatei(join(dir, 'zukunft.json'), {
      projects: [projektZeile({ id: 'z-1', name: 'Zukunftsbaustelle', updatedAt: 9e15 })],
      notes: [{ id: 'n-1', projectId: 'z-1', datum: '2026-05-04', titel: 'Ausgang', text: '', createdAt: 1000, updatedAt: 9e15 }],
    });
    const meldung = await einspielen(page, datei);
    expect(meldung).toMatch(/2 neu/);
    expect(meldung).toMatch(/2 Zeitstempel korrigiert/);
    const projekt = (await tabelle(page, 'projects'))[0];
    const notiz = (await tabelle(page, 'notes'))[0];
    for (const ts of [projekt.updatedAt, notiz.updatedAt]) {
      expect(ts).toBeGreaterThanOrEqual(vorher);
      expect(ts).toBeLessThan(Date.now() + 60_000);
    }

    // Lokal ändern: Der neue Stand ist jünger als der begrenzte, nicht 9e15 – und trotzdem maßgeblich.
    await notizUmbenennen(page, 'Ausgang', 'Geändert');
    const geaendert = (await tabelle(page, 'notes'))[0];
    expect(geaendert.titel).toBe('Geändert');
    expect(geaendert.updatedAt).toBeGreaterThan(notiz.updatedAt);
    expect(geaendert.updatedAt).toBeLessThan(Date.now() + 60_000);

    // Abgleich: Der geänderte Stand erreicht ein zweites Gerät.
    const b1 = join(dir, 'b1.json');
    await sicherungErstellen(page, b1);
    const { kontext, seite: b } = await geraet(browser, info);
    try {
      await b.goto('/#/');
      await b.getByText('Noch keine Baustelle').waitFor();
      await einspielen(b, b1);
      expect((await tabelle(b, 'notes'))[0].titel).toBe('Geändert');
    } finally {
      await kontext.close();
    }
  });
});
