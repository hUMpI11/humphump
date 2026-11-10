import type { CellValue, FieldValue, ProtocolStats, Row, TableColumn, TableField, Template } from './types';

// GERÜST – wird von Arbeitspaket „Protokoll-Engine“ implementiert. Signaturen bleiben stabil.

/** Wertet eine Formel für eine Zeile aus. Kein eval – eigener Parser. null bei fehlenden Werten, Division durch 0 oder Syntaxfehler. */
export function evaluate(_formula: string, _vars: Record<string, number | null>): number | null {
  return null;
}

/** Liefert die Zeile mit ausgerechneten Formelspalten (gerundet auf `digits`). Eingabespalten bleiben unverändert. */
export function computeRow(_columns: TableColumn[], row: Row): Row {
  return row;
}

/** Summen laut `field.summary`, in derselben Reihenfolge; fehlende/ungültige Zellen zählen 0. */
export function tableSummary(_field: TableField, _rows: Row[]): number[] {
  return [];
}

/** Zählt Prüfpunkte (check-Felder und check-Spalten in Tabellen). */
export function protocolStats(_template: Template, _values: Record<string, FieldValue>): ProtocolStats {
  return { ok: 0, mangel: 0, na: 0, offen: 0 };
}

/** Startwerte für ein neues Protokoll (presetRows mit `_id`, leere Felder). */
export function initialValues(_template: Template): Record<string, FieldValue> {
  return {};
}

export type { CellValue };
