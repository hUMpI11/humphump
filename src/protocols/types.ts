/**
 * Vertrag der Protokoll-Engine. Vorlagen (templates.ts) beschreiben nur Daten;
 * Darstellung (views/ProtocolEditor.tsx, ProtocolPrint.tsx) und Rechnen (calc.ts)
 * kennen keine einzelne Vorlage. Neue Gewerke = neue Vorlage, kein neuer Code.
 */

export type CheckStatus = 'ok' | 'mangel' | 'na' | '';

/** Ergebnis eines Prüfpunkts: i. O. / Mangel / nicht zutreffend, plus Bemerkung. */
export interface CheckResult {
  status: CheckStatus;
  bemerkung: string;
}

export type CellValue = string | number | null;

/** Tabellenzeile; `_id` ist stabil (für React-Keys und Zusammenführen). */
export type Row = { _id: string } & Record<string, CellValue>;

export type FieldValue = string | number | null | CheckResult | Row[];

interface BaseField {
  /** Eindeutig innerhalb der ganzen Vorlage, [a-z][a-zA-Z0-9_]* */
  id: string;
  label: string;
  hint?: string;
}

export interface TextField extends BaseField {
  type: 'text' | 'longtext' | 'date';
}

export interface NumberField extends BaseField {
  type: 'number';
  unit?: string;
}

export interface SelectField extends BaseField {
  type: 'select';
  options: string[];
}

export interface CheckField extends BaseField {
  type: 'check';
}

export interface TableColumn {
  /** Eindeutig innerhalb der Tabelle, [a-z][a-zA-Z0-9_]* – in Formeln als Variable nutzbar. */
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'check';
  unit?: string;
  options?: string[];
  /**
   * Berechnete Spalte (nur type 'number'): Ausdruck über andere Spalten-ids derselben Zeile,
   * z. B. "l * b * anzahl - abzug". Erlaubt: Zahlen (Punkt als Dezimaltrenner), + - * / ( ), Spalten-ids.
   * Leere Zellen zählen als fehlend → Ergebnis null, außer die Spalte hat `default`.
   */
  formula?: string;
  /** Wert für leere Zahlzellen in Formeln (z. B. anzahl = 1, abzug = 0). */
  default?: number;
  /** Nachkommastellen für Anzeige/Runden berechneter Werte (Standard 2). */
  digits?: number;
}

export interface TableSummary {
  /** id einer Zahlspalte, die summiert wird */
  column: string;
  label: string;
  unit?: string;
}

export interface TableField extends BaseField {
  type: 'table';
  columns: TableColumn[];
  summary?: TableSummary[];
  /** Vorbelegte Zeilen beim Anlegen (z. B. feste Prüfpunkte). */
  presetRows?: Record<string, CellValue>[];
  /** Bezeichnung für „Zeile hinzufügen“, z. B. "Position" oder "Datenpunkt". */
  rowLabel?: string;
  /**
   * Die Tabelle lässt sich auf Knopfdruck aus den Stundeneinträgen (Stunden-Reiter) der Baustelle
   * für das Datum des Protokolls füllen. Einmalige Kopie – der Stunden-Reiter wird nie verändert.
   * `spalten` ordnet die Angaben den Spalten-ids dieser Tabelle zu.
   */
  quelle?: { art: 'zeiten'; spalten: { name: string; taetigkeit: string; stunden: string } };
}

export type Field = TextField | NumberField | SelectField | CheckField | TableField;

export interface Section {
  title: string;
  fields: Field[];
}

export interface Template {
  id: string;
  /** Bei inhaltlichen Änderungen erhöhen. */
  version: number;
  name: string;
  /** Gewerk-ids aus src/gewerke.ts oder '*' für alle. */
  gewerke: string[];
  beschreibung: string;
  sections: Section[];
}

/** Auswertung eines Protokolls für Listen und Druck. */
export interface ProtocolStats {
  ok: number;
  mangel: number;
  na: number;
  /** Prüfpunkte ohne Bewertung */
  offen: number;
}
