import { describe, expect, it } from 'vitest';
import { GEWERKE } from '../gewerke';
import { TEMPLATES, templateById, templatesFor } from './templates';
import type { Field, TableField, Template } from './types';

const ID = /^[a-z][a-zA-Z0-9_]*$/;
const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
const fields = (t: Template): Field[] => t.sections.flatMap((s) => s.fields);
const tables = (t: Template) => fields(t).filter((f): f is TableField => f.type === 'table');

describe('Vorlagen', () => {
  it('hat 12 bis 16 Vorlagen mit eindeutigen kebab-case-ids und gültiger Version', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(TEMPLATES.length).toBeLessThanOrEqual(16);
    expect(dupes(TEMPLATES.map((t) => t.id))).toEqual([]);
    for (const t of TEMPLATES) {
      expect(t.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(t.version).toBe(t.id === 'bautagesbericht' ? 2 : 1);
      expect(templateById(t.id)).toBe(t);
    }
  });

  it('jede Vorlage hat Name, Beschreibung, Abschnitt und Feld', () => {
    for (const t of TEMPLATES) {
      expect(t.name.trim()).not.toBe('');
      expect(t.beschreibung.trim()).not.toBe('');
      expect(t.sections.length).toBeGreaterThan(0);
      for (const s of t.sections) expect(s.fields.length, `${t.id}/${s.title}`).toBeGreaterThan(0);
      expect(fields(t).length).toBeGreaterThan(0);
    }
  });

  it('Feld- und Spalten-ids sind eindeutig und gültig', () => {
    for (const t of TEMPLATES) {
      const ids = fields(t).map((f) => f.id);
      expect(dupes(ids), t.id).toEqual([]);
      ids.forEach((id) => expect(id).toMatch(ID));
      for (const tb of tables(t)) {
        const cols = tb.columns.map((c) => c.id);
        expect(cols.length).toBeGreaterThan(0);
        expect(dupes(cols), `${t.id}/${tb.id}`).toEqual([]);
        cols.forEach((id) => expect(id).toMatch(ID));
      }
    }
  });

  it('gewerke sind * oder gültige ids', () => {
    const gueltig = new Set(GEWERKE.map((g) => g.id));
    for (const t of TEMPLATES) {
      expect(t.gewerke.length).toBeGreaterThan(0);
      for (const g of t.gewerke) expect(g === '*' || gueltig.has(g), `${t.id}: ${g}`).toBe(true);
    }
  });

  it('select hat mindestens zwei Optionen (Feld und Spalte)', () => {
    for (const t of TEMPLATES) {
      for (const f of fields(t)) if (f.type === 'select') expect(f.options.length).toBeGreaterThanOrEqual(2);
      for (const tb of tables(t))
        for (const c of tb.columns) if (c.type === 'select') expect(c.options?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('Formeln stehen an Zahlspalten und nutzen nur andere Zahlspalten derselben Tabelle', () => {
    let anzahl = 0;
    for (const t of TEMPLATES) {
      for (const tb of tables(t)) {
        const zahlen = new Set(tb.columns.filter((c) => c.type === 'number').map((c) => c.id));
        for (const c of tb.columns) {
          if (!c.formula) continue;
          anzahl++;
          expect(c.type, `${t.id}/${c.id}`).toBe('number');
          expect(c.formula).toMatch(/^[\sA-Za-z0-9_.+\-*/()]+$/);
          const bezeichner = c.formula.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
          expect(bezeichner.length).toBeGreaterThan(0);
          for (const b of bezeichner) {
            expect(zahlen.has(b), `${t.id}/${c.id}: ${b}`).toBe(true);
            expect(b).not.toBe(c.id);
          }
        }
      }
    }
    expect(anzahl).toBeGreaterThan(0);
  });

  it('summary-Spalten sind Zahlspalten, presetRows nutzen vorhandene Spalten', () => {
    for (const t of TEMPLATES) {
      for (const tb of tables(t)) {
        const cols = new Map(tb.columns.map((c) => [c.id, c]));
        for (const s of tb.summary ?? []) expect(cols.get(s.column)?.type, `${t.id}/${s.column}`).toBe('number');
        for (const row of tb.presetRows ?? []) for (const k of Object.keys(row)) expect(cols.has(k), `${t.id}: ${k}`).toBe(true);
      }
    }
  });

  it('Elektro und Sanitär tragen den Arbeitshilfe-Hinweis', () => {
    const betroffen = TEMPLATES.filter((t) => t.gewerke.some((g) => g === 'elektro' || g === 'sanitaer'));
    expect(betroffen.length).toBeGreaterThan(0);
    for (const t of betroffen) expect(t.beschreibung).toContain('Arbeitshilfe – ersetzt nicht das vorgeschriebene Prüfprotokoll');
  });

  it('Luftmengen-Abweichung entspricht der Vorgabe', () => {
    const tb = tables(templateById('lueftung-luftmengen')!)[0];
    expect(tb.columns.find((c) => c.id === 'abw')?.formula).toBe('(ist - soll) / soll * 100');
  });
});

describe('templatesFor', () => {
  it('liefert MSR vor allgemeinen, ohne Dubletten und ohne fremde Gewerke', () => {
    const r = templatesFor(['msr']);
    expect(dupes(r.map((t) => t.id))).toEqual([]);
    const ersteAllg = r.findIndex((t) => !t.gewerke.includes('msr'));
    expect(ersteAllg).toBeGreaterThan(0);
    expect(r.slice(0, ersteAllg).every((t) => t.gewerke.includes('msr'))).toBe(true);
    expect(r.slice(ersteAllg).every((t) => t.gewerke.includes('*'))).toBe(true);
    expect(r.some((t) => t.gewerke.includes('heizung'))).toBe(false);
  });

  it('ohne Gewerke nur allgemeine', () => {
    const r = templatesFor([]);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((t) => t.gewerke.includes('*'))).toBe(true);
  });

  it('Bautagesbericht (Version 2) hat die Tabelle Personal und Stunden mit Summe', () => {
    const t = templateById('bautagesbericht')!;
    const tb = tables(t).find((x) => x.id === 'personalStunden')!;
    expect(tb.rowLabel).toBe('Person');
    expect(tb.columns.map((c) => c.id)).toEqual(['name', 'taetigkeit', 'stunden']);
    expect(tb.columns[2]).toMatchObject({ type: 'number', unit: 'h' });
    expect(tb.summary).toEqual([{ column: 'stunden', label: 'Stunden gesamt', unit: 'h' }]);
    expect(fields(t).some((f) => f.id === 'personal')).toBe(true); // alte Werte bleiben lesbar
    expect(t.beschreibung).toMatch(/nicht in den Stunden-Reiter/);
  });
});
