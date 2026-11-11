# Auftrag C – Änderungsverfolgung und Zusammenführen (infra-connectivity)

## Ziel
Grundlage für jede Synchronisation, zuerst ohne Server: „Sicherung einspielen“ überschreibt bisher blind. Künftig wird je Datensatz zusammengeführt (neuerer Stand gewinnt, Löschungen wandern mit), damit iPhone und iPad per Datei abgeglichen werden können. Dieselbe Entscheidungslogik soll später der Server-Sync nutzen (siehe Auftrag E).

## Betroffene Dateien (nur diese)
- `src/sync/tracking.ts`, `src/sync/merge.ts` (Gerüste; exportierte Signaturen bleiben, weitere Exporte erlaubt)
- `src/sync/merge.test.ts` (neu)
- `src/lib/export.ts`
- `src/views/Settings.tsx`

## Nicht ändern
`src/db.ts` (ruft `installChangeTracking(db)` bereits auf), `src/protocols/*`, übrige Views, `src/styles.css`, `package.json`.

## Anforderungen
**tracking.ts**
- `installChangeTracking(db)`: Dexie-Hooks für `projects, times, materials, notes, photos, sketches, blobs, signatures, protocols` (Liste lokal definieren – `db.ts` nicht importieren, Zirkelbezug).
  - creating: `updatedAt = Date.now()`, falls nicht gesetzt. updating: `updatedAt` ergänzen, falls die Änderung es nicht setzt. deleting: Löschvermerk `{ key: 'tabelle:id', table, id, deletedAt }` in `tombstones`.
  - Achtung: Bestehende Transaktionen (z. B. `db.transaction('rw', db.photos, db.blobs, …)`, `deleteProject`) haben `tombstones` nicht im Scope. Löschen darf dadurch nie fehlschlagen. Robust lösen (z. B. nach Erfolg außerhalb der Transaktion schreiben) und für Einzel-, `where().delete()`- und `bulkDelete`-Löschungen nachweisen. Ein verlorener Löschvermerk bei Absturz ist hinnehmbar, ein fehlschlagendes Löschen nicht.
- `withoutTracking(fn)`: währenddessen stempeln die Hooks nicht und schreiben keine Löschvermerke; verschachtelungs- und fehlerfest.

**merge.ts**
- `decide(local, incoming, localDeletedAt, incomingDeletedAt)`: reine Funktion. Zeitstempel = `updatedAt ?? createdAt ?? 0`. Der neuere der beiden Löschvermerke zählt und gewinnt bei `deletedAt >= Zeitstempel`. Nur eingehend → `'anlegen'`; beide: eingehend neuer → `'ersetzen'`, sonst `'behalten'` (Gleichstand: lokal); lokal vorhanden und Löschvermerk gewinnt → `'loeschen'`; eingehend vorhanden, Löschvermerk gewinnt → `'nichts'`.
- `mergeTables(tables)`: wendet `decide` innerhalb `withoutTracking` an, übernimmt Löschvermerke (je key der neuere), liefert `MergeResult`. Saubere, dokumentierte Regel für `blobs` (folgen dem zugehörigen Foto bzw. der Skizze; Skizzenhintergrund `id:bg`). `settings`: `profil` nur, wenn lokal leer; `timer` und `letzteSicherung` nie. Tabellenweise arbeiten (große Fotos nicht mehrfach kopieren).
- Konfliktstrategie in einem Kommentarblock am Dateianfang dokumentieren.

**export.ts / Settings.tsx**
- `restoreBackup` nutzt `mergeTables` und liefert `MergeResult`. Alte Sicherungen (Version 1, ohne `tombstones`/`protocols`/`updatedAt`) bleiben einspielbar. Löschvermerke älter als 180 Tage dürfen aufgeräumt werden.
- Einstellungen: Texte anpassen (Einspielen führt zusammen), Ergebnis anzeigen („12 neu, 3 aktualisiert, 1 gelöscht, 40 unverändert“), kurze Anleitung „iPhone ↔ iPad abgleichen“, ehrlicher Hinweis (Uhren müssen stimmen; bei Änderung auf beiden Geräten gewinnt der spätere Stand komplett). Übrige Funktionen der Seite unverändert.

## Akzeptanzkriterien
1. `merge.test.ts` deckt alle Regeln von `decide` ab, inklusive Gleichstand, fehlender Zeitstempel und Löschvermerken beider Seiten.
2. Im Browser mit zwei getrennten Kontexten („Gerät A“, „Gerät B“) nachgewiesen:
   - A legt Baustelle, Stunden, Notiz, Foto an (Foto über `input[type=file][multiple]` im Tab „Fotos“, Datei `public/icon-512.png`) und sichert; B spielt ein → alles da, Foto darstellbar.
   - B ändert die Notiz und löscht den Stundeneintrag, sichert; A spielt ein → Notiz aktualisiert, Stundeneintrag weg.
   - A ändert danach einen Eintrag und spielt eine ältere Sicherung ein → lokale Änderung bleibt.
   - Baustelle löschen (Kaskade) wirft keinen Fehler und erzeugt Löschvermerke.
3. Bestehende Abläufe (Anlegen, Bearbeiten, Löschen in allen Tabs) funktionieren unverändert.

Bedienhinweise: Einstellungen unter `#/einstellungen` (Button „Sicherung erstellen“, Datei-Input zum Einspielen); in Chromium wird heruntergeladen; `page.on('dialog', d => d.accept())`.

## Commit-Nachricht
`Geräteabgleich: Änderungsverfolgung und Zusammenführen von Sicherungen`
