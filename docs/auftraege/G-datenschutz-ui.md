# Auftrag G – Datenschutz und Notausgang in der Oberfläche (ui-designer)

Folgeauftrag aus dem Security-Review der Ausbaustufe 0.2. Es gilt `docs/auftraege/README.md`.

## Ziel
Der Nutzer versteht, was eine Sicherungsdatei enthält, sieht vor dem Einspielen, was passieren wird, kann alle Daten auf dem Gerät löschen und kommt nach einem Darstellungsfehler wieder an seine Daten.

## Betroffene Dateien (nur diese)
- `src/views/Settings.tsx`
- `src/components/Problems.tsx`
- `index.html`
- `src/styles.css` (nur neue Klassen am Dateiende anhängen, nichts Bestehendes ändern)
- `e2e/datenschutz.spec.ts` (neu)

## Nicht ändern
`src/lib/**`, `src/sync/**` (daran arbeitet Auftrag F gleichzeitig), `src/db.ts`, übrige Views, `package.json`, `vite.config.ts`, bestehende e2e-Specs und `e2e/helpers.ts`.

## Schnittstelle (vorhanden, von Auftrag F parallel ausgefüllt)
`planRestore(file)` aus `src/lib/export.ts` liefert `{ vorschau: MergeResult, anwenden(): Promise<MergeResult> }`; `formatMergeResult(r)` aus `src/sync/merge.ts` macht daraus einen Satz. In deinem Arbeitsbaum liefert `vorschau` noch überall 0 – das ist das Gerüst; baue gegen den Vertrag.

## Anforderungen
1. **Einspielen in zwei Schritten** (`Settings.tsx`): Datei wählen → `planRestore` → Rückfrage mit der Vorschau (`window.confirm` genügt; Löschungen deutlich nennen, z. B. „… 3 Einträge werden gelöscht. Fortfahren?“) → `anwenden()` → Ergebnis mit `formatMergeResult`. Fehler von `planRestore`/`anwenden` verständlich anzeigen; bei Fehler bleibt der lokale Stand unverändert (das sichert Auftrag F) – das auch so sagen.
2. **Hinweis zur Sicherungsdatei:** beim Abschnitt Datensicherung klar und knapp: Die Datei enthält Kunden- und Mitarbeiterdaten (Namen, Adressen, Telefonnummern, Arbeitszeiten, Unterschriften, Fotos) unverschlüsselt. Nur an eigene Geräte weitergeben, an sicherem Ort ablegen, nicht mehr benötigte Dateien löschen.
3. **„Alle Daten auf diesem Gerät löschen“** in den Einstellungen, optisch abgesetzt als gefährliche Aktion: zwei Rückfragen (die zweite nennt die Zahl der Baustellen), vorher Sicherung anbieten, dann die Datenbank vollständig löschen (`db.delete()` aus `src/db.ts` importieren ist erlaubt) und die App auf `#/` neu laden. Hinweis: Sicherungsdateien außerhalb der App sind davon nicht betroffen.
4. **Notausgang im Fehlerbildschirm** (`Problems.tsx`, `ErrorBoundary`): zusätzlich zu „App neu laden“ ein Button „Sicherung erstellen“ (`createBackup` + `shareOrDownload` aus `src/lib/export.ts`, Fehler abfangen) und ein Hinweis, dass sich über Einstellungen → „Alle Daten löschen“ ein Neuanfang erzwingen lässt. Zweck: Stürzt die Startseite wegen eines kaputten Datensatzes immer wieder ab, soll der Nutzer seine Daten trotzdem retten können. Die Einstellungen müssen dafür direkt erreichbar sein (Link auf `#/einstellungen`, der die Fehlergrenze zurücksetzt).
5. **Content-Security-Policy** als `<meta http-equiv>` in `index.html`: so streng wie möglich, ohne die App zu brechen (Ausgangspunkt: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'`). Gegen den **gebauten** Stand prüfen (Service Worker, Fotos als Blob-URL, Skizzen, Unterschrift, Druckansicht, Download der Sicherung/CSV): keine CSP-Verstöße in der Konsole. Wenn `'unsafe-inline'` für Styles nötig ist, im Abschlussbericht begründen.

## Akzeptanzkriterien
1. `e2e/datenschutz.spec.ts` weist nach: Hinweis sichtbar; Einspielen fragt mit Vorschau nach und zeigt das Ergebnis; „Alle Daten löschen“ leert alle Tabellen und die Startseite zeigt den Leerzustand; der Fehlerbildschirm bietet „Sicherung erstellen“ an und führt in die Einstellungen (Fehler künstlich auslösen, z. B. Projekt mit `name` als Objekt direkt in die IndexedDB schreiben, dann Startseite laden); kein CSP-Verstoß in der Konsole über einen typischen Ablauf inkl. Foto und Skizze.
2. Die gesamte bestehende Suite (`npm run e2e`) und `npm test` bleiben grün. Temp-Dateien für Tests in einem Ordner **ohne Umlaute im Pfad** anlegen.
3. Touch-Ziele ≥ 44 px, Hell- und Dunkelmodus, verständliches Deutsch.

## Commit-Nachricht
`Datenschutz-Hinweise, Alle-Daten-löschen, Notausgang und CSP`
