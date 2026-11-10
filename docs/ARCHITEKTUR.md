# Architektur

Stand: Ausbaustufe 0.2. Dieses Dokument beschreibt den Aufbau, die Verträge zwischen den Modulen und die Regeln, nach denen erweitert wird.

## Grundsätze

1. **Local-first.** Alle Daten liegen in IndexedDB auf dem Gerät (Dexie). Die App funktioniert vollständig ohne Netz. Es gibt kein Backend und kein Konto.
2. **Ein Datenzugang.** Nur `src/db.ts` definiert Tabellen und Typen. Views lesen über `useLiveQuery` und schreiben direkt über `db.<tabelle>`. Große Binärdaten liegen getrennt in `blobs`.
3. **Fachlogik ohne UI.** Rechnen, Formatieren, Exportieren, Zusammenführen liegt in `src/lib`, `src/protocols`, `src/sync` – als reine Funktionen mit Unit-Tests. Views enthalten keine Rechenregeln.
4. **Daten statt Code für Gewerke.** Was ein Gewerk ausmacht, steht als Daten in `src/gewerke.ts` (Vorschläge) und `src/protocols/templates.ts` (Protokollvorlagen). Ein neues Gewerk braucht keine neue View.
5. **Abgleich ohne Server.** Geräte tauschen Sicherungsdateien aus. Zusammengeführt wird je Datensatz nach Zeitstempel; Löschungen werden als Löschvermerk mitgeführt. Dieselbe Logik trägt später einen echten Sync, falls er gebraucht wird.

## Schichten

```
src/views/*            Bildschirme (React). Kennen db, lib, protocols – keine Rechenregeln.
src/components/*       Wiederverwendbare UI-Bausteine (Sheet, Header, SignaturePad …)
src/protocols/*        Protokoll-Engine: types (Vertrag), templates (Daten), calc (Rechnen), ProtocolPrint (Druck)
src/sync/*             Änderungsverfolgung (Dexie-Hooks) und Zusammenführen von Sicherungen
src/lib/*              Zeitrechnung, Export/Sicherung, Bilder, Routing, Zeichenlogik, Vorschlagshistorie
src/db.ts              Schema, Typen, Kaskadenlöschung
src/gewerke.ts         Gewerke mit Vorschlagslisten
e2e/*                  Browser-Tests (Playwright) gegen den gebauten Stand
```

Abhängigkeiten zeigen nur nach unten. `src/sync/tracking.ts` darf `db.ts` nicht importieren (bekommt die Datenbank als Parameter).

## Datenmodell (Dexie, Version 3)

| Tabelle | Schlüssel / Indizes | Inhalt |
|---|---|---|
| projects | id, status, updatedAt | Baustelle, Kontakt, Gewerke, Status, abgerechnet |
| times | id, projectId, datum | Stunden, Pause, Tätigkeit, Regie, km |
| materials | id, projectId, datum | Material mit Menge/Einheit, Regie |
| notes | id, projectId, datum | Notizen und offene Punkte |
| photos | id, projectId, datum | Metadaten + Vorschaubild; Vollbild in `blobs` |
| sketches | id, projectId, updatedAt | Vektordaten; gerendertes Bild in `blobs` |
| blobs | id, projectId | Binärdaten (ArrayBuffer + MIME) |
| signatures | id, projectId | Kundenunterschrift je Berichtszeitraum |
| protocols | id, projectId, datum | Ausgefüllte Protokolle (`values` je Feld-id der Vorlage) |
| tombstones | key (`tabelle:id`), table | Löschvermerke für den Geräteabgleich |
| settings | key | Profil, laufender Timer, letzte Sicherung |

Schemaänderungen: nur additiv über eine neue `db.version(n)`. Neue fachliche Tabellen gehören in `TABLES`, `SYNC_TABLES` und in `deleteProject`.

## Protokoll-Engine

- **Vertrag:** `src/protocols/types.ts`. Eine `Template` besteht aus Abschnitten mit Feldern der Typen `text`, `longtext`, `date`, `number`, `select`, `check` (i. O. / Mangel / n. z. + Bemerkung) und `table`.
- **Tabellen** haben typisierte Spalten; Zahlspalten können eine `formula` über andere Spalten derselben Zeile tragen (`l * b * anzahl - abzug`). Ausgewertet wird in `calc.ts` mit eigenem Parser – kein `eval`.
- **Aufmaß ist ein Protokoll** mit Tabelle und Summenzeile, kein eigenes Modul.
- **Versionierung:** Ein Protokoll merkt sich `templateId` und `templateVersion`. Felder, die es in der aktuellen Vorlage nicht mehr gibt, werden ignoriert; neue Felder sind leer.
- **Vorlagen sind Arbeitshilfen**, keine normkonformen Prüfprotokolle. Sie dürfen keine Normkonformität behaupten.

## Geräteabgleich per Datei

- `tracking.ts` stempelt `updatedAt` bei jedem Anlegen/Ändern in `SYNC_TABLES` und schreibt beim Löschen einen `tombstone`.
- `merge.ts` entscheidet je Datensatz (`decide`): neuerer Stand gewinnt; ein Löschvermerk gewinnt, wenn er neuer ist als der Datensatz; bei Gleichstand bleibt der lokale.
- Beim Einspielen laufen die Hooks nicht (`withoutTracking`), damit Zeitstempel erhalten bleiben.
- Grenzen: Uhren der Geräte müssen ungefähr stimmen; zusammengeführt wird je Datensatz, nicht je Feld.

## Navigation

Hash-Routing (`src/lib/router.ts`), damit die App unter jedem Pfad und offline läuft. Telefon: eine Spalte (Liste **oder** Detail). Ab 900 px: Liste und Detail nebeneinander. Vollbild nur für Skizze und Unterschrift.

## Tests

- **Unit** (`npm test`, Vitest): reine Funktionen in `src/**/*.test.ts`.
- **Browser** (`npm run e2e`, Playwright/Chromium im iPhone- und iPad-Format): komplette Abläufe gegen `vite preview`.
- Nicht automatisiert prüfbar: Kamera, Apple Pencil, Teilen-Dialog, Drucken und Speicherverhalten unter Safari/iOS.

## Arbeitspakete dieser Ausbaustufe

| Paket | Eigene Dateien | Liefert |
|---|---|---|
| A Protokoll-Engine | `src/protocols/calc.ts`, `calc.test.ts`, `ProtocolPrint.tsx`, `protocols.css`, `src/views/ProtocolTab.tsx`, `ProtocolEditor.tsx` | Rechnen, Ausfüllen, Liste, Druck |
| B Vorlagen | `src/protocols/templates.ts`, `templates.test.ts` | Vorlagen je Gewerk, Konsistenztests |
| C Geräteabgleich | `src/sync/*`, `src/lib/export.ts`, `src/views/Settings.tsx` | Änderungsverfolgung, Zusammenführen |
| D Browser-Tests | `e2e/*`, `playwright.config.ts`, `.github/workflows/deploy.yml` | Testsuite im Repo, CI |

Gemeinsame Dateien (`db.ts`, `router.ts`, `App.tsx`, `ProjectDetail.tsx`, `Report.tsx`, `styles.css`, `types.ts`) sind im Gerüst vorbereitet und werden von den Paketen nicht verändert.
