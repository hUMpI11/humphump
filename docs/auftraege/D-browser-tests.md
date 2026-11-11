# Auftrag D – Browser-Tests im Repo und in der CI (infra-connectivity)

## Ziel
Die bisherigen Browser-Prüfungen existieren nur als Wegwerf-Skripte (`e2e/_vorlage/*.cjs`, zuletzt alle bestanden). Sie werden zu einer wartbaren Playwright-Suite, die lokal und in der CI läuft.

## Betroffene Dateien (nur diese)
- `e2e/**` (neue Specs und `helpers.ts`; `e2e/_vorlage/` am Ende löschen)
- `playwright.config.ts` (neu)
- `.github/workflows/deploy.yml`
- `README.md`, nur Abschnitt „Entwicklung“

## Nicht ändern
`src/**`, `package.json` (`@playwright/test` 1.63.0 und `npm run e2e` sind eingetragen), `vite.config.ts`, `tsconfig.json`.

## Anforderungen
- Chromium ist hier vorinstalliert, kein `playwright install`. Findet der Runner den Browser nicht: `launchOptions.executablePath` aus einer Umgebungsvariable lesen (lokal unter `/opt/pw-browsers` nachsehen), sodass die CI ohne die Variable läuft.
- `playwright.config.ts`: `testDir: 'e2e'`; `webServer` mit `npm run build && npx vite preview --port 4173 --strictPort`; `baseURL`; Locale `de-DE`; Projekte „iphone“ (Maße von iPhone 14, aber Chromium erzwingen) und „ipad-quer“ (1180×820, Touch); Trace aus; in der CI ein Retry; jeder Test mit frischem Kontext (leere Datenbank).
- Specs mit `expect`, gemeinsame Helfer in `e2e/helpers.ts`:
  - `erfassung.spec.ts`: Baustelle, Stunden (Uhrzeit, Direkteingabe, Regie), Timer (Start, übersteht Neuladen, Runden und Pausenvorschlag, Abbrechen lässt laufen, Verwerfen, vergessener Timer), Material (Vorschlag setzt Einheit, eigenes Material wird Vorschlag, Summen), Notizen und offene Punkte, Kopieren, Doppeltipp-Schutz.
  - `fotos-skizzen.spec.ts`: Foto-Upload, Foto bemaßen, freie Skizze, leere Skizze wird verworfen, Striche als Vektordaten gespeichert.
  - `bericht.spec.ts`: Inhalte, Regiebericht, Material summiert, Unterschrift (gilt nur für den Zeitraum), CSV-Inhalt, Text teilen (Zwischenablage).
  - `start-woche.spec.ts`: Startseite (heute/Woche, laufende Zeit, Schnellstart, offene Punkte, Rechnung offen, Sicherungs-Erinnerung), Wochenübersicht.
  - `sicherung-offline.spec.ts`: Sicherung erstellen und in einem **frischen Kontext** einspielen → Daten und Foto da; Löschen einer Baustelle hinterlässt keine abhängigen Daten; App startet offline; Meldung bei vollem Speicher, kein Fehlalarm bei fremden Fehlern.
  - iPad: Liste und Detail nebeneinander sichtbar; Skizzen-Editor im Vollbild. Reine Telefon-Tests per `test.skip` begrenzen.
- Parallel entstehen: Tab „Protokolle“ (als Gerüst schon da) und neue Texte samt Zusammenführen in der Datensicherung. Tests daher an sichtbaren Daten festmachen, nicht an Meldungstexten. Bekannte Fallen aus den Vorlagen beachten: Sidebar ist immer im DOM (auf `.main`/`.sidebar` eingrenzen); Labels mit Hinweistext; nach „Speichern“ auf das Schließen von `.sheet` warten. Kein `waitForTimeout`, wo ein Zustand abgewartet werden kann.
- CI: im bestehenden Build-Job nach Tests und Build `npx playwright install --with-deps chromium` und `npm run e2e`; bei Fehlschlag Report als Artefakt. Deploy-Job und Trigger unverändert.

## Akzeptanzkriterien
1. `npm run e2e` ist zweimal hintereinander für beide Projekte grün.
2. `npx tsc --noEmit` und `npm test` bleiben grün (Vitest sammelt nur `src/**/*.test.ts`).
3. Deckt die Suite einen echten App-Fehler auf: App nicht ändern, Test mit `test.fixme` und Kommentar markieren, im Abschlussbericht Schritte/erwartet/tatsächlich nennen.
4. `e2e/_vorlage/` ist entfernt.

## Commit-Nachricht
`Browser-Tests (Playwright) im Repo und in der CI`
