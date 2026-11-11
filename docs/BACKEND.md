# Backend- und Sync-Entwurf

Stand: Entwurf zur Entscheidung (Auftrag E). Es wird nichts gebaut und nichts vorweggenommen. Das Dokument soll die Frage „Backend ja oder nein?“ (`TODO-MANUELL.md`, Entscheidung 1) beantwortbar machen. Der API-Vertrag steht in [`api/openapi.yaml`](api/openapi.yaml).

**Kennzeichnung:** Aussagen, die ich nicht aus dem Repository belegen kann (Anbieter, Preise, Rechtslage, Verhalten von iOS/Safari), sind mit **[Annahme]** oder **[Schätzung]** markiert und vor einer Entscheidung zu prüfen. Preise einzelner Anbieter nenne ich bewusst nicht.

## 1. Ziel und Nicht-Ziele

### Ziel
Ein optionaler Server, der die lokalen Daten der PWA mehrerer Geräte und mehrerer Personen eines Betriebs automatisch abgleicht und zentral sichert. Die App bleibt local-first: Der Server ist nie Voraussetzung, um Daten zu erfassen oder zu lesen.

### Nicht-Ziele
- Kein Online-Zwang, kein Login-Zwang für die lokale Nutzung. Ohne Netz oder mit abgelaufenem Token bleibt alles lokal voll nutzbar; Anmeldung steuert nur den Abgleich.
- Keine Echtzeit-Zusammenarbeit (gleichzeitiges Bearbeiten desselben Datensatzes), keine Feld-für-Feld-Verschmelzung in der ersten Version.
- Keine Web-Oberfläche für Büro/Buchhaltung, keine Abrechnungs- oder Kundenverwaltung, keine Push-Benachrichtigungen.
- Keine native App (`TODO-MANUELL.md`, Entscheidung 3). Dieselbe API bedient später iPhone-/iPad-PWA und eine verpackte Version.

### Was der Abgleich per Datei (Auftrag C) schon leistet
Zusammenführen je Datensatz nach Zeitstempel (nur dort, ohne Server), Löschvermerke, iPhone ↔ iPad für **eine** Person, ohne Konto, ohne laufende Kosten, ohne Datenschutzpflichten als Betreiber.

### Was erst ein Server bringt
| Bedarf | Datei-Abgleich | Server |
|---|---|---|
| Ein Mensch, mehrere eigene Geräte | ja, manuell | ja, automatisch |
| Mehrere Mitarbeiter eines Betriebs | nein (manuelles Hin- und Hersenden) | ja, mit Rollen |
| Automatischer Abgleich im Hintergrund | nein | ja (bei Netz) |
| Zentrale Sicherung, Gerät verloren/kaputt | nur wenn Datei gesichert wurde | ja |
| Vollbilder nicht auf jedem Gerät vorhalten | nein | ja (Objektspeicher, bei Bedarf laden) |
| Kosten / Pflichten | keine | laufend; Betreiber wird ggf. Auftragsverarbeiter (Abschnitt 7) |

**Ehrliche Einordnung:** Wenn die App nur für eine Person mit zwei Geräten gedacht ist, genügt der Datei-Abgleich. Ein Server lohnt sich erst bei mehreren Mitarbeitern, bei Datenverlust-Risiko oder wenn Fotos nicht mehr auf jedem Gerät Platz finden.

## 2. Zielarchitektur

Vorhandener Stack: TypeScript. Vorschlag: ein TypeScript-API-Dienst (Node.js), eine relationale Datenbank, ein S3-kompatibler Objektspeicher. **[Annahme]** PostgreSQL, weil Row-Level-Security (RLS) die Mandantentrennung in der Datenbank erzwingt; Alternativen in den offenen Entscheidungen.

```
 iPhone-PWA / iPad-PWA (Dexie, IndexedDB)           Betreiber (EU)
 ┌───────────────────────────────┐           ┌─────────────────────────────────────┐
 │ Views (lesen/schreiben lokal) │           │  Reverse Proxy / TLS                │
 │        │                      │           │        │                            │
 │ db.ts + tracking.ts           │           │  API-Dienst  /v1  (TypeScript)      │
 │        │ schreibt auch        │  HTTPS    │   - Auth, Rollen, Validierung       │
 │  outbox (neu)  uploads (neu)  │ ────────► │   - Sync Push/Pull (Cursor)         │
 │        │                      │  JSON     │   - signiert Upload-/Download-URLs  │
 │  Sync-Worker (im Tab)         │ ◄──────── │        │                 │          │
 └───────┬───────────────────────┘           │  PostgreSQL (RLS je     Objektspeicher│
         │ PUT/GET direkt, signierte URL     │  Mandant, Backups)      (S3-kompatibel)│
         └──────────────────────────────────►│  nur Blobs, privat, kein öffentlicher │
                                             │  Zugriff                              │
                                             └─────────────────────────────────────┘
```

Grundsätze:
- **Daten über die API, Binärdaten direkt zum Objektspeicher.** Der API-Dienst reicht keine Fotos durch; er stellt kurzlebige signierte URLs aus (Hochladen: Minuten, Herunterladen: Minuten). Der Bucket ist nie öffentlich.
- **Mandantentrennung in der Datenbank:** Jede Tabelle hat `tenant_id`. RLS-Policies erlauben nur Zeilen mit `tenant_id = current_setting('app.tenant_id')`. Der API-Dienst setzt den Wert pro Transaktion aus dem geprüften Token (nie aus Anfrage-Daten) und verbindet sich mit einer Datenbankrolle ohne `BYPASSRLS`. Objekt-Schlüssel beginnen mit `tenant/<tenant_id>/`; signierte URLs werden nur für Schlüssel des eigenen Mandanten ausgestellt.
- **Ein Vertrag:** `openapi.yaml` ist die einzige Schnittstelle; Pfade sind versioniert (`/v1`). Brechende Änderungen bekommen `/v2`, `/v1` läuft mindestens so lange, wie Geräte offline sein dürfen (Abschnitt 4: 180 Tage).
- **Kein neuer Stack im Client:** Dexie bleibt; der Sync-Worker ist reines TypeScript in `src/sync/`, `fetch` genügt.

**Fertigdienste statt Eigenbau** (nur zur Prüfung, nicht bewertet): Hosted-Sync für Dexie, Backend-as-a-Service mit Postgres und Row-Level-Security, oder Sync-Engines (z. B. CouchDB/PouchDB-Familie). **[Annahme]** Sie sparen Entwicklungsaufwand, bringen aber eigene Datenmodelle, Preis- und Auftragsverarbeitungsfragen; ob sie EU-Hosting, die Rollen-Matrix und Fotos über Objektspeicher abdecken, habe ich nicht geprüft.

## 3. Datenmodell Server

