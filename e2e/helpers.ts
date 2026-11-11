import { test as base, expect, type Locator, type Page, type Download } from '@playwright/test';
import { readFileSync } from 'node:fs';

export { expect };

export const FOTO = 'public/icon-512.png';
export const FOTO_KLEIN = 'public/icon-192.png';

type Seitenfehler = { liste: string[]; erlaube: (muster: RegExp) => void };

/**
 * Basis-Test: Dialoge werden bestätigt, Konsolen- und Seitenfehler werden gesammelt
 * und am Ende des Tests als Fehlschlag gewertet (außer ausdrücklich erlaubte).
 */
export const test = base.extend<{ seitenfehler: Seitenfehler }>({
  seitenfehler: [
    async ({ page }, use) => {
      const liste: string[] = [];
      const erlaubt: RegExp[] = [];
      page.on('console', (m) => m.type() === 'error' && liste.push(m.text()));
      page.on('pageerror', (e) => liste.push('PAGEERROR ' + e.message));
      page.on('dialog', (d) => d.accept());
      await use({ liste, erlaube: (re) => erlaubt.push(re) });
      const echte = liste.filter((f) => !erlaubt.some((re) => re.test(f)));
      expect(echte, 'Konsolen- und Seitenfehler').toEqual([]);
    },
    { auto: true },
  ],
});

export const hauptbereich = (page: Page) => page.locator('.main');
export const seitenleiste = (page: Page) => page.locator('.sidebar');

export function istIpad(projektName: string): boolean {
  return projektName.startsWith('ipad');
}

/** Die Seite ist wieder bedienbar, wenn der Dialog (Sheet) verschwunden ist. */
export async function sheetGeschlossen(page: Page) {
  await page.locator('.sheet').waitFor({ state: 'detached' });
}

export async function speichern(page: Page) {
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await sheetGeschlossen(page);
}

export async function abbrechen(page: Page) {
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await sheetGeschlossen(page);
}

export interface BaustelleOptionen {
  name: string;
  gewerke?: string[];
  kunde?: string;
  adresse?: string;
  nummer?: string;
  ansprechpartner?: string;
  telefon?: string;
}

/** Legt über das Formular eine Baustelle an und landet in deren Übersicht. */
export async function baustelleAnlegen(page: Page, o: BaustelleOptionen) {
  await page.goto('/#/neu');
  await page.getByLabel('Bezeichnung *').fill(o.name);
  if (o.kunde) await page.getByLabel('Kunde / Auftraggeber').fill(o.kunde);
  if (o.adresse) await page.getByLabel('Adresse').fill(o.adresse);
  if (o.nummer) await page.getByLabel('Auftrags- / Projektnummer').fill(o.nummer);
  if (o.ansprechpartner) await page.getByLabel('Ansprechpartner vor Ort').fill(o.ansprechpartner);
  if (o.telefon) await page.getByLabel('Telefon').fill(o.telefon);
  for (const g of o.gewerke ?? []) await page.getByRole('button', { name: g, exact: true }).click();
  await page.getByRole('button', { name: 'Baustelle anlegen' }).click();
  await hauptbereich(page).getByText('Materialpositionen').waitFor();
}

export async function tab(page: Page, name: string) {
  await hauptbereich(page).getByRole('link', { name, exact: true }).click();
}

/** Baustelle über die Liste öffnen. */
export async function ersteBaustelleOeffnen(page: Page) {
  await page.goto('/#/');
  await page.locator('.card-link').first().click();
  await hauptbereich(page).getByText('Materialpositionen').waitFor();
}

export async function stundenDirekt(page: Page, stunden: string, taetigkeit?: string, regie = false) {
  await page.getByRole('button', { name: 'Stunden eintragen' }).click();
  await page.getByLabel('… oder Stunden direkt').fill(stunden);
  if (taetigkeit) await page.getByLabel('Tätigkeit').fill(taetigkeit);
  if (regie) await page.getByText('Regiearbeit').click();
  await speichern(page);
}

export async function stundenUhrzeit(page: Page, von: string, bis: string, text: string, regie = false) {
  await page.getByRole('button', { name: 'Stunden eintragen' }).click();
  await page.getByLabel('Beginn', { exact: true }).fill(von);
  await page.getByLabel('Ende', { exact: true }).fill(bis);
  await page.locator('.sheet textarea').fill(text);
  if (regie) await page.getByText('Regiearbeit').click();
  await speichern(page);
}

