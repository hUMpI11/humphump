# Auftrag H – Restpunkte aus der Nachprüfung (infra-connectivity)

Folgeauftrag aus der zweiten Sicherheitsprüfung. Es gilt `docs/auftraege/README.md`. Kein anderer Agent arbeitet gleichzeitig.

## Ziel
Die verbliebenen Befunde (ein mittlerer, mehrere niedrige) schließen, ohne neue Funktionen zu bauen.

## Betroffene Dateien (nur diese)
`src/sync/validate.ts`, `src/sync/validate.test.ts`, `src/sync/tracking.ts`, `src/sync/merge.ts`, `src/lib/export.ts`, `src/views/Settings.tsx`, `src/protocols/calc.ts`, `src/protocols/ProtocolPrint.tsx`, `src/views/ProtocolEditor.tsx`, `.github/workflows/deploy.yml`, `docs/BACKEND.md`, `docs/api/openapi.yaml`, `docs/ARCHITEKTUR.md` (nur Abschnitt Geräteabgleich), `e2e/einspielen-haertung.spec.ts`, `e2e/datenschutz.spec.ts`.

## Nicht ändern
Alles andere; keine neuen Abhängigkeiten; exportierte Signaturen bleiben, außer wo unten ausdrücklich genannt.

## Anforderungen
1. **Protokollwerte prüfen (mittel).** `protocols.values` rekursiv validieren: je Feld `null`, String ≤ 50 000 Zeichen, endliche Zahl, `{ status ∈ 'ok'|'mangel'|'na'|'', bemerkung: String }` oder ein Array von höchstens 5000 Zeilen mit `_id: String` und Zellen aus String, endlicher Zahl oder `null`. Alles andere verwirft das Protokoll (zählt in `verworfen`). Zusätzlich die Verbraucher defensiv machen (`calc.ts`, `ProtocolPrint.tsx`, `ProtocolEditor.tsx`): eine `null`-Zeile oder ein Objekt als Zellwert darf nie werfen.
2. **„Alle Daten löschen“ ohne echte Sicherung.** `shareOrDownload` meldet, ob geteilt/heruntergeladen oder abgebrochen wurde (Rückgabewert ergänzen; bestehende Aufrufer in fremden Dateien ignorieren ihn weiterhin). Bei Abbruch gilt die Sicherung als **nicht** erstellt: `letzteSicherung` nicht setzen, und der Löschablauf bricht ab. Die erste Rückfrage so formulieren, dass „Abbrechen“ nicht „ohne Sicherung weiter“ bedeutet: Wer keine Sicherung will, muss das ausdrücklich bestätigen.
3. **Zeitfenster enger.** Toleranz für Zeitstempel gegenüber dem Erstellzeitpunkt der Sicherung von 24 Stunden auf 5 Minuten senken. Liegt `erstellt` in der Zukunft, ist ungültig oder vor dem 1.1.2024, die Rückfrage vor dem Einspielen um eine Warnung „Sicherungsdatum unplausibel“ ergänzen (dafür `RestorePlan` um ein optionales Feld `warnung?: string` erweitern). Kommentare und `docs/ARCHITEKTUR.md` an den tatsächlichen Stand anpassen.
4. **Falsche Fehlermeldung.** Das Aufräumen alter Löschvermerke nach dem Einspielen darf nicht dazu führen, dass ein bereits geschriebenes Zusammenführen als „fehlgeschlagen, unverändert“ gemeldet wird (in die Transaktion legen oder eigenes `try/catch`).
5. **Änderungsverfolgung nur für das Einspielen aussetzen.** Während `withoutTracking` dürfen Schreibvorgänge der Oberfläche in anderen Transaktionen weiterhin gestempelt werden und Löschvermerke erzeugen. Ist das in Dexie nicht sauber lösbar, stattdessen die Oberfläche während des Einspielens sperren (Vollbild-Überlagerung „Sicherung wird eingespielt …“) und das im Abschlussbericht begründen.
6. **CI.** `concurrency` so ändern, dass ein Lauf für einen Pull Request nie einen Lauf auf `main` abbricht.
7. **Backend-Entwurf bereinigen** (`docs/BACKEND.md`, `docs/api/openapi.yaml`): ein einziges Entscheidungsmodell (Server-Version und `baseVersion`; Client-Zeit nur als Hinweis) durchgängig in allen Abschnitten, Push-Schema und API-Vertrag entsprechend, `author_id` je Tabelle festlegen, Rechteprüfung für Upload-URLs und Löschen nennen, veraltete Zahl „24 h“ korrigieren. Weiterhin als Entwurf gekennzeichnet; YAML bleibt gültig.

## Akzeptanzkriterien
1. Unit-Tests für die Protokollwerte (gültig; `null`-Zeile; Objekt als Zellwert; falscher Status) und für die neue Toleranz.
2. e2e: Protokoll mit `values: { <tabellenfeld>: [null] }` wird beim Einspielen übersprungen; ein solcher Datensatz, direkt in die IndexedDB geschrieben, lässt Protokoll-Tab und Bericht nicht abstürzen. „Alle Daten löschen“ bricht ab, wenn die angebotene Sicherung nicht zustande kommt (in Chromium wird heruntergeladen – den Abbruch über einen gezielt fehlschlagenden bzw. abgebrochenen Teilen-Aufruf simulieren, z. B. `navigator.share` und `navigator.canShare` per `addInitScript` ersetzen).
3. `npm test` und `npm run e2e` vollständig grün. Tipp: `E2E_PORT=4191 npm run e2e` nutzt einen eigenen Port.

## Commit-Nachricht
`Restpunkte der Nachprüfung: Protokollwerte, Löschablauf, Zeitfenster, CI, Entwurf`
