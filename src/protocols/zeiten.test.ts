import { describe, expect, it } from 'vitest';
import type { TimeEntry } from '../db';
import { zeilenAusZeiten } from './zeiten';

const S = { name: 'name', taetigkeit: 'taetigkeit', stunden: 'stunden' };
const z = (o: Partial<TimeEntry>): TimeEntry => ({
  id: 'x',
  projectId: 'p',
  datum: '2026-03-10',
  mitarbeiter: 'Anna',
  von: '',
  bis: '',
  pauseMin: 0,
  minuten: 60,
  taetigkeit: 'Rohre',
  gewerk: '',
  regie: false,
  createdAt: 1,
  ...o,
});

describe('zeilenAusZeiten', () => {
  it('rechnet Minuten in Stunden und rundet auf zwei Stellen', () => {
    const [r] = zeilenAusZeiten([z({ minuten: 450 })], S);
    expect(r.stunden).toBe(7.5);
    expect(r.name).toBe('Anna');
    expect(r.taetigkeit).toBe('Rohre');
    expect(r._id).toBeTruthy();
    expect(zeilenAusZeiten([z({ minuten: 20 })], S)[0].stunden).toBe(0.33);
  });
  it('sortiert nach Erstellzeit und vergibt eindeutige ids', () => {
    const rows = zeilenAusZeiten([z({ mitarbeiter: 'B', createdAt: 5 }), z({ mitarbeiter: 'A', createdAt: 2 })], S);
    expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
    expect(new Set(rows.map((r) => r._id)).size).toBe(2);
  });
  it('überspringt Einträge mit 0 Minuten', () => {
    expect(zeilenAusZeiten([z({ minuten: 0 }), z({ minuten: 30 })], S)).toHaveLength(1);
  });
  it('kennzeichnet Regie in der Tätigkeit', () => {
    expect(zeilenAusZeiten([z({ regie: true })], S)[0].taetigkeit).toBe('Rohre (Regie)');
    expect(zeilenAusZeiten([z({ regie: true, taetigkeit: '' })], S)[0].taetigkeit).toBe('(Regie)');
  });
  it('liefert bei leerer Liste nichts', () => {
    expect(zeilenAusZeiten([], S)).toEqual([]);
  });
  it('verändert die Eingabe nicht', () => {
    const eingabe = [z({ createdAt: 9 }), z({ createdAt: 1 })];
    zeilenAusZeiten(eingabe, S);
    expect(eingabe.map((e) => e.createdAt)).toEqual([9, 1]);
  });
});
