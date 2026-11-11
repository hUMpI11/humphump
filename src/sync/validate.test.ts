import { describe, expect, it } from 'vitest';
import { limitTimestamp, sanitize, validateProfil, validateRecord, validateTombstone } from './validate';

const NOW = 1_700_000_000_000;
const TOLERANZ = 5 * 60 * 1000;

const projekt = (o: Record<string, unknown> = {}) => ({
  id: 'p1', name: 'Bad Huber', kunde: '', adresse: '', auftragsnr: '', gewerke: ['Sanitär'], status: 'aktiv', beschreibung: '', createdAt: 5, updatedAt: 6, ...o,
});
const zeit = (o: Record<string, unknown> = {}) => ({
  id: 't1', projectId: 'p1', datum: '2026-05-04', mitarbeiter: 'A', von: '07:00', bis: '', pauseMin: 0, minuten: 60, taetigkeit: '', gewerk: '', regie: false, createdAt: 1, ...o,
});
const gueltig = (tabelle: string, rec: unknown) => validateRecord(tabelle, rec, NOW);

describe('validateRecord: gültige Zeilen', () => {
  it('Baustelle', () => {
    expect(gueltig('projects', projekt())!.rec).toMatchObject({ id: 'p1', name: 'Bad Huber', gewerke: ['Sanitär'] });
  });
  it('Stunden mit optionalem fahrtKm', () => {
    expect(gueltig('times', zeit({ fahrtKm: 12 }))!.rec.fahrtKm).toBe(12);
  });
  it('Material, Notiz, Foto, Unterschrift, Skizze, Blob, Protokoll', () => {
    expect(gueltig('materials', { id: 'm', projectId: 'p1', datum: '2026-05-04', bezeichnung: 'Rohr', menge: 2.5, einheit: 'm', artikelnr: '', gewerk: '', regie: false, createdAt: 1 })).not.toBeNull();
    expect(gueltig('notes', { id: 'n', projectId: 'p1', datum: '2026-05-04', titel: 'a', text: 'b', createdAt: 1, updatedAt: 2 })).not.toBeNull();
    expect(gueltig('photos', { id: 'f', projectId: 'p1', datum: '2026-05-04', caption: '', thumb: new ArrayBuffer(4), createdAt: 1 })).not.toBeNull();
    expect(gueltig('signatures', { id: 's', projectId: 'p1', name: 'M', von: '2026-05-01', bis: '2026-05-04', data: new ArrayBuffer(4), createdAt: 1 })).not.toBeNull();
    expect(gueltig('sketches', { id: 'k', projectId: 'p1', titel: 'x', width: 800, height: 600, strokes: [{ tool: 'pen', color: '#000', width: 2, points: [[1, 2], [3, 4]] }], hasBackground: false, thumb: null, createdAt: 1, updatedAt: 1 })).not.toBeNull();
    expect(gueltig('blobs', { id: 'k:bg', projectId: 'p1', data: new ArrayBuffer(4), mime: 'image/jpeg' })).not.toBeNull();
    expect(gueltig('protocols', { id: 'q', projectId: 'p1', templateId: 'druck', templateVersion: 1, titel: 'x', datum: '2026-05-04', values: { a: 1 }, abgeschlossen: false, createdAt: 1, updatedAt: 1 })).not.toBeNull();
  });
  it('unbekannte Felder fallen weg', () => {
    expect(gueltig('projects', projekt({ boese: 'x' }))!.rec).not.toHaveProperty('boese');
  });
});

