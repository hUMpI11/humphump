import {
  baustelleAnlegen,
  ersteBaustelleOeffnen,
  expect,
  hauptbereich,
  istIpad,
  seitenleiste,
  sicherungErstellen,
  speichern,
  stundenDirekt,
  stundenUhrzeit,
  tab,
  test,
} from './helpers';

test.describe('Startseite', () => {
  test('Leere App zeigt den Einstieg', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Noch keine Baustelle')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Baustelle anlegen' })).toBeVisible();
  });

  test('Stunden heute und Woche, Schnellstart und Verwerfen', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Praxis Dr. Lang', gewerke: ['Elektro'] });
    await tab(page, 'Stunden');
    await stundenDirekt(page, '3');
    await stundenDirekt(page, '1,5');
    await page.goto('/#/');
    const heute = seitenleiste(page).locator('.card.today').first();
    await expect(heute).toContainText('4,50 h');
    await expect(heute).toContainText('heute');
    await expect(heute).toContainText('diese Woche');
    await expect(seitenleiste(page).locator('.project-card').getByText('4,50 h')).toBeVisible();

    // Zeit mit einem Tipp starten, über die Startseite stoppen und verwerfen.
    await page.getByLabel('Zeit starten: Praxis Dr. Lang').click();
    await expect(seitenleiste(page).getByText('Zeit läuft', { exact: true })).toBeVisible();
    await page.getByLabel('Laufende Zeit stoppen: Praxis Dr. Lang').click();
    await hauptbereich(page).getByRole('button', { name: 'Stopp', exact: true }).click();
    await page.getByRole('button', { name: /Zeit verwerfen/ }).click();
    await expect(hauptbereich(page).getByText('Zeiterfassung')).toBeVisible();
    await expect(hauptbereich(page).locator('.rows li')).toHaveCount(2);
    await page.goto('/#/');
    await expect(seitenleiste(page).getByText('Zeit läuft', { exact: true })).toHaveCount(0);
  });

  test('Offene Punkte stehen an der Baustelle', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Praxis Dr. Lang', gewerke: ['Elektro'] });
    await tab(page, 'Stunden');
    await stundenDirekt(page, '1');
    await tab(page, 'Notizen');
    await page.getByRole('button', { name: 'Notiz schreiben' }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Silikon grau mitbringen');
    await page.getByText('Offener Punkt').click();
    await speichern(page);
    await page.goto('/#/');
    await expect(seitenleiste(page).locator('.project-card').getByText('1 offen')).toBeVisible();
  });

  test('Sicherungs-Erinnerung erscheint bei Daten ohne Sicherung und verschwindet danach', async ({ page }, testInfo) => {
    await baustelleAnlegen(page, { name: 'Praxis Dr. Lang', gewerke: ['Elektro'] });
    await tab(page, 'Stunden');
    await stundenDirekt(page, '2');
    await page.goto('/#/');
    await expect(seitenleiste(page).locator('.warnbox')).toBeVisible();
    await sicherungErstellen(page, testInfo.outputPath('sicherung.json'));
    await page.goto('/#/');
    await seitenleiste(page).locator('.project-card').waitFor();
    await expect(seitenleiste(page).locator('.warnbox')).toHaveCount(0);
  });

  test('Abschließen, Rechnung offen, abgerechnet', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Praxis Dr. Lang', gewerke: ['Elektro'] });
    await page.getByRole('button', { name: 'Baustelle abschließen' }).click();
    await expect(hauptbereich(page).getByText('Rechnung offen')).toBeVisible();

    await page.goto('/#/');
    await page.getByRole('button', { name: /ohne Rechnung/ }).click();
    await expect(seitenleiste(page).locator('.project-card').getByText('Rechnung offen')).toBeVisible();

    await seitenleiste(page).locator('.card-link').click();
    await page.getByRole('button', { name: 'Als abgerechnet markieren' }).click();
    await expect(hauptbereich(page).getByText('abgerechnet', { exact: true })).toBeVisible();
    await page.goto('/#/');
    await expect(page.getByRole('button', { name: /ohne Rechnung/ })).toHaveCount(0);
  });

  test('Suche filtert die Liste', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Bad Familie Huber', gewerke: ['Sanitär'] });
    await baustelleAnlegen(page, { name: 'Praxis Dr. Lang', gewerke: ['Elektro'] });
    await page.goto('/#/');
    const karten = seitenleiste(page).locator('.project-card');
    await expect(karten).toHaveCount(2);
    await page.getByPlaceholder(/Suchen/).fill('huber');
    await expect(karten).toHaveCount(1);
    await expect(karten.first()).toContainText('Bad Familie Huber');
    await page.getByPlaceholder(/Suchen/).fill('gibtsnicht');
    await expect(page.getByText('Nichts gefunden')).toBeVisible();
  });
});

test.describe('Wochenübersicht', () => {
  test('Summen je Baustelle mit Kilometern, Wochenwechsel', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Bad Familie Huber', gewerke: ['Sanitär'] });
    await tab(page, 'Stunden');
    await page.getByRole('button', { name: 'Stunden eintragen' }).click();
    await page.getByLabel('… oder Stunden direkt').fill('4');
    await page.getByLabel('Gefahrene Kilometer (optional)').fill('24,5');
    await speichern(page);
    await stundenUhrzeit(page, '08:00', '10:00', 'Rohinstallation', true);

    await page.goto('/#/woche');
    const main = hauptbereich(page);
    await main.getByText('Je Baustelle').waitFor();
    await expect(main.getByText('24,5 km').first()).toBeVisible();
    await expect(main.getByText('6,00 h').first()).toBeVisible();
    await expect(main.getByText('Bad Familie Huber').first()).toBeVisible();

    await page.getByLabel('Vorherige Woche').click();
    await expect(main.getByText('Keine Stunden in dieser Woche')).toBeVisible();
  });

  test('Baustelle aus der Wochenübersicht erreichbar, Daten bleiben nach Neuladen', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Bad Familie Huber', gewerke: ['Sanitär'] });
    await tab(page, 'Stunden');
    await stundenDirekt(page, '2');
    await page.goto('/#/woche');
    await page.reload();
    await expect(hauptbereich(page).getByText('2,00 h').first()).toBeVisible();
    await ersteBaustelleOeffnen(page);
  });
});

test.describe('Layout', () => {
  test('iPad: Liste und Detail stehen nebeneinander', async ({ page }, testInfo) => {
    test.skip(!istIpad(testInfo.project.name), 'Zweispaltig nur im iPad-Format');
    await baustelleAnlegen(page, { name: 'Heizung Müller', gewerke: ['Heizung'] });
    const liste = (await seitenleiste(page).boundingBox())!;
    const detail = (await hauptbereich(page).boundingBox())!;
    expect(liste.width).toBeGreaterThan(100);
    expect(detail.width).toBeGreaterThan(300);
    expect(liste.x + liste.width).toBeLessThanOrEqual(detail.x + 1);
    await expect(seitenleiste(page).locator('.project-card')).toContainText('Heizung Müller');
    await expect(hauptbereich(page).getByText('Materialpositionen')).toBeVisible();
  });

  test('Telefon: Detail ersetzt die Liste', async ({ page }, testInfo) => {
    test.skip(istIpad(testInfo.project.name), 'Einspaltig nur im Telefon-Format');
    await baustelleAnlegen(page, { name: 'Heizung Müller', gewerke: ['Heizung'] });
    await expect(seitenleiste(page)).toBeHidden();
    await expect(hauptbereich(page)).toBeVisible();
  });
});
