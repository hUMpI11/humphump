import { describe, expect, it } from 'vitest';
import { decide, prepareMerge } from './merge';

const rec = (updatedAt?: number, createdAt?: number) => ({ id: 'x', ...(updatedAt !== undefined ? { updatedAt } : {}), ...(createdAt !== undefined ? { createdAt } : {}) });

describe('decide', () => {
  it('nur eingehend: anlegen', () => {
    expect(decide(undefined, rec(5), undefined, undefined)).toBe('anlegen');
  });
  it('nichts vorhanden: nichts', () => {
    expect(decide(undefined, undefined, undefined, undefined)).toBe('nichts');
    expect(decide(undefined, undefined, 5, 7)).toBe('nichts');
  });
  it('nur lokal ohne Löschvermerk: behalten', () => {
    expect(decide(rec(5), undefined, undefined, undefined)).toBe('behalten');
  });
  it('beide: eingehend neuer ersetzt', () => {
    expect(decide(rec(5), rec(6), undefined, undefined)).toBe('ersetzen');
  });
  it('beide: lokal neuer behält', () => {
    expect(decide(rec(6), rec(5), undefined, undefined)).toBe('behalten');
  });
  it('Gleichstand: lokal bleibt', () => {
    expect(decide(rec(5), rec(5), undefined, undefined)).toBe('behalten');
  });
  it('Zeitstempel: updatedAt vor createdAt, fehlend = 0', () => {
    expect(decide(rec(10, 1), rec(5, 99), undefined, undefined)).toBe('behalten');
    expect(decide(rec(undefined, 3), rec(undefined, 4), undefined, undefined)).toBe('ersetzen');
    expect(decide(rec(), rec(1), undefined, undefined)).toBe('ersetzen');
    expect(decide(rec(), rec(), undefined, undefined)).toBe('behalten');
  });
  it('eingehender Löschvermerk neuer als lokaler Stand: löschen', () => {
    expect(decide(rec(5), undefined, undefined, 9)).toBe('loeschen');
  });
  it('Löschvermerk gleich alt wie Stand gewinnt (>=)', () => {
    expect(decide(rec(5), undefined, undefined, 5)).toBe('loeschen');
    expect(decide(rec(5), undefined, 5, undefined)).toBe('loeschen');
  });
  it('lokal nach dem Löschvermerk geändert: behalten', () => {
    expect(decide(rec(10), undefined, undefined, 9)).toBe('behalten');
  });
  it('lokaler Löschvermerk, eingehender Stand älter: nichts', () => {
    expect(decide(undefined, rec(5), 9, undefined)).toBe('nichts');
  });
  it('lokaler Löschvermerk, eingehender Stand neuer: anlegen', () => {
    expect(decide(undefined, rec(10), 9, undefined)).toBe('anlegen');
  });
  it('eingehender Löschvermerk gegen eingehenden Stand: nichts', () => {
    expect(decide(undefined, rec(5), undefined, 5)).toBe('nichts');
  });
  it('beide Löschvermerke: der neuere zählt', () => {
    expect(decide(rec(8), undefined, 3, 9)).toBe('loeschen');
    expect(decide(rec(8), undefined, 9, 3)).toBe('loeschen');
    expect(decide(rec(8), undefined, 3, 4)).toBe('behalten');
    expect(decide(undefined, rec(8), 3, 9)).toBe('nichts');
    expect(decide(undefined, rec(8), 9, 3)).toBe('nichts');
  });
  it('beide Stände und Löschvermerk: neuester Stand entscheidet, Vermerk dazwischen', () => {
    expect(decide(rec(5), rec(10), 7, undefined)).toBe('ersetzen');
    expect(decide(rec(10), rec(5), undefined, 7)).toBe('behalten');
    expect(decide(rec(5), rec(10), 10, undefined)).toBe('loeschen');
  });
  it('Löschvermerk 0 ist ein Löschvermerk', () => {
    expect(decide(rec(), undefined, undefined, 0)).toBe('loeschen');
  });
});

describe('prepareMerge', () => {
  const NOW = 1_700_000_000_000;
  const projekt = (o: Record<string, unknown> = {}) => ({ id: 'p1', name: 'A', kunde: '', adresse: '', auftragsnr: '', gewerke: [], status: 'aktiv', beschreibung: '', createdAt: 1, updatedAt: 2, ...o });

  it('ungültige Zeilen werden gezählt und übersprungen, gültige bleiben', () => {
    const p = prepareMerge({ projects: [projekt(), projekt({ id: 'p2', name: { x: 1 } })] }, { now: NOW });
    expect(p.rows.projects.map((r) => r.id)).toEqual(['p1']);
    expect(p.verworfen).toBe(1);
  });
  it('Zeitstempel in der Zukunft werden begrenzt und gezählt', () => {
    const p = prepareMerge({ projects: [projekt({ updatedAt: 9e15 })], tombstones: [{ key: 'times:t1', table: 'times', id: 't1', deletedAt: 1e15 }] }, { now: NOW });
    expect(p.rows.projects[0].updatedAt).toBe(NOW);
    expect(p.tombstones[0].deletedAt).toBe(NOW);
    expect(p.korrigiert).toBe(2);
  });
  it('Löschvermerk mit ungültiger Zeit wird ignoriert', () => {
    const p = prepareMerge({ tombstones: [{ key: 'times:t1', deletedAt: -3 }, { key: 'times:t2', deletedAt: Infinity }] }, { now: NOW });
    expect(p.tombstones).toEqual([]);
    expect(p.verworfen).toBe(2);
  });
  it('Fehler beim Dekodieren bricht alles ab', () => {
    const decode = (r: Record<string, unknown>) => {
      if (r.id === 'kaputt') throw new Error('Base64');
      return r;
    };
    expect(() => prepareMerge({ projects: [projekt(), projekt({ id: 'kaputt' })] }, { decode, now: NOW })).toThrow(/nichts verändert/);
  });
  it('Profil nur gültig', () => {
    expect(prepareMerge({ settings: [{ key: 'profil', value: { name: 'A', firma: 'B', rundung: 5 } }] }).profil).toEqual({ name: 'A', firma: 'B', rundung: 5 });
    const p = prepareMerge({ settings: [{ key: 'profil', value: { name: 'A', firma: 'B', rundung: 7 } }] });
    expect(p.profil).toBeNull();
    expect(p.verworfen).toBe(1);
  });
});