### Mandant, Benutzer, Rollen
| Tabelle | Zweck |
|---|---|
| `tenants` | Betrieb: `id`, Name, Status, Anlagedatum |
| `users` | Person: `id`, E-Mail (eindeutig), Anzeigename, Status |
| `memberships` | `tenant_id`, `user_id`, `role` ∈ {`inhaber`, `vorarbeiter`, `mitarbeiter`} |
| `project_members` (optional, ab Stufe 2) | Zuweisung Person ↔ Baustelle |
| `devices` | `id` (vom Client erzeugt), `user_id`, Name, zuletzt gesehen, gesperrt ja/nein |
| `auth_*` | Magic-Link-Codes, Refresh-Token (nur Hashes), Passkey-Credentials |
| `sync_state` | je Mandant ein Zähler `seq` (Abschnitt 4) |

Ein Benutzer kann in mehreren Mandanten Mitglied sein (z. B. Subunternehmer); das Token gilt für genau einen Mandanten.

### Abbildung der Client-Tabellen
Jede synchronisierte Client-Tabelle (`SYNC_TABLES` in `src/db.ts`) wird eine Server-Tabelle mit gleichem Namen und gleicher `id` (UUID, vom Client erzeugt) und diesen **zusätzlichen** Spalten:

| Spalte | Bedeutung |
|---|---|
| `tenant_id` | Mandant, RLS-Schlüssel |
| `version` | Server-Version des Datensatzes, +1 bei jeder angenommenen Änderung (auch Löschen); Grundlage der Konfliktentscheidung (4.4) |
| `updated_at` | Zeitstempel des Clients in ms, **nur Hinweis** für Anzeige (ggf. begrenzt, siehe 4.4); entscheidet nichts |
| `deleted_at` | gesetzt = Datensatz gelöscht (Löschvermerk, ersetzt die Tabelle `tombstones`); Daten werden geleert. Ebenfalls nur Hinweis; maßgeblich ist, dass der Datensatz gelöscht ist und eine Version hat |
| `seq` | monotone Server-Nummer je Mandant, Grundlage des Pull-Cursors |
| `author_id` | Benutzer, der die **letzte angenommene** Änderung geschickt hat (aus dem Token, nie aus dem Body); gilt für jede Tabelle, siehe unten |
| `created_by` | Benutzer, der den Datensatz **zuerst** angelegt hat; unveränderlich. Grundlage für „eigene Einträge“ in der Rechte-Matrix |

Die fachlichen Felder (`projects.name`, `times.minuten`, …) entsprechen `src/db.ts`. **Vorschlag:** häufig gefilterte Felder (`project_id`, `datum`, bei `times` `user_id`) als echte Spalten, der Rest als `jsonb` – so bleibt die Server-Tabelle bei additiven Client-Änderungen (Schema nur additiv, `ARCHITEKTUR.md`) stabil. `tombstones` und `settings` des Clients werden **nicht** als Tabelle gespiegelt (Löschvermerk = `deleted_at`; Einstellungen sind gerätelokal; `profil` pro Benutzer wäre später ein eigener Endpunkt).

**`author_id` und `created_by` je Tabelle** (beide setzt der Server aus dem Token):

| Tabelle | `author_id` | `created_by` / Eigentümer |
|---|---|---|
| `projects` | letzter Bearbeiter | Anleger; Rechte laufen über Rolle und Zuweisung, nicht über den Anleger |
| `times` | letzter Bearbeiter | = `user_id`: wessen Stunden es sind (bestimmt „eigene Stunden“); ändert ein Vorarbeiter den Eintrag, wechselt nur `author_id` |
| `materials`, `notes`, `photos`, `sketches`, `protocols` | letzter Bearbeiter | Ersteller; bestimmt „eigene Einträge“ (Mitarbeiter ändern/löschen nur diese) |
| `signatures` | Benutzer, der die Unterschrift aufgenommen hat | gleich; Unterschriften sind nach Anlegen unveränderlich, Änderung heißt löschen und neu anlegen |
| `blobs` | Benutzer, der den Upload angefordert hat | gleich; Rechte folgen der Baustelle und dem zugehörigen Foto/der Skizze |

Besonderheiten:
- **`times.mitarbeiter`** ist heute freier Text. Für Rechte („wessen Stunden?“) braucht der Server `user_id`. Er setzt sie beim ersten Push aus dem Token (`created_by`); der Text bleibt als Anzeigename erhalten. Das ist eine **Client-Änderung** (Feld `userId` optional ergänzen, additiv).
- **`blobs`:** Server speichert nur Metadaten (`id`, `project_id`, `mime`, `size`, `sha256`, `object_key`, `status` ∈ {`pending`, `available`}). Die Binärdaten liegen im Objektspeicher.
- **`photos.thumb`** und **`signatures.data`** (kleine Binärdaten) reisen als Base64 im Datensatz (Grenzen im Vertrag: Vorschaubild max. 128 KB, Unterschrift max. 512 KB **[Annahme]**: reicht für die heutigen Größen, vor Stufe 1 anhand echter Daten prüfen). Vollbilder, Skizzen-Renderings und Skizzenhintergründe (`id:bg`) laufen über den Objektspeicher.
- **`updatedAt` bei allen Tabellen:** `times`, `materials`, `photos`, `signatures` haben im Client-Typ nur `createdAt`; `tracking.ts` (Auftrag C) ergänzt `updatedAt` beim Schreiben. Der Server verlangt `updatedAt` bei jedem Datensatz, nur als Hinweis (Entscheidung fällt nach Server-Version, 4.4).

### Rechte-Matrix
**[Annahme]** als Startpunkt; die Zuordnung ist eine fachliche Entscheidung des Menschen (Entscheidung 7).

| Daten | Inhaber | Vorarbeiter | Mitarbeiter |
|---|---|---|---|
| Baustellen anlegen/ändern/löschen | alle | anlegen/ändern, nicht löschen | nur lesen (zugewiesene) |
| Eigene Stunden erfassen/ändern | ja | ja | ja |
| Stunden **anderer** sehen | alle | alle zugewiesenen Baustellen | nein (nur eigene) |
| Stunden anderer ändern | ja | ja, zugewiesene Baustellen | nein |
| Material, Notizen, Fotos, Skizzen | alle | zugewiesene Baustellen, lesen/schreiben | zugewiesene Baustellen, lesen/schreiben; fremde Einträge nur lesen |
| Protokolle | alle | zugewiesene, ausfüllen/abschließen | zugewiesene, ausfüllen (nicht abschließen) |
| Unterschriften (Kundendaten) | alle | zugewiesene, anlegen/lesen | nein |
| Benutzer einladen/entfernen, Rollen | ja | nein | nein |
| Betrieb exportieren/löschen | ja | nein | nein |

