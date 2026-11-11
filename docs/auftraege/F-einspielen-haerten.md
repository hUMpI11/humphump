# Auftrag F – Einspielen härten (infra-connectivity)

Folgeauftrag aus dem Security-Review der Ausbaustufe 0.2. Es gilt `docs/auftraege/README.md`.

## Ziel
Eine Sicherungsdatei ist eine nicht vertrauenswürdige Eingabe (anderes Gerät, falsch gestellte Uhr, beschädigte oder präparierte Datei). Einspielen darf nie einen halben Stand hinterlassen, nie die App unbrauchbar machen und nie durch unplausible Zeitstempel dauerhaft „gewinnen“.

## Betroffene Dateien (nur diese)
- `src/sync/merge.ts`, `src/sync/merge.test.ts`
- `src/sync/validate.ts`, `src/sync/validate.test.ts` (neu)
- `src/lib/export.ts` (nur `planRestore`, `restoreBackup` und Hilfen dafür)
- `e2e/einspielen-haertung.spec.ts` (neu)
- `.github/workflows/deploy.yml`
- `docs/BACKEND.md` (nur die unten genannten Abschnitte)

## Nicht ändern
`src/views/**` (insbesondere `Settings.tsx` – daran arbeitet Auftrag G gleichzeitig), `src/components/**`, `src/db.ts`, `src/sync/tracking.ts`, `index.html`, `package.json`, bestehende e2e-Specs und `e2e/helpers.ts`. Die Signaturen von `planRestore`, `RestorePlan`, `restoreBackup`, `MergeResult`, `formatMergeResult`, `decide`, `mergeTables` bleiben (Zusätze erlaubt).

## Anforderungen
1. **Validierung je Tabelle** (`validate.ts`, reine Funktionen): Pflichtfelder und Typen laut `src/db.ts`, z. B. `id` nicht-leerer String ≤ 100 Zeichen, `projectId` String, Texte Strings mit Obergrenze, `gewerke` als `string[]`, `minuten`/`menge` endliche Zahlen in plausiblen Grenzen, `status` aus der erlaubten Menge, Skizze `width`/`height` 1…8192 und begrenzte Anzahl Striche/Punkte, `blobs.data` ein ArrayBuffer mit Obergrenze, `blobs.mime` nur `image/jpeg` oder `image/png`, Protokoll `values` ein Objekt mit begrenzter Größe. Schlüssel `__proto__`, `constructor`, `prototype` werden beim Dekodieren verworfen. Ungültige Zeilen werden übersprungen und in `verworfen` gezählt – eine einzelne kaputte Zeile bricht das Einspielen nicht ab. `profil` nur als `{ name: string, firma: string, rundung ∈ {0,5,10,15,30} }`.
2. **Zeitstempel begrenzen:** `updatedAt`, `createdAt` und `deletedAt` aus der Datei, die mehr als 24 Stunden in der Zukunft liegen, werden auf `Date.now()` gesetzt und in `korrigiert` gezählt. Nicht endliche oder negative Werte: bei Datensätzen wie fehlend behandeln, Löschvermerke damit ignorieren. Die reine Funktion `decide` bleibt unverändert.
3. **Alles oder nichts:** Datei vollständig lesen, prüfen und dekodieren, **bevor** geschrieben wird; dann in **einer** Dexie-Transaktion über alle betroffenen Tabellen schreiben (innerhalb `withoutTracking`). Schlägt etwas fehl (kaputtes Base64, Speicher voll), bleibt der lokale Stand unverändert. Den Speicherbedarf als bewusste Grenze im Kommentar und in `docs/ARCHITEKTUR.md`-Vorschlag im Abschlussbericht benennen.
4. **Vorschau:** `planRestore(file)` liefert in `vorschau`, was passieren würde (gleiche Entscheidungslogik, ohne zu schreiben), und in `anwenden()` die Ausführung. `restoreBackup(file)` bleibt als Abkürzung (`planRestore` + `anwenden`).
5. **Größe:** Dateien über 500 MB vor dem Lesen mit verständlicher Fehlermeldung ablehnen.
6. **CI:** in `deploy.yml` oben nur `permissions: contents: read`; `pages: write` und `id-token: write` nur im `deploy`-Job. Sonst nichts ändern (kein SHA-Pinning ohne geprüfte SHAs).
7. **Backend-Entwurf nachschärfen** (`docs/BACKEND.md`, Abschnitte Sync/Konflikte und Rechte): (a) Reihenfolge am Server über Server-Sequenz bzw. Versionszähler je Datensatz statt über Client-Zeit; Client-Zeit nur als Hinweis; `deletedAt` wie `updatedAt` behandeln. (b) Schreibprüfung beim Upsert gegen den **bestehenden** Datensatz **und** das Ziel (Baustellen-Zuweisung), `tenant_id`/`author_id`/`deviceId` nie aus dem Body. Kurz und als Entwurf gekennzeichnet; Abweichung zur Datei-Zusammenführung begründen.

## Akzeptanzkriterien
1. Unit-Tests für die Validatoren (gültig, je ein ungültiger Fall pro Regelgruppe, `__proto__`) und für das Begrenzen der Zeitstempel.
2. `e2e/einspielen-haertung.spec.ts` (Dateien mit `node:fs` in einem Temp-Ordner **ohne Umlaute im Pfad** erzeugen – mit Umlauten übernimmt Chromium die Datei nicht; Einspielen über `input[type=file]` unter `#/einstellungen`, Dialoge annehmen) weist nach:
   - kaputtes Base64 in einem späteren Datensatz → lokaler Stand vollständig unverändert, Fehlermeldung sichtbar;
   - Projekt mit `name` als Objekt → wird übersprungen, Startseite funktioniert weiter;
   - Löschvermerk mit `deletedAt: 1e15` löscht nicht dauerhaft: ein danach lokal geänderter Datensatz bleibt, und eine spätere normale Sicherung kann die Baustelle wieder bringen;
   - Datensatz mit `updatedAt: 9e15` wird übernommen, aber mit begrenztem Zeitstempel, und lässt sich danach lokal wieder ändern und abgleichen.
3. Die gesamte bestehende Suite (`npm run e2e`) und `npm test` bleiben grün – auch `e2e/abgleich.spec.ts`.

## Commit-Nachricht
`Einspielen härten: Validierung, begrenzte Zeitstempel, alles oder nichts`
