# Baustellenbuch

Baustellenerfassung für Handwerker auf iPhone und iPad: Stunden, Material, Notizen, Fotos und Skizzen pro Baustelle – offline, ohne Konto, ohne Server.

Technisch ist das eine **installierbare Web-App (PWA)**, keine native App aus dem App Store. Sie wird in Safari geöffnet und über „Teilen → Zum Home-Bildschirm“ installiert; danach startet sie im Vollbild und funktioniert ohne Netz.

## Funktionen

- **Baustellen** mit Kunde, Adresse (öffnet Karten), Auftragsnummer, Gewerken, Status aktiv/abgeschlossen, Suche
- **Stunden**: Start/Stopp-Timer oder Nachtrag (Beginn/Ende/Pause oder Stunden direkt), Mitarbeiter, Tätigkeit, Regie-Kennzeichen
- **Material**: Bezeichnung, Menge, Einheit, Artikelnummer, Regie; Serienerfassung („Speichern & nächste Position“)
- **Gewerke** mit Vorschlagslisten für Tätigkeiten und Material: MSR, Heizung, Lüftung, Sanitär, Elektro, Schreiner, Maurer, Maler, Trockenbau, Sonstiges (`src/gewerke.ts`)
- **Notizen** mit Datum (Diktieren über die iOS-Tastatur)
- **Fotos** aus Kamera oder Mediathek, automatisch verkleinert (max. 1600 px), mit Beschreibung
- **Skizzen**: Stift, Linie, Rechteck, Text/Maß, Radierer, Rückgängig; frei oder auf einem Foto; Apple Pencil mit Handballen-Schutz
- **Bericht** je Baustelle und Zeitraum als Druck/PDF, Stunden und Material als CSV (Excel-tauglich)
- **Datensicherung** als Datei (Export/Import)
- **iPad**: zweispaltig (Baustellenliste + Detail), Skizzen im Vollbild; Hell-/Dunkelmodus

## Bekannte Grenzen – bitte lesen

- **Daten liegen nur auf dem jeweiligen Gerät** (IndexedDB im Browser). Kein Abgleich zwischen iPhone und iPad, keine Mehrbenutzer-Funktion, keine Cloud. Übertragung nur über Sicherung erstellen → auf dem anderen Gerät einspielen.
- **Datenverlust ist möglich**: Wird die App vom Home-Bildschirm gelöscht oder werden in iOS die Website-Daten gelöscht, sind die Daten weg. Regelmäßig sichern (Einstellungen → Sicherung erstellen).
- **Nicht auf echten Geräten getestet.** Geprüft wurde in Chromium mit iPhone-/iPad-Bildschirmgrößen. Kamera, Apple Pencil, Teilen-Dialog, Drucken und Speicherverhalten in Safari/iOS müssen auf echter Hardware nachgeprüft werden.
- Skizzen haben kein Zoomen/Verschieben; die Zeichenfläche wird eingepasst.
- Kein Preis-/Artikelstamm, keine Kalkulation, keine Rechnung, keine Kundenunterschrift auf dem Display, keine Anbindung an Lohn- oder Branchensoftware.
- Die Zeiterfassung ist ein Arbeitsnachweis je Baustelle, **kein** manipulationssicheres System zur gesetzlichen Arbeitszeiterfassung.

## Entwicklung

Voraussetzung: Node.js 22+

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Unit-Tests
npm run build    # Typprüfung + Produktions-Build nach dist/
npm run preview  # gebauten Stand lokal ansehen
```

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