**Entwurf – Schreibprüfung beim Upsert (nach Security-Review):** Der API-Dienst prüft das Schreibrecht gegen den **bestehenden** Datensatz (gehört er dem Mandanten, darf diese Rolle ihn ändern; bei fremden Stunden z. B. nur Vorarbeiter/Inhaber) **und** gegen das **Ziel** (die `projectId` im Body muss eine dem Benutzer zugewiesene Baustelle des Mandanten sein). Nur den neuen Zustand zu prüfen, würde erlauben, einen fremden Datensatz durch Umhängen auf eine eigene Baustelle zu „übernehmen“, oder umgekehrt Datensätze in eine nicht zugewiesene Baustelle zu schreiben. `tenant_id`, `author_id` und `deviceId` stammen **nie** aus dem Body, sondern aus Token und Sitzung; entsprechende Felder im Body werden verworfen. Das gilt auch für `delete`.

**Entwurf – Rechteprüfung für Dateien und Löschen:**
- **Upload-URLs** (`POST /v1/files/upload-urls`): Der Server prüft vor dem Signieren das Schreibrecht der Rolle auf die genannte Baustelle (zugewiesen, nicht gesperrt), dass die `blobId` zu diesem Mandanten und dieser Baustelle gehört (nicht einem fremden Blob entspricht) und Größe/Typ. Der Objektschlüssel wird vom Server gebildet (`tenant/<tenant_id>/…`), nie vom Client; eine Wiederholung für fremde Blobs ergibt 403. `complete` prüft dasselbe erneut.
- **Download-URLs:** Leserecht auf die Baustelle und die Datensatzart nach Matrix (Mitarbeiter ohne Zuweisung: 403, unbekannte oder fremde Blobs: 404). Die URL gilt Minuten und nur für den einen Schlüssel.
- **Löschen** (Push `delete`): Die Rolle muss das Löschen dieser Datensatzart erlauben (Baustelle löschen: nur Inhaber; Mitarbeiter: nur eigene Einträge nach `created_by`; Vorarbeiter: Einträge zugewiesener Baustellen, keine Baustellen). Der Löschvermerk mit seiner Kaskade (4.4) und das Entfernen der Objekte im Speicher laufen **erst nach** bestandener Prüfung; fehlendes Recht ergibt `rejected/forbidden`, nichts wird gelöscht.

Durchsetzung: Rechte werden **im API-Dienst** geprüft (Push: Schreibrecht je Datensatz; Pull: Filter je Rolle). RLS sichert zusätzlich die Mandantengrenze; die Rollenlogik gehört nicht in RLS. Folge für den Pull: Sieht ein Mitarbeiter fremde Stunden nicht, darf der Server sie **nicht** ausliefern, auch nicht als Löschvermerk-Hülle mit Inhalt. Ändert sich der Rechtekreis einer Person (Zuweisung, Rolle), erhöht der Server deren „Scope-Version“ und beantwortet alte Cursor mit `410 cursor_expired`; das Gerät lädt neu (4.6).

## 4. Sync-Protokoll

### 4.1 Client: Warteschlange
Neue Dexie-Tabellen (additiv, `db.version(4)`, **Änderung an `src/db.ts`** – nicht Teil dieses Auftrags):
- `syncmeta`: Schlüssel `tabelle:id`, `version` (letzte bekannte Server-Version; Grundlage der `baseVersion`).
- `outbox`: Schlüssel `tabelle:id`, `op` (`upsert`/`delete`), `baseVersion`, lokale Änderungsnummer, `queuedAt`, `attempts`, `nextTryAt`. Ein Datensatz hat höchstens **einen** Eintrag (spätere Änderung überschreibt die frühere); es genügt der letzte Stand.
- `uploads`: Schlüssel `blobId`, Zustand, `uploadId`, Fortschritt, `attempts`, `nextTryAt`.
- `settings`: `deviceId` (UUID), `serverCursor`, `lastSyncAt`, `syncEnabled`.

`tracking.ts` schreibt zusätzlich zu `updatedAt`/Löschvermerk einen `outbox`-Eintrag (nicht in einer mit `untrackCurrentTransaction` ausgenommenen Transaktion). Vom Server geholte Änderungen werden in einer solchen ausgenommenen Transaktion eingespielt und erzeugen **keinen** Rückkanal; Eingaben der Oberfläche währenddessen bleiben verfolgt. Der vorhandene Dateiabgleich bleibt als Ausweichweg bestehen.

Aktuelle Zustände müssen vor dem ersten Abgleich einmalig in die `outbox` gelegt werden (Erstabgleich, Entscheidung 14).

### 4.2 Push
`POST /v1/sync/push` mit `deviceId`, `batchId` (UUID) und bis zu 100 Änderungen (`upsert` mit vollem Datensatz, oder `delete`), jede mit der `baseVersion`, auf der sie aufbaut (0 = neuer Datensatz). Der Server prüft Token, Rolle, Schema, Größe und entscheidet **pro Datensatz** nach Version (4.4). Antwort je Änderung: `applied` (mit neuer `version`), `conflict` (der Server-Stand ist inzwischen ein anderer; er wird mitgeliefert, bzw. `serverDeleted`) oder `rejected` (Recht/Validierung, mit Grund). Konflikte sind kein Fehler; abgewiesene Änderungen werden **nicht** wiederholt, sondern dem Nutzer angezeigt (4.9).

### 4.3 Idempotenz
- Alle Datensatz-IDs sind Client-UUIDs. Eine wiederholte Änderung trifft entweder dieselbe `baseVersion` (dann ist sie schon in der gespeicherten Antwort zur `batchId` enthalten) oder einen schon weitergezählten Stand: Ist der Inhalt identisch mit dem Server-Stand, antwortet der Server `applied` ohne neue Version, sonst `conflict`.
- `batchId` macht ganze Pakete wiederholbar: Der Server merkt sich Antworten je `(tenant, batchId)` mindestens 24 Stunden und liefert bei Wiederholung dieselbe Antwort. Der Header `Idempotency-Key` trägt dieselbe ID.
- Schreibt der Client bei Netzabbruch nicht bestätigt, schickt er das Paket unverändert nochmals. Erst nach Antwort wird der `outbox`-Eintrag gelöscht – und nur, wenn der Eintrag nicht inzwischen durch eine neuere lokale Änderung ersetzt wurde (Vergleich einer lokalen Änderungsnummer im Eintrag, nicht der Uhrzeit).

### 4.4 Konfliktstrategie
**Ein Entscheidungsmodell: Server-Version und `baseVersion`. Die Reihenfolge vergibt der Server; Zeitstempel des Clients entscheiden nie.**

