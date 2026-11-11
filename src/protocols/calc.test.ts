import { describe, expect, it } from 'vitest';
import { computeRow, evaluate, initialValues, protocolStats, tableSummary } from './calc';
import type { Row, TableColumn, TableField, Template } from './types';

describe('evaluate', () => {
  it('Punkt vor Strich', () => {
    expect(evaluate('2 + 3 * 4', {})).toBe(14);
    expect(evaluate('10 - 6 / 3', {})).toBe(8);
  });
  it('Klammern und unäres Minus', () => {
    expect(evaluate('(2 + 3) * 4', {})).toBe(20);
    expect(evaluate('-(1 + 2) * -2', {})).toBe(6);
    expect(evaluate('3 - -2', {})).toBe(5);
  });
  it('Variablen und Dezimalpunkt', () => {
    expect(evaluate('l * b', { l: 2.5, b: 4 })).toBe(10);
    expect(evaluate('x1_a + 0.5', { x1_a: 1 })).toBe(1.5);
  });
  it('fehlende oder null-Variable ergibt null', () => {
    expect(evaluate('a + b', { a: 1 })).toBeNull();
    expect(evaluate('a + b', { a: 1, b: null })).toBeNull();
  });
  it('Division durch 0 ergibt null', () => {
    expect(evaluate('1 / 0', {})).toBeNull();
    expect(evaluate('1 / (a - a)', { a: 3 })).toBeNull();
  });
  it('kaputte Formeln ergeben null', () => {
    for (const f of ['', '2 +', '(1 + 2', '1 + 2)', '2 3', '* 2', '1 $ 2', '1..2 + 1', 'A + 1', 'constructor']) {
      expect(evaluate(f, { a: 1 }), f).toBeNull();
    }
  });
  it('nicht endliches Ergebnis ergibt null', () => {
    const big = '9'.repeat(200);
    expect(evaluate(`${big} * ${big} * ${big} * ${big}`, {})).toBeNull();
  });
});

const cols: TableColumn[] = [
  { id: 'l', label: 'Länge', type: 'number' },
  { id: 'b', label: 'Breite', type: 'number' },
  { id: 'anzahl', label: 'Anzahl', type: 'number', default: 1 },
  { id: 'abzug', label: 'Abzug', type: 'number', default: 0 },
  { id: 'flaeche', label: 'Fläche', type: 'number', formula: 'l * b * anzahl - abzug' },
  { id: 'netto', label: 'Netto', type: 'number', formula: 'flaeche * 2', digits: 1 },
];

describe('computeRow', () => {
  it('rechnet mit Defaults und Folgespalten', () => {
    const r = computeRow(cols, { _id: 'a', l: 2, b: 3, anzahl: null, abzug: '' });
    expect(r.flaeche).toBe(6);
    expect(r.netto).toBe(12);
  });
  it('liest Komma-Zahlen und rundet', () => {
    const r = computeRow(cols, { _id: 'a', l: '2,5', b: '1,333', anzahl: 1 });
    expect(r.flaeche).toBe(3.33);
    expect(r.netto).toBe(6.7);
  });
  it('fehlende Werte ergeben null, auch in Folgespalten', () => {
    const r = computeRow(cols, { _id: 'a', l: 2 });
    expect(r.flaeche).toBeNull();
    expect(r.netto).toBeNull();
  });
  it('mutiert die Eingabe nicht', () => {
    const row: Row = { _id: 'a', l: 1, b: 1 };
    const r = computeRow(cols, row);
    expect(row.flaeche).toBeUndefined();
    expect(r).not.toBe(row);
  });
});

const table: TableField = {
  id: 't',
  label: 'T',
  type: 'table',
  columns: cols,
  summary: [
    { column: 'flaeche', label: 'Summe' },
    { column: 'l', label: 'Länge' },
  ],
};

describe('tableSummary', () => {
  it('summiert, zählt Ungültiges als 0 und rundet auf 2 Stellen', () => {
    const rows: Row[] = [
      { _id: '1', flaeche: 1.005, l: '2,5' },
      { _id: '2', flaeche: null, l: 'abc' },
      { _id: '3', flaeche: 2.1, l: '' },
    ];
    expect(tableSummary(table, rows)).toEqual([3.11, 2.5]);
  });
  it('ohne summary leer', () => {
    expect(tableSummary({ ...table, summary: undefined }, [])).toEqual([]);
  });
});

const tpl: Template = {
  id: 'x',
  version: 1,
  name: 'X',
  gewerke: ['*'],
  beschreibung: '',
  sections: [
    {
      title: 'A',
      fields: [
        { id: 'c1', label: 'C1', type: 'check' },
        { id: 'c2', label: 'C2', type: 'check' },
        { id: 'c3', label: 'C3', type: 'check' },
        { id: 'n', label: 'N', type: 'number' },
        {
          id: 'tab',
          label: 'Tab',
          type: 'table',
          columns: [
            { id: 'name', label: 'Name', type: 'text' },
            { id: 'ok', label: 'OK', type: 'check' },
          ],
          presetRows: [{ name: 'a' }, { name: 'b' }],
        },
      ],
    },
  ],
};

describe('protocolStats', () => {
  it('zählt Felder und Tabellenspalten', () => {
    const v = initialValues(tpl);
    v.c1 = { status: 'ok', bemerkung: '' };
    v.c2 = { status: 'mangel', bemerkung: 'x' };
    (v.tab as Row[])[0].ok = 'na';
    (v.tab as Row[])[1].ok = 'mangel';
    expect(protocolStats(tpl, v)).toEqual({ ok: 1, mangel: 2, na: 1, offen: 1 });
  });
  it('fehlende Werte zählen als offen', () => {
    expect(protocolStats(tpl, {})).toEqual({ ok: 0, mangel: 0, na: 0, offen: 3 });
  });
});

describe('initialValues', () => {
  it('belegt je Feldtyp vor, Zeilen mit eindeutiger _id', () => {
    const v = initialValues(tpl);
    expect(v.c1).toEqual({ status: '', bemerkung: '' });
    expect(v.n).toBeNull();
    const rows = v.tab as Row[];
    expect(rows).toHaveLength(2);
    expect(rows[0]._id).not.toBe(rows[1]._id);
    expect(rows[0]).toMatchObject({ name: 'a', ok: '' });
  });
  it('Tabelle ohne Vorbelegung ist leer, Text ist leerer String', () => {
    const t: Template = { ...tpl, sections: [{ title: 'S', fields: [{ id: 'x', label: 'x', type: 'text' }, { ...table }] }] };
    const v = initialValues(t);
    expect(v.x).toBe('');
    expect(v.t).toEqual([]);
  });
});
