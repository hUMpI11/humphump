## Arbeitsweise mit Subagents

Die Hauptsession plant, zerlegt und prüft. Umsetzung wird an Subagents delegiert:
- `ui-designer`: Design, Screens, Skizzenfunktion, iPhone/iPad-Layout
- `infra-connectivity`: Backend, Offline-Sync, Datei-Speicher, Deployment
- `security-auditor`: Review nach jedem größeren Feature und vor Releases (nur lesend)

Regeln:
1. Jede Delegation enthält Ziel, betroffene Dateien, Akzeptanzkriterien und was NICHT geändert werden darf.
2. Nach jedem größeren Feature läuft `security-auditor`. Kritische und hohe Befunde werden vor dem Weiterbauen behoben.
3. Offene Entscheidungen und manuelle Schritte für den Menschen werden in `TODO-MANUELL.md` gesammelt, nicht geraten.
4. Keine Secrets, Zugangsdaten oder echten Kundendaten im Repo.
