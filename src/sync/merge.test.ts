import { describe, expect, it } from 'vitest';
import { decide } from './merge';

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
