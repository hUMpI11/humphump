import {
  abbrechen,
  baustelleAnlegen,
  expect,
  hauptbereich,
  materialErfassen,
  sheetGeschlossen,
  speichern,
  stundenDirekt,
  stundenUhrzeit,
  tab,
  test,
  timerLoeschen,
  timerStartVerschieben,
} from './helpers';

test.describe('Baustelle und Stunden', () => {
  test('Baustelle anlegen mit Kontakt und Gewerken', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Noch keine Baustelle').waitFor();
    await baustelleAnlegen(page, {
      name: 'Bad Familie Huber',
      kunde: 'Familie Huber',
      ansprechpartner: 'Frau Huber',
      telefon: '0171 234 56 78',
      gewerke: ['Sanitär'],
    });
    const main = hauptbereich(page);
    await expect(main.getByText('Bad Familie Huber').first()).toBeVisible();
    await expect(main.locator('a[href^="tel:"]')).toHaveAttribute('href', 'tel:01712345678');
  });

  test('Stunden per Uhrzeit mit Pause und Tätigkeit; Mitarbeiter aus Profil', async ({ page }) => {
    await page.goto('/#/einstellungen');
    await page.getByLabel('Dein Name').fill('Max Muster');
    await page.getByLabel('Firma').fill('Muster Gebäudetechnik GmbH');
    await baustelleAnlegen(page, { name: 'Schule Musterstadt', gewerke: ['MSR'] });
    await tab(page, 'Stunden');
    await page.getByRole('button', { name: 'Stunden eintragen' }).click();
    await expect(page.getByLabel('Mitarbeiter')).toHaveValue('Max Muster');
    await page.getByLabel('Beginn', { exact: true }).fill('07:00');
    await page.getByLabel('Ende', { exact: true }).fill('16:00');
    await page.getByLabel('Pause (min)').fill('45');
    await expect(page.locator('.sheet').getByText('8,25 h').first()).toBeVisible();
    await page.getByRole('button', { name: 'Datenpunktprüfung' }).click();
    await page.getByRole('button', { name: 'Inbetriebnahme' }).click();
    await speichern(page);
    const main = hauptbereich(page);
    await expect(main.getByText('Datenpunktprüfung, Inbetriebnahme')).toBeVisible();
    await expect(main.getByText('Gesamt: 8,25 h')).toBeVisible();
  });

  test('Direkteingabe und Regie werden summiert', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Heizung Müller', gewerke: ['Heizung'] });
    await tab(page, 'Stunden');
    await stundenUhrzeit(page, '07:00', '15:45', 'Rohrleitungen');
    await stundenDirekt(page, '2,5', 'Zusätzlicher Fühler nach Wunsch Bauleitung', true);
    const main = hauptbereich(page);
    await expect(main.getByText('Regie', { exact: true })).toBeVisible();
    await expect(main.getByText('Gesamt: 11,25 h')).toBeVisible();
    await expect(main.locator('.rows li')).toHaveCount(2);
  });

  test('Eintrag kopieren legt einen weiteren für heute an', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Praxis Dr. Lang', gewerke: ['Elektro'] });
    await tab(page, 'Stunden');
    const main = hauptbereich(page);
    await stundenUhrzeit(page, '07:00', '12:00', 'Leitungen verlegt');
    await stundenUhrzeit(page, '13:00', '15:00', 'Zusätzliche Steckdosen', true);
    await main.locator('.rows li').first().click();
    await page.getByRole('button', { name: 'Als neuen Eintrag für heute kopieren' }).click();
    await sheetGeschlossen(page);
    await expect(main.locator('.rows li')).toHaveCount(3);
  });

  test('Doppeltipp auf Speichern erzeugt nur einen Eintrag', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Heizung Müller', gewerke: ['Heizung'] });
    await tab(page, 'Stunden');
    await page.getByRole('button', { name: 'Stunden eintragen' }).click();
    await page.getByLabel('… oder Stunden direkt').fill('3');
    await page.getByRole('button', { name: 'Speichern', exact: true }).dblclick();
    await sheetGeschlossen(page);
    const main = hauptbereich(page);
    await expect(main.locator('.rows li')).toHaveCount(1);
    // Ein zweiter Eintrag würde die Summe verdoppeln; hier auf einen späteren Zustand warten.
    await expect(main.getByText('Gesamt: 3,00 h')).toBeVisible();
  });
});