Jeder Datensatz hat am Server eine `version` (+1 je angenommener Änderung, auch Löschen) und die Mandanten-`seq` (4.5). Jede Änderung nennt die `baseVersion`, auf der sie aufbaut:
- **`baseVersion` = Server-`version`:** Die Änderung baut auf dem aktuellen Stand auf und wird übernommen (`applied`). Neue Datensätze haben `baseVersion` 0.
- **`baseVersion` < Server-`version`** (zwischenzeitlich hat jemand anderes geändert oder gelöscht): **Konflikt.** Der Server-Stand bleibt, die Änderung wird nicht angewandt (`conflict`), die Antwort enthält den Server-Stand bzw. `serverDeleted`. Der Client übernimmt den Server-Stand lokal; seine abgelehnte Fassung zeigt er dem Nutzer an („Änderung wurde durch eine neuere ersetzt“), bis dieser sie verwirft oder erneut anwendet (dann mit der neuen `baseVersion`). Es geht nichts stillschweigend verloren.
- **Löschen** folgt derselben Regel: Ein `delete` mit aktueller `baseVersion` wird übernommen; mit veralteter `baseVersion` (der Datensatz wurde inzwischen geändert) ist es ein Konflikt und der Datensatz bleibt. Ein `upsert` auf einen inzwischen gelöschten Datensatz mit veralteter `baseVersion` ist ebenfalls ein Konflikt (`serverDeleted`); wer ihn wiederherstellen will, legt ihn bewusst neu an.
- **Pull:** Der Client übernimmt Server-Stände und merkt sich deren `version` je Datensatz (Tabelle `syncmeta`, 4.1). Hat er für denselben Datensatz noch eine offene Änderung in der `outbox`, bleibt sie bestehen; sie wird beim nächsten Push als Konflikt gemeldet, falls die `baseVersion` überholt ist.

**Client-Zeit ist nur ein Hinweis.** `updatedAt` und `deletedAt` dienen der Anzeige (z. B. „zuletzt geändert“) und der Warnung bei falscher Uhr. Der Server vergleicht den Hinweis mit seiner Zeit; liegt er mehr als 5 Minuten **[Annahme: Schwelle]** in der Zukunft, setzt er ihn für die Anzeige auf die Serverzeit und meldet den Versatz (`clockSkewMs`), damit die App warnen kann. Eine falsch gestellte oder manipulierte Uhr kann so keinen Stand dauerhaft „gewinnen lassen“, weil sie die Entscheidung gar nicht beeinflusst.

**Abgrenzung zum Datei-Abgleich (Auftrag C).** `src/sync/merge.ts` (`decide`) entscheidet nach Zeit: neuerer `updatedAt ?? createdAt ?? 0` gewinnt, Löschvermerk bei `deletedAt >= Zeitstempel`. Dort gibt es keine gemeinsame Instanz für eine Reihenfolge. Damit eine falsche Uhr nicht dauerhaft gewinnt, begrenzt `merge.ts` Zeitstempel auf den Erstellzeitpunkt der Sicherung plus 5 Minuten. Der Server-Weg ersetzt diese Zeitregel durch die Versionsregel; beide Wege bleiben getrennt, `decide` wird für den Server **nicht** wiederverwendet. Beim Erstabgleich (Entscheidung 14) wird jeder lokale Datensatz mit `baseVersion` 0 gesendet; kennt der Server die `id` schon, ist es ein Konflikt und der Server-Stand gilt.

**Grenzen (ehrlich):**
- **Datensatz statt Feld:** Ändern zwei Personen offline dieselbe Baustelle (z. B. A die Adresse, B das Telefon), gewinnt die zuerst am Server angekommene Änderung komplett; die andere wird als Konflikt gemeldet und muss neu angewandt werden. Meist unkritisch, weil Stunden, Material, Notizen, Fotos je eigene Datensätze sind und von **einer** Person erfasst werden. Kritisch: `projects`, `notes` (Mehrfachbearbeitung), `protocols` (mehrere Personen füllen dasselbe Protokoll). Mögliche Nachbesserung: feldweise Versionen für `projects`/`protocols.values` (offene Entscheidung 6).
- **Wer zuerst sendet, gewinnt:** Eine lange offline gemachte Änderung kann von einer später gemachten, aber früher gesendeten verdrängt werden. Das ist bewusst: Es ist nachvollziehbar und unabhängig von Uhren.
- **Kaskade:** Löscht jemand eine Baustelle, schreibt der Client Löschvermerke für alle abhängigen Datensätze (`deleteProject`); der Server löscht abhängige Zeilen bei einem `projects`-Löschvermerk zusätzlich selbst, damit nachträglich eintreffende Alt-Datensätze nicht „zurückkehren“ (sie ergeben `conflict`/`serverDeleted`). Voraussetzung ist die Löschberechtigung (Abschnitt 3).

### 4.5 Pull mit Cursor
`GET /v1/sync/pull?cursor=<opak>&limit=200`. Der Server vergibt beim Schreiben jeder Änderung die nächste Nummer `seq` aus dem Mandanten-Zähler (Zähler wird in derselben Transaktion erhöht und gesperrt; dadurch entstehen keine „späteren, aber kleineren“ Nummern, die ein Pull überspringen könnte **[Annahme]** – bei kleinen Mandanten unproblematisch, Schreiblast je Mandant wird serialisiert). Der Pull liefert alle Änderungen mit `seq > cursor` in Reihenfolge, dazu `hasMore` und den nächsten Cursor. Der Client wendet jede Änderung als Server-Stand an (mit ihrer `version`), in einer Transaktion, die von der Änderungsverfolgung ausgenommen ist (`untrackCurrentTransaction`, `src/sync/tracking.ts`), außer der Datensatz hat eine offene Änderung in der `outbox` (4.4). Der Cursor wird erst nach erfolgreichem Einspielen der Seite gespeichert.

**Reihenfolge:** Erst Push, dann Pull, damit lokale Änderungen vor dem Überschreiben geprüft werden.

### 4.6 Aufbewahrung von Löschvermerken, Neuabgleich
Der Server hält Löschvermerke mindestens **180 Tage** (wie der Client). Ein Gerät, das länger offline war (Cursor älter), oder dessen Rechtekreis sich geändert hat, bekommt `410 cursor_expired`. Es schickt zuerst seine offenen lokalen Änderungen (Push), holt dann den Stand komplett (Pull ohne Cursor, seitenweise) und übernimmt je Datensatz den Server-Stand (offene eigene Änderungen bleiben und werden als Konflikt gemeldet, falls überholt). Lokale Datensätze, die der Server nicht kennt und die nicht in der `outbox` stehen, gelten als gelöscht (nur in diesem Modus, mit Rückfrage in der Oberfläche **[Vorschlag]**).

