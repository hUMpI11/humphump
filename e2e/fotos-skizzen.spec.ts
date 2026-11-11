import {
  FOTO,
  FOTO_KLEIN,
  ZEICHENFLAECHE,
  baustelleAnlegen,
  expect,
  hauptbereich,
  istIpad,
  klickRelativ,
  speichern,
  tab,
  tabelle,
  test,
  zeichne,
} from './helpers';

const fotoHochladen = async (page: import('@playwright/test').Page, dateien: string[] = [FOTO]) => {
  await tab(page, 'Fotos');
  await page.locator('input[type=file][multiple]').setInputFiles(dateien);
  await expect(hauptbereich(page).locator('.thumb img')).toHaveCount(dateien.length);
};

test.beforeEach(async ({ page }) => {
  await baustelleAnlegen(page, { name: 'Schule Musterstadt', gewerke: ['MSR', 'Lüftung'] });
});

test.describe('Fotos', () => {
  test('Upload mehrerer Bilder, Kamera-Eingang vorhanden, Beschreibung speichern', async ({ page }) => {
    await tab(page, 'Fotos');
    await hauptbereich(page).getByRole('button', { name: 'Aus Mediathek wählen' }).waitFor();
    await expect(page.locator('input[capture=environment]')).toHaveCount(1);
    await fotoHochladen(page, [FOTO, FOTO_KLEIN]);

    await hauptbereich(page).locator('.thumb').first().click();
    await page.getByLabel('Beschreibung').fill('Verteiler UG');
    await expect(page.locator('img.photo-full')).toBeVisible();
    // Das Vollbild muss wirklich dekodierbar sein, nicht nur ein leeres img-Element.
    const breite = await page.locator('img.photo-full').evaluate((i: HTMLImageElement) => i.decode().then(() => i.naturalWidth));
    expect(breite).toBeGreaterThan(0);

    await speichern(page);
    await expect(hauptbereich(page).getByText('Verteiler UG')).toBeVisible();
    const fotos = await tabelle(page, 'photos');
    expect(fotos).toHaveLength(2);
    expect(fotos.map((f) => f.caption)).toContain('Verteiler UG');
  });

  test('Foto bemaßen: Striche, Linie, Text, Rechteck, Rückgängig und Wiederholen', async ({ page }) => {
    await fotoHochladen(page);
    await hauptbereich(page).locator('.thumb').first().click();
    await page.getByRole('button', { name: 'Im Foto zeichnen / bemaßen' }).click();

    const flaeche = page.locator(ZEICHENFLAECHE);
    await flaeche.waitFor();
    await page.getByLabel('Farbe #d92d20').click();
    await zeichne(page, flaeche, [[0.2, 0.2], [0.4, 0.35], [0.3, 0.5], [0.6, 0.6]]);
    await page.getByLabel('Linie').click();
    await zeichne(page, flaeche, [[0.1, 0.85], [0.9, 0.85]]);
    await page.getByLabel('Text / Maß', { exact: true }).click();
    await klickRelativ(page, flaeche, 0.4, 0.78);
    await page.locator('input[name=text]').fill('2,45 m');
    await page.getByRole('button', { name: 'Einfügen' }).click();
    await page.getByLabel('Rechteck').click();
    await zeichne(page, flaeche, [[0.6, 0.15], [0.85, 0.4]]);
    await page.getByLabel('Rückgängig').click();
    await page.getByLabel('Wiederholen').click();
    await page.getByRole('button', { name: 'Fertig' }).click();

    await expect(page.locator('.thumbs.wide .thumb img')).toHaveCount(1);
    // Strich, Linie, Text, Rechteck (Rückgängig und Wiederholen heben sich auf).
    await expect.poll(async () => (await tabelle(page, 'sketches')).map((s) => s.strokes.map((t: any) => t.tool))).toEqual([['pen', 'line', 'text', 'rect']]);
  });
});

test.describe('Skizzen', () => {
  test('Freie Skizze wird als Vektordaten gespeichert, Radierer ist ein eigener Strich', async ({ page }) => {
    await tab(page, 'Skizzen');
    await page.getByLabel('Neue Skizze').click();
    const flaeche = page.locator(ZEICHENFLAECHE);
    await flaeche.waitFor();
    await page.getByLabel('Titel der Skizze').fill('Schema Lüftung');
    await zeichne(page, flaeche, [[0.1, 0.1], [0.5, 0.3], [0.2, 0.6], [0.8, 0.8]]);
    await zeichne(page, flaeche, [[0.1, 0.9], [0.9, 0.9]]);
    await page.getByLabel('Radierer').click();
    await zeichne(page, flaeche, [[0.1, 0.89], [0.9, 0.91]]);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(hauptbereich(page).getByText('Schema Lüftung')).toBeVisible();
    await expect(hauptbereich(page).locator('.thumbs.wide .thumb')).toHaveCount(1);

    const skizzen = await tabelle(page, 'sketches');
    expect(skizzen).toHaveLength(1);
    expect(Array.isArray(skizzen[0].strokes)).toBe(true);
    // Zwei Stifte plus Radierer (der Radierer ist selbst ein Strich); Punkte als Vektoren.
    expect(skizzen[0].strokes.map((s: any) => s.tool)).toEqual(['pen', 'pen', 'eraser']);
    expect(skizzen[0].strokes[0].points.length).toBeGreaterThan(2);
    expect((await tabelle(page, 'blobs')).length).toBeGreaterThanOrEqual(1);
  });

  test('Leere Skizze wird verworfen', async ({ page }) => {
    await tab(page, 'Skizzen');
    await page.getByLabel('Neue Skizze').click();
    await page.locator(ZEICHENFLAECHE).waitFor();
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByLabel('Neue Skizze')).toBeVisible();
    await expect(hauptbereich(page).locator('.thumbs.wide .thumb')).toHaveCount(0);
    expect(await tabelle(page, 'sketches')).toHaveLength(0);
  });

  test('Skizze erneut öffnen: Striche sind noch da', async ({ page }) => {
    await tab(page, 'Skizzen');
    await page.getByLabel('Neue Skizze').click();
    const flaeche = page.locator(ZEICHENFLAECHE);
    await flaeche.waitFor();
    await zeichne(page, flaeche, [[0.1, 0.1], [0.5, 0.3], [0.2, 0.6]]);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await hauptbereich(page).locator('.thumbs.wide .thumb').first().click();
    await flaeche.waitFor();
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(hauptbereich(page).locator('.thumbs.wide .thumb')).toHaveCount(1);
    const skizzen = await tabelle(page, 'sketches');
    expect(skizzen).toHaveLength(1);
    expect(skizzen[0].strokes.length).toBe(1);
  });

  test('iPad: Skizzen-Editor füllt den Bildschirm', async ({ page }, testInfo) => {
    test.skip(!istIpad(testInfo.project.name), 'Vollbild-Prüfung nur im iPad-Format');
    await tab(page, 'Skizzen');
    await page.getByLabel('Neue Skizze').click();
    const flaeche = page.locator(ZEICHENFLAECHE);
    await flaeche.waitFor();
    const vp = page.viewportSize()!;
    const box = (await flaeche.boundingBox())!;
    expect(box.width).toBeGreaterThan(vp.width * 0.5);
    expect(box.height).toBeGreaterThan(vp.height * 0.5);
    // Der Editor ersetzt die zweispaltige Ansicht: Liste und Detail sind nicht mehr im Dokument.
    await expect(page.locator('.sidebar')).toHaveCount(0);
  });
});
