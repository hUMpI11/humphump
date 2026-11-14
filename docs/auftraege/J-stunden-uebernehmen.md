# Auftrag J – „Stunden vom Tag übernehmen“ im Bautagesbericht (ui-designer)

Umsetzung von Variante B aus `docs/VORSCHLAG-stunden-im-bautagesbericht.md`. Es gilt `docs/auftraege/README.md`. Kein anderer Agent arbeitet gleichzeitig.

## Ziel
Wer seine Stunden im Stunden-Reiter erfasst, füllt die Tabelle „Personal und Stunden“ eines Bautagesberichts mit einem Tipp. Richtung: **nur vom Stunden-Reiter ins Protokoll**, als einmalige Kopie. Der Stunden-Reiter (`db.times`) wird dabei nie geschrieben.

## Vertrag (vorhanden)
`TableField.quelle?: { art: 'zeiten'; spalten: { name, taetigkeit, stunden } }` in `src/protocols/types.ts`. Die Engine bleibt generisch: Sie reagiert auf `quelle`, nicht auf die Vorlagen-id.

## Betroffene Dateien (nur diese)
- `src/protocols/zeiten.ts`, `src/protocols/zeiten.test.ts` (neu: reine Funktion Stundeneinträge → Tabellenzeilen)
- `src/views/ProtocolEditor.tsx`
- `src/protocols/protocols.css`
- `src/protocols/templates.ts`, `src/protocols/templates.test.ts` (nur Vorlage `bautagesbericht`: `quelle` setzen, Beschreibung anpassen, Version 3; Konsistenztest für `quelle`)
- `e2e/protokolle.spec.ts`
- `docs/VORSCHLAG-stunden-im-bautagesbericht.md` (oben einen Satz „Variante B ist umgesetzt“)

## Nicht ändern
Alles andere, insbesondere `types.ts`, `calc.ts`, `ProtocolPrint.tsx`, `src/db.ts`, `src/sync/**`, `src/views/TimeTab.tsx`. Keine neuen Abhängigkeiten.

## Anforderungen
1. **Reine Funktion** `zeilenAusZeiten(zeiten, spalten)`: je Stundeneintrag eine Zeile mit `_id` (neu erzeugt), Name = `mitarbeiter`, Tätigkeit = `taetigkeit`, Stunden = `minuten / 60` auf zwei Stellen gerundet; sortiert nach Erstellzeit. Einträge mit 0 Minuten werden übersprungen. Regie wird in der Tätigkeit als Zusatz „(Regie)“ kenntlich.
2. **Knopf im Editor** bei Tabellen mit `quelle`: „Stunden vom Tag übernehmen“, über der Tabelle, Touch-Ziel ≥ 44 px, mit kurzem Hinweis darunter „Kopiert die Einträge vom <Datum> aus dem Stunden-Reiter. Dort wird nichts verändert.“ Maßgeblich ist das Datum des Protokolls (`protocol.datum`, das Kopffeld des Editors), bei geändertem Datum das neue.
   - Keine Einträge an dem Tag: verständliche Meldung, Tabelle bleibt unverändert.
   - Tabelle leer: Zeilen einsetzen.
   - Tabelle hat schon Zeilen: Rückfrage „Die Tabelle hat bereits N Zeilen. Durch die M Einträge vom <Datum> ersetzen?“ – bei Nein bleibt alles, bei Ja wird ersetzt (nicht angehängt, keine Dubletten).
   - Abgeschlossenes Protokoll: Knopf nicht bedienbar.
   - Danach greift das normale automatische Speichern; die Zeilen bleiben von Hand änderbar.
3. **Vorlage:** `quelle` an der Tabelle `personalStunden`; Beschreibung sagt jetzt, dass sich die Stunden aus dem Stunden-Reiter übernehmen lassen und dort nichts verändert wird.

## Akzeptanzkriterien
1. Unit-Tests für `zeilenAusZeiten` (Rundung 7,5 h; Reihenfolge; 0 Minuten; Regie-Zusatz; leere Liste).
2. e2e (iPhone- und iPad-Projekt): zwei Stundeneinträge für ein festes Datum und einer für einen anderen Tag anlegen → Bautagesbericht mit diesem Datum → Knopf füllt genau die zwei Zeilen, Summe stimmt; erneutes Übernehmen fragt nach und ersetzt, ohne zu verdoppeln; anderer Tag ohne Einträge zeigt die Meldung; `db.times` ist vor und nach dem Übernehmen identisch; abgeschlossenes Protokoll: Knopf gesperrt.
3. `npm test` und `E2E_PORT=4193 npm run e2e` vollständig grün. Screenshot am iPhone-Format angesehen.

## Commit-Nachricht
`Bautagesbericht: Stunden vom Tag aus dem Stunden-Reiter übernehmen`
