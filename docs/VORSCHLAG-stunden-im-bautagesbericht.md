# Vorschlag: Stunden des Tages automatisch im Bautagesbericht

Variante B ist umgesetzt (Auftrag J): Im Bautagesbericht übernimmt „Stunden vom Tag übernehmen“ die Stunden einmalig aus dem Stunden-Reiter.

Stand: Vorschlag, umgesetzt ist nur Variante B. Entscheidung liegt beim Menschen (siehe `TODO-MANUELL.md`).

## Problem
Der Bautagesbericht hat seit Auftrag I eine eigene Tabelle „Personal und Stunden“. Dieselben Stunden stehen aber schon im Stunden-Reiter. Wer beides pflegt, trägt doppelt ein, und die Zahlen können auseinanderlaufen. Gewünscht: Der Tagesbericht zeigt die Stunden des Tages aus dem Stunden-Reiter.

## Variante A – Neuer Feldtyp `zeiten` in der Vorlage
Ein Feld, das beim Anzeigen `db.times` nach Baustelle und Datum des Protokolls liest und eine schreibgeschützte Tabelle (Name, Tätigkeit, Stunden, Summe) zeigt.
- Dateien: `src/protocols/types.ts` (Feldtyp), `ProtocolEditor.tsx`, `ProtocolPrint.tsx`, `templates.ts` (Feld statt Tabelle), `validate.ts` (Feldtyp kennen), Tests.
- Aufwand: mittel (ca. 1 bis 2 Tage mit Tests). Berührt gemeinsame Dateien, also nur über die Hauptsession.
- Folgen: Gespeichert wird nichts, nur das Datum zählt; die Werte im Protokoll ändern sich rückwirkend, wenn später Stunden nachgetragen werden. Ein „abgeschlossenes“ Protokoll wäre damit nicht mehr eingefroren, außer man speichert beim Abschließen einen Schnappschuss (zusätzliche Logik). Druck: funktioniert, wenn der Druck die Daten asynchron lädt. Sicherung und Abgleich: keine Änderung, da keine neuen Daten entstehen; ältere App-Stände kennen den Feldtyp nicht und würden ihn beim Einspielen einer neuen Vorlage ignorieren.

## Variante B – Übernehmen per Knopf (Schnappschuss)
Die Tabelle „Personal und Stunden“ bleibt wie jetzt. Ein Knopf „Stunden vom Tag übernehmen“ füllt sie einmalig aus `db.times` (Datum des Protokolls), danach bleibt sie bearbeitbar.
- Dateien: nur `ProtocolEditor.tsx` plus eine reine Funktion in `src/protocols/` (Stunden zu Tabellenzeilen) mit Test; ein kleiner Haken in der Vorlage (z. B. `quelle: 'zeiten'` an der Tabelle, `types.ts`).
- Aufwand: klein (ca. 0,5 bis 1 Tag).
- Folgen: Keine neue Datenform, Druck, Sicherung und Validierung bleiben unverändert (`validate.ts` prüft schon Tabellenzeilen). Abgeschlossene Protokolle bleiben eingefroren. Nachteil: Nachträge im Stunden-Reiter wandern nicht automatisch mit; man muss erneut übernehmen (und würde dann Zeilen ersetzen oder doppelt anlegen, das muss der Knopf klar regeln, z. B. „ersetzt die Tabelle“).

## Variante C – Tagesbericht als Ansicht des normalen Berichts
Kein Protokollfeld. Der Bericht (`Report.tsx`) bekommt „Nur heute“ (gibt es als Zeitraum-Chip schon) und zeigt Stunden, Material, Notizen und Fotos des Tages; das Protokoll „Bautagesbericht“ enthält nur Wetter und Freitext.
- Dateien: `Report.tsx`, `templates.ts` (Tabelle wieder entfernen, Version 3). Kaum Neues.
- Aufwand: klein, aber Änderung am Nutzungsmuster: Der Tagesbericht wäre ein gedrucktes Gesamtbild statt eines einzelnen Protokolls.
- Folgen: Immer aktuell, keine Doppelerfassung, Druck wie bisher. Kein eigenes, einzeln abgeschlossenes Dokument je Tag.

## Empfehlung
Variante B jetzt, Variante A nur bei echtem Bedarf. B beseitigt die Doppelarbeit mit dem kleinsten Eingriff, ändert weder Datenmodell noch Sicherung und lässt abgeschlossene Berichte unverändert, was für einen Tagesbericht als Nachweis wichtig ist. Variante A lohnt sich erst, wenn Nachträge im Stunden-Reiter regelmäßig auch alte Berichte ändern sollen, und braucht dann einen Schnappschuss beim Abschließen; Variante C passt, wenn der Betrieb ohnehin den Gesamtbericht „Nur heute“ verschickt.