### 4.7 Wiederholung mit Backoff
Fehlerklassen: Netzfehler, 408/429/5xx → wiederholen; 4xx (außer 408/409/429) → nicht wiederholen, Eintrag als „Fehler“ markieren und anzeigen; 401 → Token erneuern (5), sonst „Anmeldung nötig“. Backoff: exponentiell mit Zufallsanteil, z. B. 5 s, 15 s, 1 min, 5 min, dann höchstens alle 15 min **[Annahme: Werte]**; `Retry-After` des Servers hat Vorrang. Auslöser: App-Start, Rückkehr in den Vordergrund, Ereignis `online`, nach jeder lokalen Änderung (entprellt), manuell. **[Annahme]** iOS-Safari unterstützt Background Sync für PWAs nicht verlässlich; Abgleich läuft deshalb nur bei geöffneter App. Das ist zu testen (`TODO-MANUELL.md`, manuelle Schritte).

### 4.8 Wiederaufnehmbarer Foto-Upload
1. Client verkleinert/komprimiert das Foto wie heute (`src/lib`), erzeugt `blobs`-Eintrag lokal, `photos`/`sketches`-Datensatz geht normal durch die Outbox.
2. `uploads`-Eintrag: `POST /v1/files/upload-urls` (Blob-ID, MIME, Größe, SHA-256) → Server prüft Recht und Limit (Größe/Typ), legt `blobs`-Metadaten mit `status=pending` an und liefert eine signierte URL (`single`, Datei bis 8 MB **[Annahme]**) oder einen Satz signierter Teil-URLs (`multipart`, je 5 MB, **[Annahme]** S3-kompatibler Mehrteil-Upload).
3. Client lädt hoch. Bei Abbruch fragt er den Zustand ab (`POST /v1/files/upload-urls` mit gleicher Blob-ID ist idempotent und liefert bei Multipart die schon hochgeladenen Teile) und lädt nur fehlende Teile nach.
4. `POST /v1/files/complete` mit Teil-Prüfsummen; der Server prüft Größe/Prüfsumme, setzt `status=available`. Erst dann gilt der Blob als gesichert; bis dahin zeigt die App „wartet auf Hochladen“.
5. Herunterladen: `GET /v1/files/download-url?blobId=…` → kurzlebige URL. Pull liefert `blobs`-Metadaten; die Binärdaten lädt der Client erst bei Bedarf (Vorschaubild kommt mit dem Datensatz). **Client-Änderung:** Views müssen einen Blob kennen können, dessen Daten (noch) fehlen („wird geladen“, Wiederholen offline).

Ob Vollbilder nach dem Hochladen lokal bleiben oder verdrängt werden dürfen, ist eine Speicherentscheidung (offene Entscheidung 8).

### 4.9 Sichtbarer Sync-Status
Ein Statuszustand pro Gerät, abgeleitet aus Outbox/Uploads/Cursor: **Aktuell** (nichts offen, letzter Abgleich Zeit), **Wartet** (n Änderungen, m Fotos offen), **Läuft**, **Offline**, **Fehler** (Datensatz/Datei mit Grund, einzeln wiederholbar), **Anmeldung nötig**. Anzeige in der Kopfzeile (klein) und Details in den Einstellungen; je Eintrag in Listen optional ein Wolken-Symbol „noch nicht gesichert“. Ein Datensatz mit Status `rejected` bleibt sichtbar, bis der Nutzer entscheidet (nicht stillschweigend verwerfen).

### 4.10 Änderungen im Client (Übersicht)
Nicht Teil dieses Auftrags, aber Folge des Entwurfs:
1. `db.ts`: `outbox`, `syncmeta`, `uploads`, optionale `userId` in `TimeEntry`; Schemaversion 4 (additiv).
2. `tracking.ts`: Outbox-Einträge schreiben; `updatedAt` für alle synchronisierten Tabellen (in C vorgesehen).
3. Neues `src/sync/engine.ts` (Push/Pull/Backoff) und `src/sync/api.ts` (typisierter Client, ideal aus `openapi.yaml` erzeugt; keine neue Abhängigkeit zwingend).
4. Versionslogik im Sync-Worker (`baseVersion` je Änderung, Konflikt-Anzeige, 4.4); `decide` bleibt dem Datei-Abgleich vorbehalten.
5. Foto-/Skizzenpfad: Blob-Metadaten ohne Daten zulassen, Upload-Warteschlange, Status in der UI.
6. Einstellungen: Anmeldung, Sync an/aus, Status, Gerät abmelden.
7. Service Worker: API-Aufrufe nie cachen; Antworten mit `Authorization` nicht im Cache.

## 5. Authentifizierung

Auth steuert **nur den Abgleich**. Ohne gültige Anmeldung bleibt die App lokal voll nutzbar.

| Variante | Vorteile | Nachteile (für Handwerksbetriebe) |
|---|---|---|
| **Magic Link / Einmalcode per E-Mail** | Kein Passwort, schnell eingerichtet, Einladung per E-Mail naheliegend | Braucht E-Mail-Zugang und Netz zum Anmelden; E-Mail-Versand ist eine zusätzliche Abhängigkeit (Zustellbarkeit, Auftragsverarbeitung); Link öffnet auf dem iPhone ggf. in Safari statt in der installierten PWA **[Annahme]**, deren Speicher getrennt ist: deshalb zusätzlich einen 6-stelligen Code zum Eintippen in der PWA anbieten |
| **Passwort** | Vertraut, kein Zusatzgerät | Vergessen/Wiederverwendung, Reset-Prozess nötig, Phishing, Support-Aufwand; Passwörter speichern ist Verantwortung des Betreibers |
| **Passkey (WebAuthn)** | Sehr sicher, Face-/Touch-ID, nichts zu merken, phishing-resistent | Ersteinrichtung und Gerätewechsel erklärungsbedürftig; Verhalten in installierten iOS-PWAs ist zu testen **[Annahme]**; braucht Notfallweg (Wiederherstellung) |
| **Einladungscode/QR** für Mitarbeiter ohne E-Mail | Niedrige Hürde auf der Baustelle: Inhaber zeigt Code, Mitarbeiter scannt | Eigenes Verfahren; Code kurzlebig und einmalig halten; Gerät muss danach per Token weiterarbeiten |

**Empfehlung als Startpunkt:** Einladung durch den Inhaber (E-Mail-Link oder QR), Anmeldung per Einmalcode, danach Passkey als Komfort. Begründung: kein Passwort-Support für Kleinbetriebe, wenig Sicherheitsaufwand. Der Vertrag enthält Magic-Link-Code-Austausch, Token-Erneuerung, Abmelden; Passkey-Endpunkte sind als optionale Erweiterung vorgesehen.

