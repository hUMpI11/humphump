# Auftrag E – Backend-Entwurf und API-Vertrag (infra-connectivity)

## Ziel
Entscheidungsreifer Entwurf für Backend und Synchronisation – **nur Dokumente, kein Code**. Der Mensch hat noch nicht entschieden, ob es ein Backend geben soll (laufende Kosten, DSGVO-Pflichten als Auftragsverarbeiter). Der Entwurf muss ihm diese Entscheidung ermöglichen und darf nichts vorwegnehmen.

## Betroffene Dateien (nur diese)
- `docs/BACKEND.md` (neu)
- `docs/api/openapi.yaml` (neu)

## Nicht ändern
Alles andere. Kein Servercode, keine neuen Abhängigkeiten, keine Konten, keine Zugangsdaten.

## Ausgangslage (lesen)
`docs/ARCHITEKTUR.md`, `src/db.ts` (Schema v3 mit `updatedAt` und `tombstones`), `docs/auftraege/C-geraeteabgleich.md` (dieselbe Entscheidungslogik „neuerer Stand gewinnt, Löschvermerk gewinnt bei neuerem Zeitstempel“ soll der Server nutzen). Die App ist eine PWA; alle ids sind clientseitig erzeugte UUIDs.

## Inhalt von `docs/BACKEND.md`
1. **Ziel und Nicht-Ziele**; was der Abgleich per Datei schon leistet und was erst ein Server bringt (mehrere Mitarbeiter, automatischer Abgleich, zentrale Sicherung).
2. **Zielarchitektur** im vorhandenen Stack (TypeScript): API-Dienst, Datenbank mit auf Datenbankebene erzwungener Mandantentrennung, Objektspeicher für Fotos/Skizzen mit signierten, kurzlebigen URLs. Diagramm als Text.
3. **Datenmodell Server**: Abbildung der Client-Tabellen, Mandant (Betrieb), Benutzer, Rollen Inhaber/Vorarbeiter/Mitarbeiter mit Rechte-Matrix (wer sieht wessen Stunden?).
4. **Sync-Protokoll**: Warteschlange auf dem Client, Push/Pull mit Cursor, Idempotenz über Client-ids, Wiederholung mit Backoff, Konfliktstrategie (mit Grenzen: Uhren, Datensatz- statt Feldebene) und was sich dafür im Client ändern müsste, wiederaufnehmbarer Foto-Upload, sichtbarer Sync-Status.
5. **Authentifizierung**: Varianten (z. B. Magic Link, Passwort, Passkey) mit Vor- und Nachteilen für Handwerksbetriebe; wo Tokens in einer PWA liegen dürfen und wo nicht.
6. **Betrieb**: Hosting in der EU, Umgebungen dev/staging/prod, Backups mit getesteter Wiederherstellung, Health-Endpoint, Logs ohne personenbezogene Daten, Konfiguration nur über Umgebungsvariablen.
7. **Datenschutz**: welche personenbezogenen Daten anfallen (Arbeitszeiten, Unterschriften, Fotos mit Personen), Auftragsverarbeitung, Löschkonzept, Aufbewahrung.
8. **Kosten und Aufwand** grob in Größenordnungen, klar als Schätzung gekennzeichnet, ohne erfundene Preise einzelner Anbieter.
9. **Stufenplan** mit kleinstem sinnvollen ersten Schritt.
10. **Offene Entscheidungen für den Menschen** als nummerierte Liste mit je 2–3 Optionen und einer begründeten Empfehlung.

## Inhalt von `docs/api/openapi.yaml`
OpenAPI 3.1, versionierter Pfad (`/v1`): Anmeldung, Sync Push/Pull, Upload-URL für Dateien, Health. Schemas passend zum Client-Datenmodell. Nur der Vertrag.

## Akzeptanzkriterien
1. Jede Aussage zu Anbietern, Preisen oder Rechtslage ist als Annahme oder Schätzung gekennzeichnet; nichts ist erfunden.
2. Die Konfliktstrategie ist dieselbe wie in Auftrag C oder die Abweichung ist begründet.
3. `openapi.yaml` ist syntaktisch gültiges YAML (mit Node prüfen, falls ein Parser im Projekt verfügbar ist; sonst sorgfältig gegenlesen und das im Bericht sagen).
4. Der Abschnitt „Offene Entscheidungen“ ist vollständig genug, um ihn nach `TODO-MANUELL.md` zu übernehmen.

## Commit-Nachricht
`Backend-Entwurf und API-Vertrag`
