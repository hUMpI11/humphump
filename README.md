# Baustellenbuch

Baustellenerfassung für Handwerker auf iPhone und iPad: Stunden, Material, Notizen, Fotos und Skizzen pro Baustelle – offline, ohne Konto, ohne Server.

Technisch ist das eine **installierbare Web-App (PWA)**, keine native App aus dem App Store. Sie wird in Safari geöffnet und über „Teilen → Zum Home-Bildschirm“ installiert; danach startet sie im Vollbild und funktioniert ohne Netz.

## Funktionen

- **Baustellen** mit Kunde, Adresse (öffnet Karten), Auftragsnummer, Gewerken, Status aktiv/abgeschlossen, Suche
- **Startseite**: Stunden heute/diese Woche, laufende Zeit, Zeit mit einem Tipp starten, offene Punkte je Baustelle, abgeschlossene Baustellen ohne Rechnung, Erinnerung an die Datensicherung
- **Stunden**: Start/Stopp-Timer (rundet auf Viertelstunden, schlägt die Pause vor) oder Nachtrag (Beginn/Ende/Pause oder Stunden direkt), Mitarbeiter, Tätigkeit, gefahrene Kilometer, Regie-Kennzeichen
- **Wochenübersicht** über alle Baustellen mit Summen (Stunden, Regie, Kilometer) und CSV-Export
- **Material**: Bezeichnung, Menge, Einheit, Artikelnummer, Regie; Serienerfassung („Speichern & nächste Position“), Summen je Baustelle
- **Kopieren**: Stunden- und Materialeinträge als neuen Eintrag für heute übernehmen
- **Gewerke** mit Vorschlagslisten für Tätigkeiten und Material: MSR, Heizung, Lüftung, Sanitär, Elektro, Schreiner, Maurer, Maler, Trockenbau, Sonstiges (`src/gewerke.ts`)
- **Notizen** mit Datum (Diktieren über die iOS-Tastatur) und **offene Punkte** zum Abhaken
- **Vorschläge lernen mit**: eigene Materialien und Tätigkeiten stehen vor dem Standardkatalog
- **Kontakt**: Ansprechpartner mit Telefonnummer zum Antippen
- **Fotos** direkt aus der Kamera oder mehrere aus der Mediathek, automatisch verkleinert (max. 1600 px), mit Beschreibung
- **Skizzen**: Stift, Linie, Rechteck, Text/Maß, Radierer, Rückgängig; frei oder auf einem Foto; Apple Pencil mit Handballen-Schutz
- **Bericht** je Baustelle und Zeitraum als Druck/PDF, wahlweise als **Regiebericht** (nur Zusatzleistungen), mit **Unterschrift des Kunden auf dem Display**, als Text zum Teilen (WhatsApp, Mail), Stunden und Material als CSV (Excel-tauglich)
- **Protokolle je Gewerk**: Prüfprotokolle, Checklisten und Aufmaße aus Vorlagen (u. a. Datenpunktprüfung, Druckprobe, Luftmengenmessung, Abnahme), mit berechneten Spalten und Summen, automatisch gespeichert, im Bericht druckbar
- **Datensicherung und Geräteabgleich** als Datei: Einspielen führt zusammen (neuerer Stand gewinnt, Löschungen wandern mit) – so lassen sich iPhone und iPad abgleichen
- **Einspielen ist abgesichert**: Vorschau mit Rückfrage (auch für Löschungen), ungültige Einträge werden übersprungen, bei Fehlern bleibt der lokale Stand unverändert
- **Datenschutz**: Hinweis zum Inhalt der Sicherungsdatei, „Alle Daten auf diesem Gerät löschen“, Notausgang im Fehlerbildschirm (Sicherung erstellen, Einstellungen), Content-Security-Policy
- **Fehlbedienung abgefangen**: Doppeltipp auf „Speichern“ erzeugt keinen doppelten Eintrag; ein über Nacht vergessener Timer fragt nach dem echten Ende statt eines zu raten; ein voller Gerätespeicher wird gemeldet
- **iPad**: zweispaltig (Baustellenliste + Detail), Skizzen im Vollbild; Hell-/Dunkelmodus

