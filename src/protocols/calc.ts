import { uid } from '../lib/util';
import type { CellValue, CheckResult, Field, FieldValue, ProtocolStats, Row, TableColumn, TableField, Template } from './types';

type Token = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Token[] | null {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)/.exec(src.slice(i));
      if (!m) return null;
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-z]/.test(c)) {
      const m = /^[a-z][a-zA-Z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0] });
      i += m[0].length;
    } else if ('+-*/()'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else {
      return null;
    }
  }
  return out;
}

/** Intern bei Syntaxfehler, fehlender Variable oder Division durch 0; evaluate() macht daraus null. */
class CalcError extends Error {}

/** Wertet eine Formel für eine Zeile aus. Kein eval – eigener Parser. null bei fehlenden Werten, Division durch 0 oder Syntaxfehler. */
export function evaluate(formula: string, vars: Record<string, number | null>): number | null {
  const tokens = tokenize(formula);
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;
  const isOp = (v: string) => tokens[pos]?.t === 'op' && tokens[pos].v === v;

  // expr = term (('+'|'-') term)* ; term = unary (('*'|'/') unary)* ; unary = '-' unary | primary
  function expr(): number {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens![pos++].v;
      const b = term();
      a = op === '+' ? a + b : a - b;
    }
    return a;
  }
  function term(): number {
    let a = unary();
    while (isOp('*') || isOp('/')) {
      const op = tokens![pos++].v;
      const b = unary();
      if (op === '/' && b === 0) throw new CalcError();
      a = op === '*' ? a * b : a / b;
    }
    return a;
  }
  function unary(): number {
    if (isOp('-')) {
      pos++;
      return -unary();
    }
    return primary();
  }
  function primary(): number {
    const tok = tokens![pos++];
    if (!tok) throw new CalcError();
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'id') {
      const v = Object.prototype.hasOwnProperty.call(vars, tok.v) ? vars[tok.v] : null;
      if (v === null || v === undefined || !Number.isFinite(v)) throw new CalcError();
      return v;
    }
    if (tok.v === '(') {
      const v = expr();
      if (!isOp(')')) throw new CalcError();
      pos++;
      return v;
    }
    throw new CalcError();
  }

  try {
    const result = expr();
    if (pos !== tokens.length) return null;
    return Number.isFinite(result) ? result : null;
  } catch (e) {
    if (e instanceof CalcError) return null;
    throw e;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Macht aus beliebigen gespeicherten Werten eine sichere Zeilenliste: Einträge, die keine Zeile sind (null, Zahl, Liste),
 * entfallen; Zellen, die weder Text noch endliche Zahl noch null sind, werden zu null; fehlende `_id` wird ersetzt.
 * Daten aus Sicherungen oder direkt in die Datenbank geschriebene Werte dürfen die Darstellung nie zum Absturz bringen.
 */
export function cleanRows(v: unknown): Row[] {
  if (!Array.isArray(v)) return [];
  const out: Row[] = [];
  v.forEach((r, i) => {
    if (!isObj(r)) return;
    const row: Row = { _id: typeof r._id === 'string' && r._id ? r._id : `zeile-${i}` };
    for (const [k, c] of Object.entries(r)) {
      if (k === '_id') continue;
      row[k] = typeof c === 'string' || (typeof c === 'number' && Number.isFinite(c)) ? c : null;
    }
    out.push(row);
  });
  return out;
}

/** Werte eines Protokolls als Objekt; alles andere zählt als leer. */
export function cleanValues(v: unknown): Record<string, FieldValue> {
  return isObj(v) ? (v as Record<string, FieldValue>) : {};
}

/** Zellwert als Zahl lesen; leer oder keine Zahl → null. Akzeptiert „2,5“. */
function cellNumber(v: CellValue | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f;
}

/** Liefert die Zeile mit ausgerechneten Formelspalten (gerundet auf `digits`). Eingabespalten bleiben unverändert. */
export function computeRow(columns: TableColumn[], row: Row): Row {
  const out: Row = { ...(isObj(row) ? row : { _id: '' }) };
  const vars: Record<string, number | null> = {};
  for (const col of columns) {
    if (col.type !== 'number') continue;
    if (col.formula) {
      const r = evaluate(col.formula, vars);
      const v = r === null ? null : round(r, col.digits ?? 2);
      out[col.id] = v;
      vars[col.id] = v;
    } else {
      vars[col.id] = cellNumber(out[col.id]) ?? col.default ?? null;
    }
  }
  return out;
}

/** Summen laut `field.summary`, in derselben Reihenfolge; fehlende/ungültige Zellen zählen 0. */
export function tableSummary(field: TableField, rows: Row[]): number[] {
  return (field.summary ?? []).map((s) => round(cleanRows(rows).reduce((sum, r) => sum + (cellNumber(r[s.column]) ?? 0), 0), 2));
}

function isCheckResult(v: unknown): v is CheckResult {
  return isObj(v) && 'status' in v;
}

/** Zählt Prüfpunkte (check-Felder und check-Spalten in Tabellen). */
export function protocolStats(template: Template, values: Record<string, FieldValue>): ProtocolStats {
  const s: ProtocolStats = { ok: 0, mangel: 0, na: 0, offen: 0 };
  const count = (status: unknown) => {
    if (status === 'ok') s.ok++;
    else if (status === 'mangel') s.mangel++;
    else if (status === 'na') s.na++;
    else s.offen++;
  };
  const vals = cleanValues(values);
  for (const sec of template.sections) {
    for (const f of sec.fields) {
      const v = vals[f.id];
      if (f.type === 'check') {
        count(isCheckResult(v) ? v.status : '');
      } else if (f.type === 'table') {
        const checkCols = f.columns.filter((c) => c.type === 'check');
        if (checkCols.length === 0 || !Array.isArray(v)) continue;
        for (const row of cleanRows(v)) for (const c of checkCols) count(row[c.id]);
      }
    }
  }
  return s;
}

/** Startwert eines einzelnen Feldes (auch für Felder, die eine ältere Fassung noch nicht kannte). */
export function initialValue(field: Field): FieldValue {
  switch (field.type) {
    case 'check':
      return { status: '', bemerkung: '' };
    case 'number':
      return null;
    case 'table':
      return (field.presetRows ?? []).map((p) => {
        const row: Row = { _id: uid(), ...p };
        for (const c of field.columns) if (c.type === 'check' && row[c.id] === undefined) row[c.id] = '';
        return computeRow(field.columns, row);
      });
    default:
      return '';
  }
}

/** Startwerte für ein neues Protokoll (presetRows mit `_id`, leere Felder). */
export function initialValues(template: Template): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const sec of template.sections) for (const f of sec.fields) values[f.id] = initialValue(f);
  return values;
}

export type { CellValue };
