import type { Protocol } from '../db';
import { fmtDate, fmtNumber } from '../lib/util';
import type { CellValue, CheckResult, Field, Row, TableColumn, TableField, Template } from './types';
import { tableSummary } from './calc';
import './protocols.css';

const STATUS: Record<string, string> = { ok: 'i. O.', mangel: 'Mangel', na: 'n. z.', '': 'offen' };

const isEmpty = (v: CellValue | undefined) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

function num(v: CellValue | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function cellText(col: TableColumn, v: CellValue | undefined): string {
  if (isEmpty(v)) return '';
  if (col.type === 'check') return STATUS[String(v)] ?? String(v);
  if (col.type === 'number') {
    const n = num(v);
    return n === null ? String(v) : fmtNumber(n, col.digits ?? 2);
  }
  return String(v);
}

function PrintTable({ field, rows, hideTitle }: { field: TableField; rows: Row[]; hideTitle?: boolean }) {
  const cols = field.columns;
  const shown = rows.filter((r) => cols.some((c) => !isEmpty(r[c.id])));
  if (shown.length === 0) return null;
  const sums = tableSummary(field, shown);
  return (
    <>
      {!hideTitle && <h3>{field.label}</h3>}
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.id} className={c.type === 'number' ? 'r' : undefined}>
                {c.unit ? `${c.label} (${c.unit})` : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r._id}>
              {cols.map((c) => (
                <td key={c.id} className={[c.type === 'number' ? 'r' : '', r[c.id] === 'mangel' ? 'mangel' : ''].join(' ').trim() || undefined}>
                  {cellText(c, r[c.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {(field.summary?.length ?? 0) > 0 && (
          <tfoot>
            {field.summary!.map((s, i) => {
              const idx = cols.findIndex((c) => c.id === s.column);
              const value = `${fmtNumber(sums[i], 2)}${s.unit ? ` ${s.unit}` : ''}`;
              if (idx <= 0) {
                return (
                  <tr key={s.column + i}>
                    <td className="r" colSpan={cols.length}>
                      {s.label}: {value}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={s.column + i}>
                  <td colSpan={idx}>{s.label}</td>
                  <td className="r">{value}</td>
                  {idx < cols.length - 1 && <td colSpan={cols.length - idx - 1} />}
                </tr>
              );
            })}
          </tfoot>
        )}
      </table>
    </>
  );
}

/** Druckansicht eines Protokolls innerhalb des Berichts (<section> mit <h2>, Tabellen wie im restlichen Bericht). */
export function ProtocolPrint({ template, protocol }: { template: Template; protocol: Protocol }) {
  const values = protocol.values ?? {};
  const fieldsOf = (fields: Field[]) => ({
    facts: fields.filter((f) => f.type !== 'check' && f.type !== 'table'),
    checks: fields.filter((f) => f.type === 'check'),
    tables: fields.filter((f): f is TableField => f.type === 'table'),
  });

  return (
    <section className="proto-print">
      <h2>
        {template.name}
        {protocol.titel ? ` – ${protocol.titel}` : ''} ({fmtDate(protocol.datum, false)})
      </h2>
      {template.sections.map((sec) => {
        const { facts, checks, tables } = fieldsOf(sec.fields);
        const factRows = facts.flatMap((f) => {
          const v = values[f.id];
          if (v === null || v === undefined || v === '' || typeof v === 'object') return [];
          let text = String(v);
          if (f.type === 'number' && typeof v === 'number') text = `${fmtNumber(v, 3)}${f.unit ? ` ${f.unit}` : ''}`;
          else if (f.type === 'date') text = fmtDate(text, false);
          return [{ f, text }];
        });
        const tableNodes = tables.map((t) => {
          const rows = values[t.id];
          return Array.isArray(rows) ? <PrintTable key={t.id} field={t} rows={rows} hideTitle={sec.fields.length === 1 && sec.title === t.label} /> : null;
        });
        const hasTables = tables.some((t) => {
          const rows = values[t.id];
          return Array.isArray(rows) && rows.some((r) => t.columns.some((c) => !isEmpty(r[c.id])));
        });
        if (factRows.length === 0 && checks.length === 0 && !hasTables) return null;
        return (
          <div key={sec.title}>
            {sec.title && <h3>{sec.title}</h3>}
            {factRows.length > 0 && (
              <dl className="facts">
                {factRows.map(({ f, text }) => (
                  <div key={f.id} style={{ display: 'contents' }}>
                    <dt>{f.label}</dt>
                    <dd className="pre">{text}</dd>
                  </div>
                ))}
              </dl>
            )}
            {checks.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Prüfpunkt</th>
                    <th>Ergebnis</th>
                    <th>Bemerkung</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((f) => {
                    const v = values[f.id] as CheckResult | undefined;
                    const status = v && typeof v === 'object' && 'status' in v ? v.status : '';
                    return (
                      <tr key={f.id}>
                        <td>{f.label}</td>
                        <td className={status === 'mangel' ? 'mangel nw' : 'nw'}>{STATUS[status] ?? status}</td>
                        <td className="pre">{v && typeof v === 'object' && 'bemerkung' in v ? v.bemerkung : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {tableNodes}
          </div>
        );
      })}
    </section>
  );
}
