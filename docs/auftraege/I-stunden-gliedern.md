# Auftrag I – Stunden gliedern und Stunden im Bautagesbericht (ui-designer)

Rückmeldung aus dem ersten Einsatz auf einem echten iPhone, mit rund 40 Stundeneinträgen über zwei Jahre in einer Baustelle. Es gilt `docs/auftraege/README.md`. Kein anderer Agent arbeitet gleichzeitig.

## Ziel
1. Der Stunden-Reiter bleibt auch mit vielen Einträgen überschaubar: nach Tagen, Wochen oder Monaten gliedern, filtern, sortieren.
2. Im Protokoll „Bautagesbericht“ lassen sich Stunden eintragen.

## Betroffene Dateien (nur diese)
- `src/views/TimeTab.tsx`
- `src/lib/util.ts`, `src/lib/util.test.ts` (nur ergänzen: Hilfsfunktionen für Kalenderwoche, Monat, Gruppieren, Filtern)
- `src/styles.css` (nur neue Klassen am Dateiende anhängen)
- `src/protocols/templates.ts`, `src/protocols/templates.test.ts` (nur die Vorlage `bautagesbericht`)
- `e2e/stunden-gliederung.spec.ts` (neu), `e2e/protokolle.spec.ts` (ein Test ergänzen)
- `docs/VORSCHLAG-stunden-im-bautagesbericht.md` (neu, siehe Punkt 3)

## Nicht ändern
Alles andere – insbesondere `src/db.ts`, `src/protocols/types.ts`, `src/protocols/calc.ts`, `src/sync/**`, `src/lib/export.ts`, übrige Views, bestehende Tests außer den genannten. Das Formular „Stunden eintragen/bearbeiten“ und der Timer in `TimeTab.tsx` bleiben in Verhalten und Beschriftung unverändert (bestehende Tests hängen daran). Keine neuen Abhängigkeiten.

## Anforderungen
**1. Stunden-Reiter (`TimeTab.tsx`)**
- Umschalter **Tage | Wochen | Monate** (Komponente im Stil der vorhandenen `.segmented`). „Tage“ entspricht der heutigen Darstellung.
- Wochen und Monate als **aufklappbare Abschnitte**: Kopfzeile mit Bezeichnung („November 2026“ bzw. „KW 45 · 02.11.–08.11.2026“), Anzahl Einträge und Stundensumme; aufgeklappt darunter die Einträge nach Tagen wie bisher. Beim Öffnen ist der neueste Abschnitt aufgeklappt, die übrigen sind zu. Kopfzeile als Button mit `aria-expanded`, Touch-Ziel ≥ 44 px.
- Kalenderwochen nach ISO 8601 (Montag bis Sonntag; KW 1 ist die Woche mit dem ersten Donnerstag; Jahreswechsel korrekt: der 01.01.2027 gehört zu KW 53/2026).
- **Suche** in Tätigkeit und Mitarbeiter (ohne Groß-/Kleinschreibung) und Filter **„Nur Regie“**. Bei aktivem Filter zeigt die Summe oben die Summe der Auswahl und sagt das auch („Auswahl: 12,50 h von 225,00 h“); ohne Treffer ein verständlicher Leerzustand mit „Filter zurücksetzen“.
- **Sortierung** neueste zuerst (Standard) oder älteste zuerst.
- Gewählte Gliederung und Sortierung je Gerät merken (über `getSetting`/`setSetting` aus `src/db.ts`, Schlüssel `stundenAnsicht`); Suche und Regie-Filter nicht merken.
- Die Bedienelemente erscheinen erst, wenn es Einträge gibt, und brauchen am iPhone (390 px) höchstens zwei Zeilen. Kein horizontales Scrollen. Hell- und Dunkelmodus.
- Rechnen und Gruppieren als reine Funktionen in `src/lib/util.ts` mit Unit-Tests.

**2. Bautagesbericht (`templates.ts`)**
- Neue Tabelle „Personal und Stunden“ (`rowLabel: 'Person'`): Name (Text), Tätigkeit (Text), Stunden (Zahl, Einheit h); `summary` „Stunden gesamt“. `version` der Vorlage auf 2. Das bisherige Zahlfeld „Personal auf der Baustelle“ bleibt (bestehende Protokolle behalten ihre Werte).
- Die Beschreibung der Vorlage sagt in einem Halbsatz ehrlich, dass diese Stunden nur im Bericht stehen und nicht in den Stunden-Reiter übernommen werden.

**3. Vorschlag (nur Dokument, kein Code)**
`docs/VORSCHLAG-stunden-im-bautagesbericht.md`, höchstens eine Seite: Wie könnte der Bautagesbericht die Stunden des Tages automatisch aus dem Stunden-Reiter zeigen, damit niemand doppelt einträgt? Zwei bis drei Varianten (z. B. neuer Feldtyp in `types.ts`, der zur Laufzeit `db.times` nach Baustelle und Datum liest; oder der Tagesbericht als Ansicht des normalen Berichts mit „Nur heute“), je mit betroffenen Dateien, Aufwand grob, Folgen für Druck, Sicherung und Validierung, und einer begründeten Empfehlung.

## Akzeptanzkriterien
1. Unit-Tests: ISO-Kalenderwoche inklusive Jahreswechsel (29.12.2025 → KW 1/2026; 01.01.2027 → KW 53/2026), Monatsgruppen mit Summen, Filter und Sortierung.
2. `e2e/stunden-gliederung.spec.ts` (Einträge über mehrere Monate per Formular oder direkt in die IndexedDB anlegen): Monatsansicht zeigt je Monat die richtige Summe, nur der neueste ist offen, Auf- und Zuklappen funktioniert; Wochenansicht nennt die richtige KW; Suche und „Nur Regie“ ändern Liste und Summe; Sortierung dreht die Reihenfolge; die Ansicht bleibt nach Neuladen erhalten; bei 390 px kein horizontales Scrollen.
3. `e2e/protokolle.spec.ts`: Im Bautagesbericht zwei Personen mit Stunden eintragen → Summe stimmt, nach Neuladen noch da, im Bericht sichtbar.
4. `npm test` und die gesamte Suite (`E2E_PORT=4192 npm run e2e`) sind grün. Screenshots der drei Ansichten am iPhone-Format angesehen.

## Commit-Nachricht
`Stunden nach Tagen, Wochen, Monaten gliedern; Stunden im Bautagesbericht`