### Wo Tokens liegen dürfen
- **Zugriffstoken** (kurzlebig, z. B. 15 Minuten **[Annahme]**): nur im Arbeitsspeicher der App, nie in `localStorage`, nie in der Dexie-Datenbank.
- **Refresh-Token:** als `HttpOnly`, `Secure`, `SameSite=Strict`-Cookie, gesetzt vom API-Dienst, für JavaScript unlesbar; rotierend (bei jeder Erneuerung neu, Wiederverwendung eines alten Tokens sperrt die Sitzung). **Voraussetzung:** API und PWA unter derselben registrierbaren Domain, damit das Cookie „First-Party“ ist (Entscheidung 12). **[Annahme]** Cookies, die der Server setzt, unterliegen in installierten Safari-Web-Apps nicht der 7-Tage-Löschung für Skript-Speicher; vor einer Entscheidung auf echten Geräten prüfen.
- **Nicht erlaubt:** Tokens in `localStorage`/`sessionStorage`/IndexedDB (jedes eingeschleuste Skript kann sie lesen), in URLs oder in Logs. Der Magic-Link-Code steht nur einmal und kurz (z. B. 10 Minuten) gültig im Link und wird beim Einlösen sofort verbraucht.
- Gerät abmelden/sperren: Server widerruft Refresh-Token des Geräts; lokale Daten bleiben auf dem Gerät (Remote-Löschung ist bei einer PWA nicht zuverlässig möglich – Entscheidung 13).
- Sicherheitsrelevante Antworten (Token) mit `Cache-Control: no-store`; Content-Security-Policy ohne Inline-Skript verringert das XSS-Risiko **[Annahme: Machbarkeit mit vorhandenem Build prüfen]**.

## 6. Betrieb

- **Hosting in der EU:** Rechenzentrum und Datenbank/Objektspeicher in der EU. Das allein schließt Zugriffe nach Drittlandrecht bei Anbietern mit Sitz außerhalb der EU nicht aus **[Annahme/rechtlich zu prüfen]**. Anbieterwahl ist offen (Entscheidung 3).
- **Umgebungen:** `dev` (lokal, Wegwerfdaten), `staging` (wie prod, synthetische Daten, nie echte Kundendaten), `prod`. Eigene Datenbank, eigener Bucket, eigene Schlüssel je Umgebung. CI führt Tests und Build aus und prüft den Vertrag (`openapi.yaml` gültig, Antworten entsprechen dem Schema).
- **Reproduzierbar:** Container-Image (Dockerfile) und Migrationsskripte im Repository; Migrationen nur vorwärts und additiv, passend zur Client-Regel.
- **Konfiguration/Secrets:** ausschließlich Umgebungsvariablen oder Secret-Store; im Repository nur `.env.example` ohne Werte. Vorgesehene Variablen (Namen, keine Werte): `DATABASE_URL`, `OBJECT_STORE_ENDPOINT`, `OBJECT_STORE_BUCKET`, `OBJECT_STORE_ACCESS_KEY`, `OBJECT_STORE_SECRET_KEY`, `TOKEN_SIGNING_KEY`, `MAIL_SMTP_URL`, `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS`, `LOG_LEVEL`.
- **Health:** `GET /v1/health` ohne Anmeldung; liefert nur Status und Version, Details (Datenbank, Objektspeicher erreichbar) ohne interne Namen.
- **Logs:** strukturiert (JSON), mit Anfrage-ID, Pfad, Status, Dauer, Mandanten-ID (pseudonym), Gerät. **Nie** E-Mail-Adressen, Namen, Texte, Token, Datensatz-Inhalte, Dateinamen oder IPs im Klartext; IPs allenfalls gekürzt/gehasht und kurz aufbewahrt. Fehlerberichte (Dienste Dritter) erst nach Entscheidung 11.
- **Backups:** Datenbank mit Punkt-in-Zeit-Wiederherstellung **[Annahme: verfügbar je nach Anbieter]**, Objektspeicher mit Versionierung oder Replikation, Aufbewahrung begrenzt (Löschkonzept, Abschnitt 7). **Wiederherstellung wird geübt:** Termin, Protokoll, Ziel (RPO/RTO sind Entscheidung 10) – ein ungetestetes Backup gilt als nicht vorhanden. Vorschlag: Test vor dem ersten Echtbetrieb und danach vierteljährlich.
- **Betrieb/Bereitschaft:** Wer reagiert bei Ausfall, wer spielt Updates ein, wer beantwortet Datenschutzanfragen? Das ist Personalaufwand (Abschnitt 8) und eine offene Entscheidung (12).
- **Missbrauchsschutz:** Rate-Limits (Anmeldung, Push), Größenlimits, Quoten je Mandant.

## 7. Datenschutz

**Alles in diesem Abschnitt ist keine Rechtsberatung. [Annahme] auf Basis meines allgemeinen Wissens; vor Stufe 1 mit Datenschutzbeauftragten/Rechtsbeistand klären.**

### Welche personenbezogenen Daten fallen an
| Daten | Betroffene | Anmerkung |
|---|---|---|
| Arbeitszeiten, Pausen, Tätigkeiten, Fahrt-km | Mitarbeiter (Beschäftigtendaten) | besonders sensibel: Leistungs-/Verhaltenskontrolle, ggf. Mitbestimmung, Zweckbindung beachten |
| Name/Kontakt Auftraggeber, Adresse der Baustelle, Ansprechpartner, Telefon | Kunden, Dritte | Adresse einer Privatwohnung ist personenbezogen |
| Unterschriften (Bild) | Kunden | Unterschrift gilt als personenbezogen; nicht zweckfremd verwenden |
| Fotos | ggf. Personen, Kfz-Kennzeichen, Wohnräume | Fotos können Personen unbeabsichtigt zeigen; Hinweis in der App, Foto-Regeln des Betriebs |
| Konto: E-Mail, Name, Rolle, Geräte | Benutzer | Login-Daten, Gerätekennung |
| Technische Daten: IP, Zeitpunkte | alle | in Logs minimieren |

### Auftragsverarbeitung
- **[Annahme]** Der Betrieb ist **Verantwortlicher**; wer den Server für ihn betreibt, ist **Auftragsverarbeiter** (Art. 28 DSGVO) und braucht je Betrieb einen Auftragsverarbeitungsvertrag, technisch-organisatorische Maßnahmen (TOM), Verzeichnis der Verarbeitungstätigkeiten, Meldeweg bei Pannen (72-Stunden-Frist des Verantwortlichen) und Regelung zu Unterauftragnehmern (Hosting, E-Mail-Versand, ggf. Fehlerberichte).
- **Stufe-1-Sonderfall [Annahme, rechtlich prüfen]:** Betreibt der Mensch den Server nur für den **eigenen** Betrieb und die eigenen Daten, ist er selbst Verantwortlicher; die Auftragsverarbeiter-Rolle entfällt, aber Verträge mit dem Hoster (AVV) werden nötig. Mit Mitarbeitern kommen Pflichten ggü. Beschäftigten hinzu (Information, Zweckbindung).
- Mandantenfähigkeit auf Datenbankebene (Abschnitt 2) ist eine technische Maßnahme dafür.

