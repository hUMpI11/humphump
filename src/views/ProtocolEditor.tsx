import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { db, touchProject } from '../db';
import { go } from '../lib/router';
import { isoDate, fmtNumber, parseDecimal, uid } from '../lib/util';
import { Empty, Field as FormField, Header } from '../components/ui';
import { computeRow, initialValue, protocolStats, tableSummary } from '../protocols/calc';
import { templateById } from '../protocols/templates';
import type { CellValue, CheckResult, CheckStatus, Field, FieldValue, Row, TableColumn, TableField, Template } from '../protocols/types';
import '../protocols/protocols.css';

interface Doc {
  titel: string;
  datum: string;
  values: Record<string, FieldValue>;
  abgeschlossen: boolean;
}

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

/** Fehlende Felder mit Startwert ergänzen; Felder, die die Vorlage nicht kennt, bleiben unberührt gespeichert, werden aber nicht angezeigt. */
function normalize(template: Template, values: Record<string, FieldValue> | undefined): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = { ...(values ?? {}) };
  for (const sec of template.sections) {
    for (const f of sec.fields) {
      const v = out[f.id];
      const fits =
        v !== undefined &&
        (f.type === 'table' ? Array.isArray(v) : f.type === 'check' ? typeof v === 'object' && v !== null && !Array.isArray(v) : !(typeof v === 'object' && v !== null));
      if (!fits) out[f.id] = initialValue(f);
    }
  }
  return out;
}