describe('validateRecord: ungültige Zeilen', () => {
  it('Pflichtfelder und Typen', () => {
    expect(gueltig('projects', projekt({ name: { a: 1 } }))).toBeNull();
    expect(gueltig('projects', projekt({ id: '' }))).toBeNull();
    expect(gueltig('projects', projekt({ id: 'x'.repeat(101) }))).toBeNull();
    expect(gueltig('times', zeit({ projectId: 5 }))).toBeNull();
    expect(gueltig('projects', { ...projekt(), kunde: undefined })).toBeNull();
    expect(gueltig('projects', null)).toBeNull();
    expect(gueltig('unbekannt', {})).toBeNull();
  });
  it('Textlängen und Listen', () => {
    expect(gueltig('projects', projekt({ name: 'x'.repeat(201) }))).toBeNull();
    expect(gueltig('projects', projekt({ gewerke: 'Sanitär' }))).toBeNull();
    expect(gueltig('projects', projekt({ gewerke: [1] }))).toBeNull();
  });
  it('Zahlen: endlich und in Grenzen', () => {
    expect(gueltig('times', zeit({ minuten: Infinity }))).toBeNull();
    expect(gueltig('times', zeit({ minuten: NaN }))).toBeNull();
    expect(gueltig('times', zeit({ minuten: -5 }))).toBeNull();
    expect(gueltig('times', zeit({ minuten: 1e12 }))).toBeNull();
    expect(gueltig('materials', { id: 'm', projectId: 'p1', datum: '2026-05-04', bezeichnung: 'x', menge: '2', einheit: '', artikelnr: '', gewerk: '', regie: false, createdAt: 1 })).toBeNull();
  });
  it('Status aus erlaubter Menge', () => {
    expect(gueltig('projects', projekt({ status: 'geloescht' }))).toBeNull();
  });
  it('Skizze: Größe und Striche', () => {
    const skizze = (o: Record<string, unknown>) => ({ id: 'k', projectId: 'p1', titel: '', width: 800, height: 600, strokes: [], hasBackground: false, thumb: null, createdAt: 1, ...o });
    expect(gueltig('sketches', skizze({ width: 0 }))).toBeNull();
    expect(gueltig('sketches', skizze({ height: 9000 }))).toBeNull();
    expect(gueltig('sketches', skizze({ strokes: new Array(5001).fill({ tool: 'pen', color: '#000', width: 1, points: [] }) }))).toBeNull();
    expect(gueltig('sketches', skizze({ strokes: [{ tool: 'laser', color: '#000', width: 1, points: [] }] }))).toBeNull();
    expect(gueltig('sketches', skizze({ strokes: [{ tool: 'pen', color: '#000', width: 1, points: [[1, 'a']] }] }))).toBeNull();
  });
  it('Blobs: ArrayBuffer, Größe, mime', () => {
    const blob = (o: Record<string, unknown>) => ({ id: 'f', projectId: 'p1', data: new ArrayBuffer(4), mime: 'image/png', ...o });
    expect(gueltig('blobs', blob({ data: 'abc' }))).toBeNull();
    expect(gueltig('blobs', blob({ data: new ArrayBuffer(41 * 1024 * 1024) }))).toBeNull();
    expect(gueltig('blobs', blob({ mime: 'text/html' }))).toBeNull();
    expect(gueltig('blobs', blob({ mime: 'image/svg+xml' }))).toBeNull();
  });
  it('Protokoll: values ist ein Objekt begrenzter Größe', () => {
    const prot = (values: unknown) => ({ id: 'q', projectId: 'p1', templateId: 't', templateVersion: 1, titel: '', datum: '2026-05-04', values, abgeschlossen: false, createdAt: 1 });
    expect(gueltig('protocols', prot([1]))).toBeNull();
    expect(gueltig('protocols', prot('x'))).toBeNull();
    expect(gueltig('protocols', prot(null))).toBeNull();
    expect(gueltig('protocols', prot({ a: 'x'.repeat(3 * 1024 * 1024) }))).toBeNull();
  });
  it('Protokollwerte: gültige Feldtypen bleiben erhalten', () => {
    const prot = (values: unknown) => ({ id: 'q', projectId: 'p1', templateId: 't', templateVersion: 1, titel: '', datum: '2026-05-04', values, abgeschlossen: false, createdAt: 1 });
    const values = {
      t: 'Text', n: 2.5, leer: null, c: { status: 'mangel', bemerkung: 'Riss' }, c2: { status: '', bemerkung: '' },
      tab: [{ _id: 'r1', a: 'x', b: 1, c: null }, { _id: 'r2' }], keine: [],
    };
    expect(gueltig('protocols', prot(values))!.rec.values).toEqual(values);
  });
  it('Protokollwerte: null-Zeile, Objekt als Zelle, falscher Status, Unsinn werden verworfen', () => {
    const prot = (values: unknown) => ({ id: 'q', projectId: 'p1', templateId: 't', templateVersion: 1, titel: '', datum: '2026-05-04', values, abgeschlossen: false, createdAt: 1 });
    expect(gueltig('protocols', prot({ tab: [null] }))).toBeNull();
    expect(gueltig('protocols', prot({ tab: [[1]] }))).toBeNull();
    expect(gueltig('protocols', prot({ tab: [{ _id: 'r', a: { x: 1 } }] }))).toBeNull();
    expect(gueltig('protocols', prot({ tab: [{ _id: 'r', a: true }] }))).toBeNull();
    expect(gueltig('protocols', prot({ tab: [{ a: 'ohne _id' }] }))).toBeNull();
    expect(gueltig('protocols', prot({ tab: new Array(5001).fill({ _id: 'r' }) }))).toBeNull();
    expect(gueltig('protocols', prot({ c: { status: 'kaputt', bemerkung: '' } }))).toBeNull();
    expect(gueltig('protocols', prot({ c: { status: 'ok' } }))).toBeNull();
    expect(gueltig('protocols', prot({ c: { status: 'ok', bemerkung: 5 } }))).toBeNull();
    expect(gueltig('protocols', prot({ x: true }))).toBeNull();
    expect(gueltig('protocols', prot({ x: Infinity }))).toBeNull();
    expect(gueltig('protocols', prot({ x: 'y'.repeat(50_001) }))).toBeNull();
  });
});

