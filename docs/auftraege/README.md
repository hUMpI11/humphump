# Aufträge an die Subagents (Ausbaustufe 0.2)

Jede Datei ist ein vollständiger Auftrag nach `CLAUDE.md` Regel 1: Ziel, betroffene Dateien, Akzeptanzkriterien, Tabus.
Die Hauptsession hat das Gerüst angelegt (Schema, Vertragstypen, Routen, leere Module) und führt die Ergebnisse zusammen.

| Auftrag | Subagent | Inhalt |
|---|---|---|
| [A](A-protokoll-engine.md) | ui-designer | Protokoll-Engine: Rechnen, Ausfüllen, Liste, Druck |
| [B](B-vorlagen.md) | ui-designer | Protokollvorlagen je Gewerk |
| [C](C-geraeteabgleich.md) | infra-connectivity | Änderungsverfolgung und Zusammenführen (Sync-Grundlage) |
| [D](D-browser-tests.md) | infra-connectivity | Browser-Tests im Repo und in der CI |
| [E](E-backend-entwurf.md) | infra-connectivity | Backend-Entwurf und API-Vertrag (nur Dokumente) |
| danach | security-auditor | Review des zusammengeführten Stands (erledigt: kein kritischer/hoher Befund am Code) |
| [F](F-einspielen-haerten.md) | infra-connectivity | Folge aus dem Review: Einspielen härten |
| [G](G-datenschutz-ui.md) | ui-designer | Folge aus dem Review: Datenschutz-Hinweise, Alle Daten löschen, Notausgang, CSP |

## Für alle Aufträge gilt

- Stack: Vite, React 19, TypeScript strict, Dexie 4 (IndexedDB), Vitest, Playwright. Keine neuen Abhängigkeiten ohne Begründung im Abschlussbericht.
- Zuerst lesen: `docs/ARCHITEKTUR.md`, dann den eigenen Auftrag. Dann `npm ci`.
- Nur die im Auftrag genannten Dateien anfassen. Andere Agents arbeiten gleichzeitig an den übrigen. Fehlt etwas an einer fremden Datei oder am Vertrag: im Abschlussbericht vorschlagen, nicht selbst ändern.
- UI-Texte auf Deutsch mit echten Umlauten. Kommentare knapp und nur zum Warum.
- Keine Secrets, Zugangsdaten oder echten Kundendaten. Offene Entscheidungen für den Menschen nicht raten, sondern im Abschlussbericht unter „Für TODO-MANUELL“ auflisten.
- Prüfen vor Abschluss: `npx tsc --noEmit`, `npm test`, `npm run build` grün. Browser-Prüfung mit dem vorinstallierten Playwright (`require('playwright')`, `chromium.launch()` ohne Optionen; **kein** `playwright install`). Eigene Wegwerf-Skripte nicht ins Repo legen; gestartete Server am Ende beenden.
- Abschluss: nur die eigenen Dateien `git add`, **ein** Commit auf dem aktuellen Branch des eigenen Arbeitsbaums mit der im Auftrag genannten Nachricht. Nicht pushen, keinen Pull Request anlegen.
- Abschlussbericht (kurz): Branch + Commit-Hash, was umgesetzt ist, was tatsächlich im Browser nachgewiesen wurde, bekannte Lücken ehrlich, Vorschläge zum Vertrag, Punkte für TODO-MANUELL.
