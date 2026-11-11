# Auftrag B – Protokollvorlagen je Gewerk (ui-designer)

## Ziel
Die Gewerke unterscheiden sich bisher nur durch Vorschlagslisten. Vorlagen machen die App wirklich gewerkespezifisch – als reine Daten gemäß `Template` in `src/protocols/types.ts`. Die Engine (Auftrag A) rendert sie.

## Betroffene Dateien (nur diese)
- `src/protocols/templates.ts` (Exporte `TEMPLATES`, `templateById`, `templatesFor` mit unveränderten Signaturen)
- `src/protocols/templates.test.ts` (neu)

## Nicht ändern
Alles andere, insbesondere `types.ts`. `calc.ts` nicht importieren (entsteht parallel). Gültige Gewerk-ids stehen in `src/gewerke.ts`.

## Anforderungen
- 12–16 Vorlagen, ids in kebab-case, `version: 1`. Auf dem Telefon mit dem Daumen ausfüllbar: kurz (lieber 8 treffende Prüfpunkte als 40), Baustellensprache, Einheiten, sinnvolle `presetRows` und `default`.
- Der Auftraggeber ist MSR-Techniker (Gebäudeautomation). Die MSR-Vorlagen sollen besonders praxistauglich sein.
- **Fachliche Ehrlichkeit:** Arbeitshilfen, keine normkonformen Prüfprotokolle. Keine Normkonformität behaupten, keine Normnummern als Gewähr, keine verbindlichen Grenzwerte – Soll- und Grenzwerte sind Eingabefelder. Bei Elektro, Trinkwasser und Gas in `beschreibung`: „Arbeitshilfe – ersetzt nicht das vorgeschriebene Prüfprotokoll“. Bei Unsicherheit weglassen oder als Freifeld gestalten.
- Umfang:
  - Allgemein (`'*'`): Aufmaß Fläche (vorhanden, verbessern), Aufmaß Länge, Aufmaß Volumen, Stückliste, Abnahmeprotokoll, Mängelliste/Restarbeiten, Bautagesbericht.
  - MSR: Datenpunktprüfung (Tabelle: Adresse, Bezeichnung, Typ, Prüfung als `check`-Spalte, Bemerkung), Inbetriebnahme Regelung, Fühlerabgleich (Abweichung berechnet).
  - Heizung: Druckprobe (Druckabfall berechnet), Inbetriebnahme/Wartung, hydraulischer Abgleich.
  - Lüftung: Luftmengenmessung (Abweichung % = `(ist - soll) / soll * 100`, Summen Soll/Ist), Wartung/Filterwechsel.
  - Sanitär: Dichtheitsprüfung, Übergabe-Checkliste.
  - Elektro: Prüf-Checkliste Stromkreise als Arbeitshilfe.
  - Schreiner: Aufmaß Türen/Fenster. Maurer/Maler/Trockenbau: Wandflächen mit Abzügen.
- `templatesFor(gewerke)`: zuerst passende, dann allgemeine, ohne Dubletten.

## Akzeptanzkriterien (als Tests in `templates.test.ts`)
1. Vorlagen-ids eindeutig; jede Vorlage hat Name, Beschreibung, mindestens einen Abschnitt und ein Feld.
2. Feld-ids je Vorlage und Spalten-ids je Tabelle eindeutig und passend zu `/^[a-z][a-zA-Z0-9_]*$/`.
3. `gewerke` sind `'*'` oder gültige ids aus `GEWERKE`.
4. `select` hat mindestens zwei Optionen.
5. Jede `formula` steht an einer `number`-Spalte und nutzt nur vorhandene `number`-Spalten derselben Tabelle (Bezeichner per Regex prüfen).
6. Jede `summary.column` existiert und ist `number`; `presetRows` nutzen nur vorhandene Spalten.
7. `templatesFor(['msr'])` liefert MSR vor allgemeinen ohne Dubletten; `templatesFor([])` nur allgemeine.

## Commit-Nachricht
`Protokollvorlagen je Gewerk mit Konsistenztests`

## Zusätzlich im Abschlussbericht
Liste der Vorlagen (id, Gewerke) und die Stellen, an denen du fachlich unsicher warst.