### Löschkonzept
- **Baustelle löschen** (Kaskade) entfernt Datensätze, Löschvermerke (nach 180 Tagen), Blobs im Objektspeicher; der Server löscht die Binärdaten tatsächlich (nicht nur Markierung).
- **Benutzer entfernen:** Konto, Geräte, Tokens werden gelöscht; erfasste Arbeitszeiten verbleiben als Betriebsdaten (Verantwortlicher entscheidet über Anonymisierung).
- **Betrieb kündigen:** Export (Dateisicherung im bestehenden Format) und anschließend vollständige Löschung nach definierter Frist inkl. Backups (Backups laufen nach ihrer Aufbewahrungszeit aus; Zeit in der Dokumentation nennen).
- **Auskunft/Berichtigung/Löschung** betroffener Personen läuft über den Verantwortlichen; der Server braucht dafür Export und Löschfunktionen je Benutzer/Baustelle.
- Löschvermerke enthalten nur `tabelle`, `id`, Zeitpunkt – keine Inhalte.

### Aufbewahrung
Wie lange Stunden, Rechnungsgrundlagen (z. B. Regieberichte) und Fotos aufzubewahren sind, hängt von steuer-/handelsrechtlichen und vertraglichen Fristen ab **[Annahme: Fristen sind mit Steuerberater/Rechtsbeistand zu klären; ich nenne bewusst keine Zahlen]**. Die App darf nicht automatisch vor Ablauf löschen; Voreinstellung: keine automatische Löschung, nur auf Anweisung des Inhabers.

### Weitere Punkte
Transportverschlüsselung (TLS) überall; Verschlüsselung im Ruhezustand (Datenbank, Objektspeicher) **[Annahme: beim Anbieter Standardoption prüfen]**; Zugriffe von Betreibern auf Kundendaten nur protokolliert und nur zur Störungsbehebung; Datenschutz-Folgenabschätzung prüfen lassen (Beschäftigtendaten).

## 8. Kosten und Aufwand

**Alle Zahlen sind Schätzungen in Größenordnungen, keine Angebote.** Ich habe keine Anbieterpreise geprüft und nenne keine.

**Datenmenge (Rechenbeispiel, Schätzung):** Ein Betrieb mit 5 Mitarbeitern, je 10 Fotos pro Arbeitstag, 220 Arbeitstage, ca. 1 MB je Foto nach Verkleinerung → rund 11 GB pro Jahr. Alle Fachdaten (Stunden, Material, Notizen, Protokolle) zusammen liegen gegenüber den Fotos im Bereich weniger MB pro Monat. Datenbank bleibt klein; Objektspeicher dominiert.

**Laufende Kosten [Schätzung]:**
| Posten | Größenordnung |
|---|---|
| Server/Container für API-Dienst + Datenbank (klein, mit Backup) | zweistelliger bis niedriger dreistelliger Euro-Betrag pro Monat |
| Objektspeicher (einige 10 GB) und Datenverkehr | im Rahmen weniger Euro bis zweistelliger Betrag pro Monat; steigt mit Fotovolumen und Zugriffen |
| E-Mail-Versand (Anmelde-Codes) | gering, für wenige Betriebe oft im kostenlosen Rahmen eines Dienstes **[Annahme]** |
| Domain, Zertifikate | niedriger zweistelliger Betrag pro Jahr |
| Fertigdienst statt Eigenbetrieb | je nach Anbieter sehr unterschiedlich; nicht bewertet |
| Rechtliches (AVV-Vorlage, Datenschutzprüfung) | einmalig, je nach Hilfe von „Vorlage selbst“ bis „Anwalt“; Größenordnung vierstellig möglich |

**Entwicklungsaufwand [Schätzung, Personentage, einschließlich Tests, ohne Gewähr]:**
| Stufe | Inhalt | Aufwand |
|---|---|---|
| 1 | Ein Betrieb, ein/mehrere Geräte, Anmeldung, Sync Push/Pull, Fotos, Status | 25–40 PT |
| 2 | Mitarbeiter, Rollen, Einladungen, Rechtefilter, Zuweisung | 15–25 PT |
| 3 | Mehrere Betriebe, Betriebs-Verwaltung, Export/Löschung, Quoten | 15–30 PT |
| Betrieb | Updates, Monitoring, Backup-Test, Support | laufend, grob 2–8 Stunden/Monat bei kleinem Betrieb, deutlich mehr bei Störungen und fremden Kunden |

Größte Unsicherheit: iOS/Safari-Verhalten (Hintergrund, Speicher, Cookies) und der Aufwand der Client-Umbauten (4.10).

## 9. Stufenplan

| Stufe | Inhalt | Entscheidungspunkt danach |
|---|---|---|
| **0 (heute)** | Kein Backend. Abgleich per Datei (Auftrag C). | Reicht das? Wenn ja: Ende, Kosten null. |
| **1 – kleinster sinnvoller Schritt** | **Ein Betrieb, ein Inhaber, mehrere eigene Geräte.** Anmeldung, automatischer Abgleich der Daten, Foto-Upload, zentrale Sicherung, Sync-Status. Mandanten-ID und RLS sind von Anfang an im Schema (einziger Mandant), Rollen noch nicht. Kein Fremdkunde, daher keine Auftragsverarbeitung für Dritte **[Annahme]**. | Funktioniert der Abgleich im Alltag, auch unter iOS? Wollen Mitarbeiter mitarbeiten? |
| **2** | Mitarbeiter und Rollen, Einladungen, Rechtefilter, Baustellen-Zuweisung. | Nur der eigene Betrieb oder mehr? |
| **3** | Weitere Betriebe als Produkt: Auftragsverarbeitung, Preismodell, Verwaltung, Quoten, Export/Löschung, Support. | – |
| **später** | Feldweise Konflikte für Projekte/Protokolle, Büro-Webansicht, Benachrichtigungen. | – |

Stufe 1 enthält bewusst **nicht**: Rollen, Mehrbetrieb, Web-Oberfläche. Damit ist der Weg zu Stufe 2/3 offen (Mandantenfähigkeit im Schema), ohne sie zu bauen.

## 10. Offene Entscheidungen für den Menschen

Zur Übernahme in `TODO-MANUELL.md`. Empfehlung jeweils nach meiner Einschätzung; ich habe nichts davon entschieden.

1. **Backend ja oder nein?**
   - a) Kein Backend: Datei-Abgleich bleibt. b) Server nur für den eigenen Betrieb (Stufe 1–2). c) Mehrmandanten-Dienst für andere Betriebe (Stufe 3).
   - *Empfehlung:* a), solange nur eine Person mit zwei Geräten arbeitet; b), sobald Mitarbeiter mitarbeiten sollen oder Fotos/Datensicherung zum Problem werden. c) erst nach Erfahrung mit b) und rechtlicher Klärung.