describe('Zeitstempel', () => {
  it('limitTimestamp: gültig, Zukunft, ungültig', () => {
    expect(limitTimestamp(NOW + TOLERANZ, NOW)).toEqual({ value: NOW + TOLERANZ, korrigiert: false });
    expect(limitTimestamp(NOW + TOLERANZ + 1, NOW)).toEqual({ value: NOW, korrigiert: true });
    expect(limitTimestamp(NOW + 60 * 60 * 1000, NOW)).toEqual({ value: NOW, korrigiert: true });
    expect(limitTimestamp(9e15, NOW)).toEqual({ value: NOW, korrigiert: true });
    expect(limitTimestamp(-1, NOW).value).toBeUndefined();
    expect(limitTimestamp(Infinity, NOW).value).toBeUndefined();
    expect(limitTimestamp(NaN, NOW).value).toBeUndefined();
    expect(limitTimestamp('5', NOW).value).toBeUndefined();
  });
  it('Datensatz: Zukunft wird begrenzt und gezählt', () => {
    const g = gueltig('projects', projekt({ updatedAt: 9e15, createdAt: 1e15 }))!;
    expect(g.rec.updatedAt).toBe(NOW);
    expect(g.rec.createdAt).toBe(NOW);
    expect(g.korrigiert).toBe(2);
  });
  it('Datensatz: negative oder nicht endliche Werte gelten als fehlend', () => {
    const g = gueltig('projects', projekt({ updatedAt: -5, createdAt: Infinity }))!;
    expect(g.rec).not.toHaveProperty('updatedAt');
    expect(g.rec).not.toHaveProperty('createdAt');
    expect(g.korrigiert).toBe(0);
  });
  it('Löschvermerk: Zukunft begrenzt, ungültig ignoriert', () => {
    expect(validateTombstone({ key: 'projects:p1', table: 'projects', id: 'p1', deletedAt: 1e15 }, NOW)).toEqual({
      tomb: { key: 'projects:p1', table: 'projects', id: 'p1', deletedAt: NOW },
      korrigiert: 1,
    });
    expect(validateTombstone({ key: 'projects:p1', deletedAt: -1 }, NOW)).toBeNull();
    expect(validateTombstone({ key: 'projects:p1', deletedAt: Infinity }, NOW)).toBeNull();
    expect(validateTombstone({ key: 'projects:p1', deletedAt: 'x' }, NOW)).toBeNull();
  });
  it('Löschvermerk: Schlüssel muss passen', () => {
    expect(validateTombstone({ key: 'settings:profil', deletedAt: 1 }, NOW)).toBeNull();
    expect(validateTombstone({ key: 'projects:', deletedAt: 1 }, NOW)).toBeNull();
    expect(validateTombstone({ key: 'projects:p1', table: 'times', id: 'p1', deletedAt: 1 }, NOW)).toBeNull();
    expect(validateTombstone('x', NOW)).toBeNull();
  });
});

describe('__proto__ und Verwandte', () => {
  it('sanitize entfernt die Schlüssel rekursiv, ohne den Prototyp zu setzen', () => {
    const roh = JSON.parse('{"a":1,"__proto__":{"admin":true},"x":{"constructor":1,"y":[{"prototype":2,"ok":3}]}}');
    const sauber = sanitize(roh) as Record<string, any>;
    expect(Object.keys(sauber)).toEqual(['a', 'x']);
    expect(Object.keys(sauber.x)).toEqual(['y']);
    expect(sauber.x.y[0]).toEqual({ ok: 3 });
    expect(({} as any).admin).toBeUndefined();
    expect(Object.getPrototypeOf(sauber)).toBe(Object.prototype);
  });
  it('Zeile mit __proto__ im Protokollwert wird nach sanitize ohne den Schlüssel übernommen', () => {
    const roh = JSON.parse('{"id":"q","projectId":"p1","templateId":"t","templateVersion":1,"titel":"","datum":"2026-05-04","values":{"__proto__":{"x":1},"a":1},"abgeschlossen":false,"createdAt":1}');
    const g = validateRecord('protocols', sanitize(roh), NOW)!;
    expect(Object.keys(g.rec.values as object)).toEqual(['a']);
  });
});

describe('validateProfil', () => {
  it('gültig', () => {
    expect(validateProfil({ name: 'A', firma: 'B', rundung: 15 })).toEqual({ name: 'A', firma: 'B', rundung: 15 });
    expect(validateProfil({ name: '', firma: '' })).toEqual({ name: '', firma: '', rundung: 15 });
  });
  it('ungültig', () => {
    expect(validateProfil({ name: 'A', firma: 'B', rundung: 7 })).toBeNull();
    expect(validateProfil({ name: { x: 1 }, firma: 'B', rundung: 0 })).toBeNull();
    expect(validateProfil([])).toBeNull();
    expect(validateProfil(null)).toBeNull();
  });
});
