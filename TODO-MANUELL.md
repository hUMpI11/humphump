# Offene Entscheidungen und manuelle Schritte

Hier steht, was nur ein Mensch entscheiden oder erledigen kann (`CLAUDE.md`, Regel 3).

## Entscheidungen

1. **Backend ja oder nein?** Ein Server bringt automatischen Abgleich und mehrere Mitarbeiter, kostet aber laufend Geld und macht den Betreiber zum Auftragsverarbeiter (DSGVO). Bis dahin: Abgleich per Sicherungsdatei. Entscheidungsgrundlage entsteht in `docs/BACKEND.md`.
2. **Für wen ist die App?** Nur für dich, für einen Betrieb mit Mitarbeitern oder als Produkt für andere Betriebe? Davon hängen Rollen, Mandanten und Abrechnung ab.
3. **Native App im App Store?** Braucht einen Mac mit Xcode und einen Apple-Developer-Account (kostenpflichtig). Die PWA lässt sich später verpacken.
4. **Fachliche Freigabe der Protokollvorlagen.** Die Vorlagen sind Arbeitshilfen und von keinem Fachmann geprüft. Vor produktivem Einsatz je Gewerk gegenlesen.

## Manuelle Schritte

1. **GitHub Pages einschalten:** Repository → Settings → Pages → Source „GitHub Actions“. Der Workflow veröffentlicht nur bei Push auf `main`.
2. **Test auf echten Geräten** (iPhone und iPad, Safari): Kamera, Apple Pencil, Teilen-Dialog, Drucken/PDF, Installation auf dem Home-Bildschirm, Verhalten bei vollem Speicher.
3. **Uhrzeit der Geräte** auf „automatisch“ lassen – der Abgleich entscheidet nach Zeitstempel.