export async function materialErfassen(page: Page, name: string, menge: string, regie = false) {
  await page.getByRole('button', { name: 'Material erfassen' }).click();
  await page.getByLabel('Bezeichnung *').fill(name);
  await page.getByLabel('Menge *').fill(menge);
  if (regie) await page.getByText('Regie (Zusatzleistung)').click();
  await speichern(page);
}

/** Direktzugriff auf die IndexedDB, um den Timer-Start zurückzudatieren. */
export async function timerStartVerschieben(page: Page, minutenZurueck: number) {
  await page.evaluate(
    (min) =>
      new Promise<void>((fertig, fehler) => {
        const q = indexedDB.open('baustellenbuch');
        q.onerror = () => fehler(q.error);
        q.onsuccess = () => {
          const t = q.result.transaction('settings', 'readwrite');
          const s = t.objectStore('settings');
          const g = s.get('timer');
          g.onsuccess = () => {
            const v = g.result;
            v.value.start = Date.now() - min * 60000;
            s.put(v);
          };
          t.oncomplete = () => fertig();
          t.onerror = () => fehler(t.error);
        };
      }),
    minutenZurueck,
  );
}

export async function timerLoeschen(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((fertig) => {
        const q = indexedDB.open('baustellenbuch');
        q.onsuccess = () => {
          const t = q.result.transaction('settings', 'readwrite');
          t.objectStore('settings').delete('timer');
          t.oncomplete = () => fertig();
        };
      }),
  );
}

/** Alle Datensätze einer Tabelle aus der IndexedDB. */
export async function tabelle(page: Page, name: string): Promise<any[]> {
  return page.evaluate(
    (n) =>
      new Promise<any[]>((fertig, fehler) => {
        const q = indexedDB.open('baustellenbuch');
        q.onerror = () => fehler(q.error);
        q.onsuccess = () => {
          // Verbindung wieder schließen: Eine offene Verbindung blockiert sonst „Alle Daten löschen“ (db.delete()).
          const db = q.result;
          const g = db.transaction(n).objectStore(n).getAll();
          g.onsuccess = () => {
            db.close();
            fertig(g.result);
          };
          g.onerror = () => {
            db.close();
            fehler(g.error);
          };
        };
      }),
    name,
  );
}

export async function anzahl(page: Page, namen: string[]): Promise<number> {
  let summe = 0;
  for (const n of namen) summe += (await tabelle(page, n)).length;
  return summe;
}

export async function downloadText(dl: Download): Promise<string> {
  return readFileSync(await dl.path(), 'utf8');
}

/** Zeichnet einen Strich entlang relativer Punkte (0..1) der Zeichenfläche. */
export async function zeichne(page: Page, flaeche: Locator, punkte: [number, number][]) {
  const box = (await flaeche.boundingBox())!;
  const p = ([fx, fy]: [number, number]) => [box.x + box.width * fx, box.y + box.height * fy] as const;
  const [x0, y0] = p(punkte[0]);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (const pt of punkte.slice(1)) {
    const [x, y] = p(pt);
    await page.mouse.move(x, y, { steps: 6 });
  }
  await page.mouse.up();
}

export async function klickRelativ(page: Page, flaeche: Locator, fx: number, fy: number) {
  const box = (await flaeche.boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

export const ZEICHENFLAECHE = '.paper canvas:not(.bg)';

/** Sicherung über die Einstellungen erstellen; liefert den Dateiinhalt und speichert sie unter `ziel`. */
export async function sicherungErstellen(page: Page, ziel: string): Promise<string> {
  await page.goto('/#/einstellungen');
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Sicherung erstellen' }).click(),
  ]);
  await dl.saveAs(ziel);
  return readFileSync(ziel, 'utf8');
}

/** Öffnet im Bericht die Unterschrift, zeichnet eine Kurve und übernimmt sie. */
export async function unterschreiben(page: Page, name = 'M. Huber') {
  await page.getByRole('button', { name: 'Kunde unterschreiben lassen' }).click();
  const feld = page.locator('.signpad canvas');
  await feld.waitFor();
  const b = (await feld.boundingBox())!;
  await page.mouse.move(b.x + 40, b.y + b.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(b.x + 40 + i * 20, b.y + b.height * (0.6 + 0.25 * Math.sin(i)), { steps: 3 });
  }
  await page.mouse.up();
  await page.getByLabel('Name des Unterzeichners').fill(name);
  await page.getByRole('button', { name: 'Unterschrift übernehmen' }).click();
  await page.locator('.signatures img').waitFor();
}