2. **Eigenbau oder Fertigdienst für den Sync?**
   - a) Eigener API-Dienst nach `openapi.yaml`. b) Hosted-Sync/BaaS mit passender Region. c) Sync-Engine selbst betrieben.
   - *Empfehlung:* a), weil der Vertrag zum vorhandenen Datenmodell passt und die Rollen-Matrix frei bleibt; vorher b) auf EU-Region, Rollenfähigkeit und Auftragsverarbeitung prüfen **[nicht geprüft]**.
3. **Hosting-Anbieter und Region (EU).**
   - a) Europäischer Anbieter mit Sitz in der EU. b) Großer Cloud-Anbieter, EU-Region. c) Eigener Server beim Betrieb.
   - *Empfehlung:* a) wegen einfacherer Rechtslage **[Annahme]**; b) nur nach Prüfung der Drittlandfragen; c) nur mit Betriebs-Know-how.
4. **Betreibermodell und Haftung.** Wer betreibt, wer haftet, wer macht Support, mit oder ohne Gewerbe/Vertrag?
   - a) Privat/nur eigener Betrieb. b) Eigene Firma als Dienstleister mit AVV. c) Betrieb durch Dritten.
   - *Empfehlung:* a) für Stufe 1; b) mit Rechtsberatung, bevor ein Fremdbetrieb Daten ablegt.
5. **Authentifizierung.**
   - a) Einmalcode per E-Mail. b) Passwort. c) Passkey (mit Code als Rückfall). d) Einladungs-QR für Mitarbeiter.
   - *Empfehlung:* a) + d) zuerst, c) als Komfort; b) vermeiden.
6. **Konfliktauflösung.**
   - a) Datensatz-Ebene mit Server-Version (4.4). b) Feldweise für `projects` und `protocols`. c) Manuelle Konfliktansicht.
   - *Empfehlung:* a) für Stufe 1–2, weil die Versionsregel einfach und uhrenunabhängig ist; b) erst, wenn mehrere Personen dieselben Baustellen/Protokolle ändern. Zusätzlich: Anzeige und Umgang mit abgelehnten Änderungen (4.4) und Warnung bei falscher Uhr ja/nein.
7. **Rechte-Matrix.** Wer sieht wessen Stunden, wer darf löschen, gibt es Baustellen-Zuweisung?
   - a) Wie Abschnitt 3 (Mitarbeiter sieht nur eigene Stunden). b) Alle im Betrieb sehen alles. c) Zuweisung pro Baustelle plus a).
   - *Empfehlung:* a) mit Zuweisung ab Stufe 2; b) nur bei sehr kleinem, vertrautem Team und nach Datenschutzprüfung.
8. **Fotos: Auflösung, Verbleib, Quote.**
   - a) Wie heute (Verkleinerung), Vollbild bleibt lokal. b) Vollbild nach Upload lokal entfernbar, bei Bedarf nachladen. c) Nur Server-Originale.
   - *Empfehlung:* a) bis Speicherplatz auf Geräten Probleme macht; dann b). c) nicht (offline!).
9. **Aufbewahrung und Löschfristen.** Welche Fristen gelten für Stunden, Berichte, Fotos, Unterschriften? (Steuerberater/Rechtsbeistand fragen.)
   - a) Keine automatische Löschung. b) Löschung nach Frist je Datenart.
   - *Empfehlung:* a) bis Fristen geklärt sind.
10. **Backup-Ziele.** Wie viel Datenverlust (RPO) und Ausfall (RTO) sind vertretbar; wie oft wird die Wiederherstellung geübt?
    - a) Tägliche Sicherung, RPO ≈ 1 Tag, RTO ≈ 1 Tag. b) Punkt-in-Zeit-Wiederherstellung, RPO ≈ Minuten. c) Nur Dateisicherung durch Nutzer.
    - *Empfehlung:* b), vierteljährlicher Wiederherstellungstest; Werte sind **[Annahme]** und nach Anbieter zu prüfen.
11. **Fehlerberichte/Monitoring durch Drittdienste.**
    - a) Nur eigene Logs ohne personenbezogene Daten. b) Externer Dienst mit AVV, EU-Region.
    - *Empfehlung:* a) zum Start.
12. **Domain, Konten und Betrieb.** Eigene Domain (API und PWA unter derselben registrierbaren Domain für First-Party-Cookie)? Wer legt Konten (Hoster, Domain, E-Mail-Versand, GitHub-Secrets) an? Wer ist bei Ausfall erreichbar?
    - a) Eigene Domain, Mensch legt Konten an. b) Unterdomain der bisherigen Seite (GitHub Pages: Domain-Frage prüfen). c) Zugriff delegieren.
    - *Empfehlung:* a); Agenten legen nie Konten oder Zugangsdaten an.
13. **Geräteverlust.** Gerät serverseitig sperren (nur Sync stoppt, lokale Daten bleiben) – reicht das, oder wird Gerätesperre per Passcode/Betriebsvorgabe verlangt?
    - a) Sync-Sperre. b) Zusätzlich Hinweis auf Gerätesperre in der App. c) Mobilgeräteverwaltung beim Betrieb.
    - *Empfehlung:* a) + b).
14. **Erstabgleich bestehender Daten.** Welches Gerät liefert den Anfangsstand, wenn mehrere Geräte schon Daten haben?
    - a) Alle laden hoch (`baseVersion` 0), der Server-Stand gewinnt je `id` (4.4). b) Ein Gerät ist Quelle, andere werden überschrieben. c) Vorher Datei-Abgleich (Auftrag C).
    - *Empfehlung:* c), dann a).
15. **iOS-Verhalten prüfen (Test auf echten Geräten).** Hintergrund-Abgleich, Cookie-Lebensdauer in der installierten PWA, Speichergrenzen, Link-Anmeldung in der PWA. Ergebnis kann Entscheidungen 5 und 12 ändern.
    - *Empfehlung:* kleiner Test vor Stufe 1 (kein Serverbau nötig für Teile davon).
16. **Budget und Preismodell.** Wer trägt laufende Kosten (Abschnitt 8), und bei Stufe 3: Preis je Betrieb/Nutzer?
    - a) Selbst tragen. b) Abonnement je Betrieb. c) Einmalpreis.
    - *Empfehlung:* a) bis Stufe 2; b) erst bei c) aus Frage 1.
17. **Mitbestimmung/Information der Beschäftigten.** Zentrale Arbeitszeitdaten können Informations- und ggf. Mitbestimmungspflichten auslösen **[Annahme]**; wer klärt das?
    - a) Rechtsbeistand/Datenschutzbeauftragter. b) Selbst nach Merkblatt. 
    - *Empfehlung:* a) vor Stufe 2.
