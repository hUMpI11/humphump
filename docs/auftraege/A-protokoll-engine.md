# Auftrag A – Protokoll-Engine (ui-designer)

## Ziel
Handwerker füllen auf der Baustelle Protokolle aus (Prüfprotokolle, Checklisten, Aufmaße). Die Engine rendert beliebige Vorlagen aus `src/protocols/templates.ts` rein generisch gegen den Vertrag `src/protocols/types.ts`. Keine Vorlagen-id im Code.

## Betroffene Dateien (nur diese)
- `src/protocols/calc.ts` (Gerüst; exportierte Signaturen bleiben)
- `src/protocols/calc.test.ts` (neu)
- `src/protocols/ProtocolPrint.tsx` (Gerüst; Signatur bleibt)
- `src/protocols/protocols.css` (neu; in den drei Komponenten importieren, Klassenpräfix `proto-`)
- `src/views/ProtocolTab.tsx`, `src/views/ProtocolEditor.tsx` (Gerüste; default-Exporte und Props bleiben)

## Nicht ändern
`src/protocols/types.ts`, `src/protocols/templates.ts`, `src/db.ts`, `src/lib/*`, `src/App.tsx`, `src/views/ProjectDetail.tsx`, `src/views/Report.tsx`, `src/styles.css`, `package.json`. Stilvorbilder zum Lesen: `src/views/MaterialTab.tsx`, `NotesTab.tsx`, `Report.tsx`, `src/components/ui.tsx`.

## Anforderungen
**calc.ts**
- `evaluate(formula, vars)`: eigener Parser (rekursiver Abstieg), kein `eval`/`Function`. Zahlen mit Punkt, `+ - * /`, unäres Minus, Klammern, Bezeichner `[a-z][a-zA-Z0-9_]*`. `null` bei fehlender/`null`-Variable, Division durch 0, Syntaxfehler, nicht-endlichem Ergebnis.
- `computeRow(columns, row)`: Formelspalten in Spaltenreihenfolge berechnen (spätere dürfen frühere nutzen). Leere Zelle: `default` der Spalte, sonst fehlend. Strings mit Komma („2,5“) als Zahl lesen. Auf `digits` (Standard 2) runden. Nicht mutieren.
- `tableSummary(field, rows)`: Summen laut `field.summary`, auf 2 Stellen gerundet.
- `protocolStats(template, values)`: zählt `check`-Felder und `check`-Spalten (Zellwert `'ok' | 'mangel' | 'na' | ''`).
- `initialValues(template)`: `presetRows` mit eindeutiger `_id` (`uid()` aus `src/lib/util.ts`), `check` → `{status:'', bemerkung:''}`, Tabellen ohne Vorbelegung `[]`, `number` → `null`, sonst `''`.

**ProtocolTab** (Tab „Protokolle“ der Baustelle)
- Liste aus `db.protocols`, neueste zuerst: Vorlagenname, Titel, Datum, Chips („2 Mängel“ als `chip warn`, „3 offen“, „abgeschlossen“). Tippen öffnet `#/p/<projectId>/protokoll/<id>`.
- `Fab` „Neues Protokoll“ → `Sheet` mit `templatesFor(project.gewerke)` (Name + Beschreibung). Auswahl legt den Datensatz an (`initialValues`, `templateVersion`, Datum heute, `abgeschlossen:false`) und öffnet den Editor. Leerzustand mit `Empty`.

**ProtocolEditor** (Route `#/p/:id/protokoll/:pid`, im Hauptbereich, kein Vollbild)
- `Header` mit Vorlagenname und Zurück auf `/p/<projectId>/protokolle`; Inhalt in `className="scroll page"`.
- Titel, Datum, dann alle Abschnitte und Feldtypen:
  - `text`, `longtext`, `date`, `number` (+Einheit, `inputMode="decimal"`, Komma erlaubt), `select`.
  - `check`: drei große Tipp-Flächen „i. O.“ / „Mangel“ / „n. z.“ (erneutes Tippen hebt auf); Bemerkungsfeld bei Mangel.
  - `table`: am Telefon je Zeile eine Karte mit den Spalten als kleine Felder (2–3 je Reihe); berechnete Spalten schreibgeschützt und hervorgehoben; Zeile löschen mit Rückfrage; „+ <rowLabel>“; Summen darunter. Ab etwa 700 px darf es eine echte Tabelle sein.
- Automatisch speichern: entprellt (~600 ms), beim Verlassen und bei `visibilitychange` → hidden; `updatedAt` setzen; dezente Anzeige „Gespeichert“. Während des Editierens ist der lokale Zustand maßgeblich.
- Unten: abschließen / wieder öffnen (abgeschlossen = schreibgeschützt), Statistik, Löschen mit Rückfrage.
- Unbekannte Vorlage oder fehlendes Protokoll: verständliche Meldung. Felder, die die Vorlage nicht mehr kennt, ignorieren; neue mit Startwert ergänzen.

**ProtocolPrint** (im Bericht, wird gedruckt)
- `<section>` mit `<h2>` „Vorlage – Titel (Datum)“; einfache Felder als `<dl className="facts">`; Prüfpunkte als Tabelle (Prüfpunkt | Ergebnis | Bemerkung); Tabellenfelder als `<table>` mit Einheiten im Kopf, Zahlen `className="r"`, Summen im `<tfoot>`. Leeres weglassen. Zahlen mit `fmtNumber`.

## Akzeptanzkriterien
1. Unit-Tests decken ab: Punkt vor Strich, Klammern, Defaults, fehlende Werte, Division durch 0, kaputte Formeln, Komma-Zahlen, Summen, Statistik.
2. Im iPhone-14-Format nachgewiesen: Baustelle anlegen (`#/neu`: „Bezeichnung *“, ein Gewerk, „Baustelle anlegen“) → Tab „Protokolle“ → „Aufmaß Fläche“ → zwei Positionen → Summe stimmt → Seite neu laden, Werte noch da → Bericht (`#/p/<id>/bericht`) zeigt das Protokoll. Screenshots angesehen, keine abgeschnittenen Inhalte.
3. Touch-Ziele ≥ 44 px, Eingaben ≥ 16 px Schrift, Hell- und Dunkelmodus über die CSS-Variablen aus `src/styles.css`, Labels für Screenreader.
4. Kein horizontales Scrollen der Seite bei 390 px Breite.

## Commit-Nachricht
`Protokoll-Engine: Rechnen, Ausfüllen, Liste, Druck`