## Bekannte Grenzen – bitte lesen

- **Daten liegen nur auf dem jeweiligen Gerät** (IndexedDB im Browser). Kein automatischer Abgleich, keine Mehrbenutzer-Funktion, keine Cloud. Abgleich zwischen iPhone und iPad von Hand über die Sicherungsdatei; die Uhren beider Geräte müssen stimmen.
- **Protokollvorlagen sind Arbeitshilfen**, keine normkonformen Prüfprotokolle, und fachlich nicht freigegeben (siehe `TODO-MANUELL.md`).
- **Datenverlust ist möglich**: Wird die App vom Home-Bildschirm gelöscht oder werden in iOS die Website-Daten gelöscht, sind die Daten weg. Regelmäßig sichern (Einstellungen → Sicherung erstellen).
- **Nicht auf echten Geräten getestet.** Geprüft wurde in Chromium mit iPhone-/iPad-Bildschirmgrößen. Kamera, Apple Pencil, Teilen-Dialog, Drucken und Speicherverhalten in Safari/iOS müssen auf echter Hardware nachgeprüft werden.
- Skizzen haben kein Zoomen/Verschieben; die Zeichenfläche wird eingepasst.
- Kein Preis-/Artikelstamm, keine Kalkulation, keine Rechnung, keine Anbindung an Lohn- oder Branchensoftware.
- Die Kundenunterschrift ist ein Bild mit Zeitstempel für den gewählten Berichtszeitraum. Einträge lassen sich danach noch ändern – beweissicher ist erst das direkt nach der Unterschrift erzeugte PDF.
- Die Zeiterfassung ist ein Arbeitsnachweis je Baustelle, **kein** manipulationssicheres System zur gesetzlichen Arbeitszeiterfassung.

## Entwicklung

Voraussetzung: Node.js 22+

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Unit-Tests
npm run build    # Typprüfung + Produktions-Build nach dist/
npm run preview  # gebauten Stand lokal ansehen
npm run e2e      # Browser-Tests (Playwright, iPhone- und iPad-Format)
```

Die Browser-Tests (`e2e/*.spec.ts`) bauen die App und starten sie selbst auf Port 4173; jeder Test läuft mit leerer Datenbank. Einmalig `npx playwright install chromium` (in der CI automatisch). Liegt Chromium an einem anderen Ort, den Pfad in `PW_CHROMIUM_PATH` angeben. Einzelne Datei: `npm run e2e -- e2e/bericht.spec.ts`; Fehlerbericht: `npx playwright show-report`.

## Auf das iPhone bringen

Die App braucht **HTTPS** (sonst kein Offline-Betrieb und keine Installation). Der Ordner `dist/` kann auf jedem statischen Webspace liegen.

Mit GitHub Pages: Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf `main`. Einmalig nötig: Repository → *Settings → Pages → Source: „GitHub Actions“*. Bei einem privaten Repository setzt Pages einen kostenpflichtigen GitHub-Plan voraus; die veröffentlichte Seite ist dann trotzdem öffentlich erreichbar (die erfassten Daten nicht – die bleiben auf dem Gerät).

## Aufbau

```
src/db.ts          Datenmodell und lokale Datenbank (Dexie/IndexedDB)
src/gewerke.ts     Gewerke mit Vorschlagslisten
src/lib/           Zeitrechnung, Export/Sicherung, Bildverkleinerung, Routing, Zeichenlogik
src/views/         Bildschirme (Liste, Baustelle, Tabs, Skizzen-Editor, Bericht, Einstellungen)
src/styles.css     Layout für iPhone (einspaltig) und iPad (zweispaltig), Druck
```
