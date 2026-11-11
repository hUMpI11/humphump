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

7. **Sicherungsdatei mit Passwort verschlüsseln?** Die Datei enthält Kunden- und Mitarbeiterdaten im Klartext (die App weist darauf hin). Verschlüsselung wäre machbar, aber: Passwort vergessen heißt Sicherung unbrauchbar. Bis zur Entscheidung gilt die Regel „nur an eigene Geräte, an sicherem Ort ablegen, alte Dateien löschen“.
8. **Grenzwerte beim Einspielen** (`src/sync/validate.ts`, `src/lib/export.ts`): 500 MB je Datei, 40 MB je Bild, Zeitstempel höchstens 5 Minuten nach Erstellung der Sicherung. 500 MB sind für ein iPhone vermutlich zu viel – auf einem echten Gerät ausprobieren. Bei Bedarf an den echten Umfang anpassen.
9. **Datenschutzinformation:** Beim Antippen der Adresse geht sie an Apple Karten. Falls die App an andere weitergegeben wird, gehört das (wie die lokale Speicherung insgesamt) in eine Datenschutzinformation.
10. **Konfliktmodell für ein späteres Backend:** Der Entwurf nimmt an: „zuerst am Server angekommen gewinnt, der Konflikt wird angezeigt“, dazu eine Rechte-Matrix je Tabelle. Beides sind Annahmen (`docs/BACKEND.md`, Entscheidungen 6 und 7).
11. **Updates der App:** Eine neue Version wird im Hintergrund geladen und beim nächsten Start aktiv, ohne Rückfrage. Alternative wäre ein Hinweis „Neue Version – jetzt laden?“.

## Manuelle Schritte

1. **GitHub Pages einschalten:** Repository → Settings → Pages → Source „GitHub Actions“. Der Workflow veröffentlicht nur bei Push auf `main`.
2. **Test auf echten Geräten** (iPhone und iPad, Safari): Kamera, Apple Pencil, Teilen-Dialog, Drucken/PDF, Installation auf dem Home-Bildschirm, Verhalten bei vollem Speicher.
3. **Uhrzeit der Geräte** auf „automatisch“ lassen – der Abgleich entscheidet nach Zeitstempel.
4. **Abgleich iPhone ↔ iPad auf echten Geräten ausprobieren** (Sicherung erstellen, per AirDrop/Dateien übertragen, einspielen), auch mit vielen Fotos: Die Datei wird als Ganzes eingelesen, das ist mit großen Sicherungen ungetestet.
5. **GitHub absichern:** Branch-Schutz für `main`, Dependabot und Secret-Scanning einschalten, Zwei-Faktor-Anmeldung für alle mit Schreibrecht, Workflows aus Forks nur nach Freigabe ausführen. Die Actions im Workflow sind per Versions-Tag eingebunden, nicht per Commit-SHA; Dependabot kann das übernehmen.
6. **Geräte absichern:** Sperrcode auf iPhone und iPad (damit sind die Daten auf dem Gerät verschlüsselt), „Wo ist?“ aktiv.
7. **Nach einem Update mit präparierten Dateien gegenprüfen** ist automatisiert (`e2e/einspielen-haertung.spec.ts`); auf echten Geräten einmal mit einer großen echten Sicherung wiederholen.
