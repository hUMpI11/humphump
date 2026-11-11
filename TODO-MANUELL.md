# Offene Entscheidungen und manuelle Schritte

Hier steht, was nur ein Mensch entscheiden oder erledigen kann (`CLAUDE.md`, Regel 3).

## Entscheidungen

1. **Backend ja oder nein?** Ein Server bringt automatischen Abgleich und mehrere Mitarbeiter, kostet aber laufend Geld und macht den Betreiber zum Auftragsverarbeiter (DSGVO). Bis dahin: Abgleich per Sicherungsdatei. Entscheidungsgrundlage entsteht in `docs/BACKEND.md`.
2. **Für wen ist die App?** Nur für dich, für einen Betrieb mit Mitarbeitern oder als Produkt für andere Betriebe? Davon hängen Rollen, Mandanten und Abrechnung ab.
3. **Native App im App Store?** Braucht einen Mac mit Xcode und einen Apple-Developer-Account (kostenpflichtig). Die PWA lässt sich später verpacken.
4. **Fachliche Freigabe der Protokollvorlagen.** Die 16 Vorlagen in `src/protocols/templates.ts` sind Arbeitshilfen und von keinem Fachmann geprüft. Vor produktivem Einsatz je Gewerk gegenlesen, insbesondere:
   - **MSR Datenpunktprüfung:** Typenliste (AI/AO/DI/DO/Sonstige) und vorbelegte Parameter sind eine Annahme. Passt das zu deinen Datenpunktlisten?
   - **Elektro:** nur Isolationswiderstand und Schleifenimpedanz als Messwerte; Schutzleiter, FI-Auslösung, Drehfeld fehlen bewusst.
   - **Druckprobe Heizung/Sanitär:** Druckabfall = Start − Ende, ohne Haltezeit oder Temperaturausgleich; Gas ist nicht abgebildet.
   - **Hydraulischer Abgleich:** nur Voreinstellungen je Heizkörper, keine Volumenstromberechnung.
   - **Maurer, Maler, Trockenbau** haben keine eigene Vorlage; Wandflächen laufen über „Aufmaß Fläche“ mit Abzügen. Eigene Vorlagen gewünscht?
5. **Backend-Fragen im Einzelnen.** `docs/BACKEND.md`, Abschnitt 10, listet 17 Entscheidungen mit Optionen und Empfehlung (u. a. Eigenbau oder Fertigdienst, Hosting-Anbieter, Anmeldeverfahren, Rechte der Mitarbeiter, Aufbewahrungsfristen, Budget). Empfehlung des Entwurfs: vorerst kein Backend, solange nur eigene Geräte abgeglichen werden.
6. **Rechtliches vor einem Betrieb mit Mitarbeitern:** Auftragsverarbeitung, Information der Beschäftigten bei zentraler Arbeitszeiterfassung, Aufbewahrungs- und Löschfristen – mit Steuerberater bzw. Rechtsbeistand klären. Die Aussagen dazu im Entwurf sind Annahmen.

## Manuelle Schritte

1. **GitHub Pages einschalten:** Repository → Settings → Pages → Source „GitHub Actions“. Der Workflow veröffentlicht nur bei Push auf `main`.
2. **Test auf echten Geräten** (iPhone und iPad, Safari): Kamera, Apple Pencil, Teilen-Dialog, Drucken/PDF, Installation auf dem Home-Bildschirm, Verhalten bei vollem Speicher.
3. **Uhrzeit der Geräte** auf „automatisch“ lassen – der Abgleich entscheidet nach Zeitstempel.
4. **Abgleich iPhone ↔ iPad auf echten Geräten ausprobieren** (Sicherung erstellen, per AirDrop/Dateien übertragen, einspielen), auch mit vielen Fotos: Die Datei wird als Ganzes eingelesen, das ist mit großen Sicherungen ungetestet.