test.describe('Timer', () => {
  test.beforeEach(async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Bad Familie Huber', gewerke: ['Sanitär'] });
    await tab(page, 'Stunden');
  });

  const start = (page: import('@playwright/test').Page) =>
    hauptbereich(page).getByRole('button', { name: 'Start', exact: true });
  const stopp = (page: import('@playwright/test').Page) =>
    hauptbereich(page).getByRole('button', { name: 'Stopp', exact: true });
  const laeuft = (page: import('@playwright/test').Page) =>
    hauptbereich(page).getByText('Zeit läuft', { exact: true });

  test('Start, übersteht Neuladen; Abbrechen im Stopp-Dialog lässt ihn laufen', async ({ page }) => {
    await start(page).click();
    await expect(laeuft(page)).toBeVisible();
    await page.reload();
    await expect(laeuft(page)).toBeVisible();
    await stopp(page).click();
    await expect(page.getByLabel('Beginn', { exact: true })).not.toHaveValue('');
    await abbrechen(page);
    await expect(laeuft(page)).toBeVisible();
    await timerLoeschen(page);
  });

  test('Stopp rundet auf Viertelstunden und schlägt bei mehr als 6 h 30 min Pause vor', async ({ page }) => {
    await start(page).click();
    await expect(laeuft(page)).toBeVisible();
    await timerStartVerschieben(page, 7 * 60 + 40);
    await page.reload();
    await stopp(page).click();
    const von = await page.getByLabel('Beginn', { exact: true }).inputValue();
    const bis = await page.getByLabel('Ende', { exact: true }).inputValue();
    expect(von).toMatch(/:(00|15|30|45)$/);
    expect(bis).toMatch(/:(00|15|30|45)$/);
    await expect(page.getByLabel('Pause (min)')).toHaveValue('30');
    await page.locator('.sheet textarea').fill('Rohinstallation, Sonderwunsch Nische');
    await page.getByLabel('Gefahrene Kilometer (optional)').fill('24,5');
    await speichern(page);
    const main = hauptbereich(page);
    await expect(main.getByText('24,5 km')).toBeVisible();
    await expect(laeuft(page)).toHaveCount(0);
    // Eigene Tätigkeit wird beim nächsten Mal vorgeschlagen.
    await page.getByRole('button', { name: 'Stunden eintragen' }).click();
    // Auf das Formular eingrenzen: Die Listenzeile dahinter enthält denselben Text und ist ebenfalls ein Button.
    await expect(page.locator('.sheet').getByRole('button', { name: 'Sonderwunsch Nische', exact: true })).toBeVisible();
    await abbrechen(page);
  });

  test('Zeit verwerfen erzeugt keinen Eintrag', async ({ page }) => {
    await start(page).click();
    await expect(laeuft(page)).toBeVisible();
    await stopp(page).click();
    await page.getByRole('button', { name: /Zeit verwerfen/ }).click();
    const main = hauptbereich(page);
    await expect(main.getByText('Zeiterfassung')).toBeVisible();
    await expect(laeuft(page)).toHaveCount(0);
    await expect(main.locator('.rows li')).toHaveCount(0);
  });

  test('Vergessener Timer: Ende wird nicht geraten, Speichern erst mit Ende', async ({ page }) => {
    await start(page).click();
    await expect(laeuft(page)).toBeVisible();
    await timerStartVerschieben(page, 20 * 60);
    await page.reload();
    await hauptbereich(page).getByText('vergessen zu stoppen?').waitFor();
    await stopp(page).click();
    await expect(page.getByLabel('Ende', { exact: true })).toHaveValue('');
    await expect(page.getByText('Bitte das tatsächliche Ende eintragen')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Speichern', exact: true })).toBeDisabled();
    const von = await page.getByLabel('Beginn', { exact: true }).inputValue();
    const [h, m] = von.split(':').map(Number);
    const bis = `${String((h + 8) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    await page.getByLabel('Ende', { exact: true }).fill(bis);
    await speichern(page);
    const main = hauptbereich(page);
    await expect(main.getByText('8,00 h').first()).toBeVisible();
    await expect(main.getByText('Zeiterfassung')).toBeVisible();
  });
});

test.describe('Material', () => {
  test.beforeEach(async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Schule Musterstadt', gewerke: ['MSR', 'Lüftung'] });
    await tab(page, 'Material');
  });

  test('Vorschlag setzt Einheit, Serienerfassung bleibt offen', async ({ page }) => {
    await page.getByRole('button', { name: 'Material erfassen' }).click();
    await page.getByRole('button', { name: 'Temperaturfühler PT1000' }).click();
    await page.getByLabel('Menge *').fill('4');
    await page.getByRole('button', { name: 'Speichern & nächste Position' }).click();
    await page.locator('.sheet select').first().selectOption('lueftung');
    await page.getByLabel('Bezeichnung *').fill('wickel');
    await page.getByRole('button', { name: 'Wickelfalzrohr DN125' }).click();
    await expect(page.getByLabel('Einheit')).toHaveValue('m');
    await page.getByLabel('Menge *').fill('12,5');
    await speichern(page);
    const main = hauptbereich(page);
    await expect(main.getByText('12,5 m')).toBeVisible();
    await expect(main.getByText('Temperaturfühler PT1000')).toBeVisible();
  });

  test('Eigenes Material wird zum ersten Vorschlag', async ({ page }) => {
    await page.getByRole('button', { name: 'Material erfassen' }).click();
    await page.getByLabel('Bezeichnung *').fill('Duschrinne 80 cm');
    await page.getByLabel('Menge *').fill('1');
    await page.getByRole('button', { name: 'Speichern & nächste Position' }).click();
    await expect(page.locator('.suggest button').first()).toHaveText('Duschrinne 80 cm');
    await abbrechen(page);
  });

  test('Summen gleicher Positionen', async ({ page }) => {
    await materialErfassen(page, 'NYM-J 3x1,5', '40');
    await materialErfassen(page, 'NYM-J 3x1,5', '25,5');
    await materialErfassen(page, 'Steckdose', '3', true);
    await page.getByRole('button', { name: 'Summen' }).click();
    await expect(hauptbereich(page).getByText('65,5 Stk')).toBeVisible();
  });
});

test.describe('Notizen und offene Punkte', () => {
  test('Notiz speichern, offenen Punkt anlegen und abhaken', async ({ page }) => {
    await baustelleAnlegen(page, { name: 'Praxis Dr. Lang', gewerke: ['Elektro'] });
    await tab(page, 'Notizen');
    const main = hauptbereich(page);

    await page.getByRole('button', { name: 'Notiz schreiben' }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Absprache Bauleitung');
    await page.locator('.sheet textarea').fill('Zusätzlicher Raumfühler gewünscht.\nAbrechnung als Regie.');
    await speichern(page);
    await expect(main.getByText('Absprache Bauleitung')).toBeVisible();

    await page.getByRole('button', { name: 'Notiz schreiben' }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Silikon grau mitbringen');
    await page.getByText('Offener Punkt').click();
    await speichern(page);
    await expect(main.getByText('Offene Punkte')).toBeVisible();

    await page.getByLabel('Als erledigt abhaken').click();
    await expect(page.getByLabel('Wieder öffnen')).toBeVisible();
    await expect(main.getByText('Offene Punkte')).toHaveCount(0);
  });
});