export default function ProtocolEditor({ projectId, protocolId }: { projectId: string; protocolId: string }) {
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [templateId, setTemplateId] = useState('');
  const [doc, setDoc] = useState<Doc | null>(null);
  const [save, setSave] = useState<SaveState>('clean');
  const docRef = useRef<Doc | null>(null);
  const dirty = useRef(false);
  const gone = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    db.protocols.get(protocolId).then((p) => {
      if (!alive) return;
      if (!p || p.projectId !== projectId) return setState('missing');
      setTemplateId(p.templateId);
      const t = templateById(p.templateId);
      const d: Doc = { titel: p.titel, datum: p.datum, values: t ? normalize(t, p.values) : (p.values ?? {}), abgeschlossen: p.abgeschlossen };
      docRef.current = d;
      setDoc(d);
      setState('ready');
    });
    return () => {
      alive = false;
    };
  }, [projectId, protocolId]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const d = docRef.current;
    if (!d || !dirty.current || gone.current) return;
    dirty.current = false;
    setSave('saving');
    try {
      await db.protocols.update(protocolId, { titel: d.titel, datum: d.datum, values: d.values, abgeschlossen: d.abgeschlossen, updatedAt: Date.now() });
      await touchProject(projectId);
      setSave(dirty.current ? 'dirty' : 'saved');
    } catch {
      dirty.current = true;
      setSave('error');
    }
  }, [protocolId, projectId]);

  const change = useCallback(
    (fn: (d: Doc) => Doc, immediate = false) => {
      if (!docRef.current) return;
      const next = fn(docRef.current);
      docRef.current = next;
      setDoc(next);
      dirty.current = true;
      setSave('dirty');
      window.clearTimeout(timer.current);
      if (immediate) void flush();
      else timer.current = window.setTimeout(() => void flush(), 600);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide as () => void);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide as () => void);
      void flush();
    };
  }, [flush]);

  const back = `/p/${projectId}/protokolle`;
  const template = templateById(templateId);

  if (state === 'loading') return <Header title="Protokoll" back={back} />;
  if (state === 'missing')
    return (
      <>
        <Header title="Protokoll" back={back} />
        <div className="scroll page">
          <Empty icon="clipboard" title="Protokoll nicht gefunden" text="Es wurde gelöscht oder gehört zu einer anderen Baustelle." />
        </div>
      </>
    );
  if (!template || !doc)
    return (
      <>
        <Header title="Protokoll" back={back} />
        <div className="scroll page">
          <Empty icon="clipboard" title="Vorlage unbekannt" text="Die Vorlage dieses Protokolls ist in dieser App-Version nicht vorhanden. Die Daten bleiben gespeichert." />
        </div>
      </>
    );

  const setValue = (id: string, v: FieldValue) => change((d) => ({ ...d, values: { ...d.values, [id]: v } }));
  const stats = protocolStats(template, doc.values);
  const total = stats.ok + stats.mangel + stats.na + stats.offen;
  const saveText = { clean: '', dirty: 'Nicht gespeichert …', saving: 'Speichert …', saved: 'Gespeichert', error: 'Speichern fehlgeschlagen' }[save];

  async function remove() {
    if (!window.confirm('Protokoll wirklich löschen?')) return;
    gone.current = true;
    window.clearTimeout(timer.current);
    await db.protocols.delete(protocolId);
    await touchProject(projectId);
    go(back);
  }

  return (
    <>
      <Header title={template.name} subtitle={doc.abgeschlossen ? 'Abgeschlossen' : saveText || undefined} back={back} />
      <div className="scroll page">
        <div className="proto-form">
          <fieldset disabled={doc.abgeschlossen}>
            <div className="card block">
              <FormField label="Titel">
                <input value={doc.titel} onChange={(e) => change((d) => ({ ...d, titel: e.target.value }))} placeholder="z. B. Erdgeschoss, Wohnung 3" />
              </FormField>
              <FormField label="Datum">
                <input type="date" value={doc.datum} onChange={(e) => change((d) => ({ ...d, datum: e.target.value || isoDate() }))} />
              </FormField>
            </div>

            {template.sections.map((sec, i) => (
              <section key={i} className="proto-section card block">
                {sec.title && <h2>{sec.title}</h2>}
                {sec.fields.map((f) => (
                  <FieldView key={f.id} field={f} value={doc.values[f.id]} onChange={(v) => setValue(f.id, v)} hideTitle={sec.fields.length === 1 && sec.title === f.label} />
                ))}
              </section>
            ))}
          </fieldset>

          <div className="proto-footer">
            {total > 0 && (
              <div className="chips" aria-label="Auswertung der Prüfpunkte">
                <span className="chip">{stats.ok} i. O.</span>
                <span className={stats.mangel > 0 ? 'chip warn' : 'chip'}>{stats.mangel === 1 ? '1 Mangel' : `${stats.mangel} Mängel`}</span>
                <span className="chip">{stats.na} n. z.</span>
                <span className="chip">{stats.offen} offen</span>
              </div>
            )}
            {doc.abgeschlossen ? (
              <button type="button" className="btn" onClick={() => change((d) => ({ ...d, abgeschlossen: false }), true)}>
                Wieder öffnen
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={() => change((d) => ({ ...d, abgeschlossen: true }), true)}>
                Protokoll abschließen
              </button>
            )}
            <button type="button" className="btn danger" onClick={remove}>
              Protokoll löschen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Eingabe-Bausteine ---------- */

/** Zahlenfeld mit Textzustand, damit „2,“ beim Tippen nicht zu „2“ wird; liefert Zahl oder null. */
function NumInput({ value, onChange, label }: { value: CellValue | undefined; onChange: (v: number | null) => void; label: string }) {
  const toText = (v: CellValue | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(toText(value));
  useEffect(() => {
    const cur = text.trim() === '' ? null : parseDecimal(text);
    const val = typeof value === 'string' ? (value.trim() === '' ? null : parseDecimal(value)) : (value ?? null);
    if (cur !== val && !(Number.isNaN(cur) && val === null)) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const t = e.target.value.trim();
        const n = t === '' ? null : parseDecimal(t);
        onChange(n === null || Number.isNaN(n) ? null : n);
      }}
    />
  );
}

function Choice({ value, onChange, label, small }: { value: CheckStatus; onChange: (s: CheckStatus) => void; label: string; small?: boolean }) {
  const opts: [CheckStatus, string][] = [
    ['ok', 'i. O.'],
    ['mangel', 'Mangel'],
    ['na', 'n. z.'],
  ];
  return (
    <div className={small ? 'proto-choice small' : 'proto-choice'} role="group" aria-label={label}>
      {opts.map(([s, t]) => (
        <button key={s} type="button" className={s === 'mangel' ? 'is-mangel' : ''} aria-pressed={value === s} onClick={() => onChange(value === s ? '' : s)}>
          {t}
        </button>
      ))}
    </div>
  );
}

function FieldView({ field, value, onChange, hideTitle }: { field: Field; value: FieldValue | undefined; onChange: (v: FieldValue) => void; hideTitle?: boolean }) {
  switch (field.type) {
    case 'text':
      return (
        <FormField label={field.label} hint={field.hint}>
          <input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </FormField>
      );
    case 'longtext':
      return (
        <FormField label={field.label} hint={field.hint}>
          <textarea rows={4} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </FormField>
      );
    case 'date':
      return (
        <FormField label={field.label} hint={field.hint}>
          <input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </FormField>
      );
    case 'number':
      return (
        <FormField label={field.label} hint={field.hint}>
          <span className="proto-input-unit">
            <NumInput label={field.unit ? `${field.label} in ${field.unit}` : field.label} value={value as number | null} onChange={onChange} />
            {field.unit && <span aria-hidden="true">{field.unit}</span>}
          </span>
        </FormField>
      );
    case 'select':
      return (
        <FormField label={field.label} hint={field.hint}>
          <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">– wählen –</option>
            {field.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </FormField>
      );
    case 'check': {
      const v = (value as CheckResult | undefined) ?? { status: '', bemerkung: '' };
      return (
        <div className="proto-check">
          <span className="proto-check-name">{field.label}</span>
          {field.hint && <span className="field-hint">{field.hint}</span>}
          <Choice label={field.label} value={v.status} onChange={(status) => onChange({ ...v, status })} />
          {(v.status === 'mangel' || v.bemerkung) && (
            <input aria-label={`Bemerkung zu ${field.label}`} placeholder="Bemerkung zum Mangel" value={v.bemerkung} onChange={(e) => onChange({ ...v, bemerkung: e.target.value })} />
          )}
        </div>
      );
    }
    case 'table':
      return <TableView field={field} rows={Array.isArray(value) ? value : []} onChange={onChange} hideTitle={hideTitle} />;
  }
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function TableView({ field, rows, onChange, hideTitle }: { field: TableField; rows: Row[]; onChange: (v: FieldValue) => void; hideTitle?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const wide = width >= 700;
  const cols = field.columns;
  const rowLabel = field.rowLabel ?? 'Zeile';
  const sums = tableSummary(field, rows);

  const setCell = (rowId: string, col: TableColumn, v: CellValue) =>
    onChange(rows.map((r) => (r._id === rowId ? computeRow(cols, { ...r, [col.id]: v }) : r)));
  const add = () => {
    const row: Row = { _id: uid() };
    for (const c of cols) row[c.id] = c.type === 'number' ? null : '';
    onChange([...rows, computeRow(cols, row)]);
  };
  const del = (i: number) => window.confirm(`${rowLabel} ${i + 1} wirklich löschen?`) && onChange(rows.filter((_, k) => k !== i));

  const colLabel = (c: TableColumn) => (c.unit ? `${c.label} (${c.unit})` : c.label);

  const cell = (c: TableColumn, r: Row, i: number) => {
    const aria = `${colLabel(c)}, ${rowLabel} ${i + 1}`;
    if (c.type === 'number' && c.formula) {
      const v = r[c.id];
      return (
        <output className="proto-calc" aria-label={`${aria}, berechnet`}>
          {typeof v === 'number' ? fmtNumber(v, c.digits ?? 2) : '–'}
        </output>
      );
    }
    if (c.type === 'number') return <NumInput label={aria} value={r[c.id]} onChange={(v) => setCell(r._id, c, v)} />;
    if (c.type === 'select')
      return (
        <select aria-label={aria} value={String(r[c.id] ?? '')} onChange={(e) => setCell(r._id, c, e.target.value)}>
          <option value="">–</option>
          {(c.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    if (c.type === 'check') return <Choice small label={aria} value={(r[c.id] as CheckStatus) || ''} onChange={(s) => setCell(r._id, c, s)} />;
    return <input aria-label={aria} value={String(r[c.id] ?? '')} onChange={(e) => setCell(r._id, c, e.target.value)} />;
  };

  return (
    <div className="proto-table" ref={ref}>
      {!hideTitle && <h3>{field.label}</h3>}
      {field.hint && <span className="field-hint">{field.hint}</span>}
      {wide && rows.length > 0 ? (
        <div className="proto-grid-wrap">
          <table className="proto-grid">
            <thead>
              <tr>
                <th scope="col">Nr.</th>
                {cols.map((c) => (
                  <th key={c.id} scope="col">
                    {colLabel(c)}
                  </th>
                ))}
                <th scope="col">
                  <span className="proto-sr">Aktion</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r._id}>
                  <td className="narrow">{i + 1}</td>
                  {cols.map((c) => (
                    <td key={c.id}>{cell(c, r, i)}</td>
                  ))}
                  <td className="narrow">
                    <button type="button" className="link proto-del" onClick={() => del(i)} aria-label={`${rowLabel} ${i + 1} löschen`}>
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        rows.map((r, i) => (
          <div key={r._id} className="card proto-rowcard">
            <div className="proto-rowhead">
              <strong>
                {rowLabel} {i + 1}
              </strong>
              <button type="button" className="link" onClick={() => del(i)} aria-label={`${rowLabel} ${i + 1} löschen`}>
                Löschen
              </button>
            </div>
            <div className="proto-cells">
              {cols.map((c) => (
                <div key={c.id} className={c.type === 'text' || c.type === 'check' ? 'field wide' : 'field'}>
                  <span className="field-label">{colLabel(c)}</span>
                  {cell(c, r, i)}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      {rows.length === 0 && <p className="muted">Noch keine Einträge.</p>}
      <button type="button" className="btn proto-add" onClick={add}>
        + {rowLabel}
      </button>
      {(field.summary?.length ?? 0) > 0 && rows.length > 0 && (
        <div className="card proto-sums" aria-live="polite">
          {field.summary!.map((s, i) => (
            <div key={s.column + i}>
              <span>{s.label}</span>
              <span className="num">
                {fmtNumber(sums[i], 2)}
                {s.unit ? ` ${s.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
