// GERÜST – wird von Arbeitspaket „Geräteabgleich“ implementiert. Signaturen bleiben stabil.

export interface MergeResult {
  /** neu angelegte Datensätze */
  neu: number;
  /** durch neueren Stand ersetzte Datensätze */
  aktualisiert: number;
  /** unverändert gelassen, weil lokal neuer oder gleich */
  behalten: number;
  /** lokal gelöscht, weil die Sicherung einen neueren Löschvermerk enthält */
  geloescht: number;
}

type Rec = Record<string, unknown>;

/**
 * Reine Entscheidungslogik (ohne Datenbank, gut testbar):
 * Was passiert mit einem Datensatz, wenn lokal und/oder in der Sicherung ein Stand bzw. Löschvermerk existiert?
 * Zeitstempel eines Datensatzes = updatedAt ?? createdAt ?? 0.
 */
export function decide(_local: Rec | undefined, _incoming: Rec | undefined, _localDeletedAt: number | undefined, _incomingDeletedAt: number | undefined): 'anlegen' | 'ersetzen' | 'behalten' | 'loeschen' | 'nichts' {
  return 'nichts';
}

/** Führt die (bereits dekodierten) Tabellen einer Sicherung mit der lokalen Datenbank zusammen. */
export async function mergeTables(_tables: Record<string, Rec[]>): Promise<MergeResult> {
  return { neu: 0, aktualisiert: 0, behalten: 0, geloescht: 0 };
}
