import { describe, expect, it } from 'vitest';
import { fmtHours, groupByDate, inRange, minutesBetween, parseDecimal, safeFilename } from './util';
import { decodeRecord, encodeRecord, toCsv } from './export';
import { parseRoute } from './router';

describe('minutesBetween', () => {
  it('rechnet Arbeitszeit abzüglich Pause', () => {
    expect(minutesBetween('07:00', '16:00', 45)).toBe(495);
  });
  it('behandelt Ende vor Beginn als Schicht über Mitternacht', () => {
    expect(minutesBetween('22:00', '02:00')).toBe(240);
  });
  it('wird nie negativ und lehnt ungültige Zeiten ab', () => {
    expect(minutesBetween('08:00', '08:10', 30)).toBe(0);
    expect(minutesBetween('', '08:10')).toBeNull();
    expect(minutesBetween('25:00', '08:10')).toBeNull();
  });
});

describe('Zahlen', () => {
  it('liest Komma und Punkt', () => {
    expect(parseDecimal('7,5')).toBe(7.5);
    expect(parseDecimal(' 7.25 ')).toBe(7.25);
    expect(parseDecimal('abc')).toBeNaN();
  });
  it('formatiert Stunden deutsch', () => {
    expect(fmtHours(495)).toBe('8,25 h');
  });
});

describe('Listenhilfen', () => {
  it('gruppiert nach Datum, neueste zuerst', () => {
    const g = groupByDate([
      { datum: '2026-01-01', createdAt: 2 },
      { datum: '2026-01-03', createdAt: 1 },
      { datum: '2026-01-01', createdAt: 1 },
    ]);
    expect(g.map(([d]) => d)).toEqual(['2026-01-03', '2026-01-01']);
    expect(g[1][1].map((x) => x.createdAt)).toEqual([1, 2]);
  });
  it('filtert Zeiträume inklusive der Grenzen', () => {
    expect(inRange('2026-01-02', '2026-01-02', '2026-01-02')).toBe(true);
    expect(inRange('2026-01-03', '', '2026-01-02')).toBe(false);
    expect(inRange('2026-01-03', '', '')).toBe(true);
  });
  it('erzeugt sichere Dateinamen', () => {
    expect(safeFilename('Schule Müller / Lüftung')).toBe('Schule_Müller_Lüftung');
  });
});

describe('Export', () => {
  it('schreibt Excel-taugliches CSV', () => {
    expect(toCsv([['a;b', 1.5, true], ['x "y"', 2, false]])).toBe('﻿"a;b";1,5;ja\r\n"x ""y""";2;nein\r\n');
  });
  it('übersteht Binärdaten im Backup verlustfrei', () => {
    const data = new Uint8Array([0, 1, 2, 250, 255]).buffer;
    const back = decodeRecord(JSON.parse(JSON.stringify(encodeRecord({ id: 'a', data, n: 3 }))));
    expect(back.id).toBe('a');
    expect(back.n).toBe(3);
    expect([...new Uint8Array(back.data as ArrayBuffer)]).toEqual([0, 1, 2, 250, 255]);
  });
});

describe('Routing', () => {
  it('erkennt die Seiten', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/p/abc')).toEqual({ name: 'projekt', id: 'abc', tab: 'uebersicht' });
    expect(parseRoute('#/p/abc/material')).toEqual({ name: 'projekt', id: 'abc', tab: 'material' });
    expect(parseRoute('#/p/abc/skizze/s1')).toEqual({ name: 'skizze', id: 'abc', sketchId: 's1' });
    expect(parseRoute('#/p/abc/quatsch')).toEqual({ name: 'projekt', id: 'abc', tab: 'uebersicht' });
  });
});

import { addDays, pauseVorschlag, roundDate, weekStart } from './util';
import { merge } from './history';

describe('Tagesablauf-Helfer', () => {
  it('findet den Montag der Woche, auch über Monats- und Jahresgrenzen', () => {
    expect(weekStart('2026-11-10')).toBe('2026-11-09'); // Dienstag
    expect(weekStart('2026-11-09')).toBe('2026-11-09'); // Montag
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // Sonntag
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
    expect(addDays('2026-12-28', 6)).toBe('2027-01-03');
  });
  it('rundet Timer-Zeiten auf Viertelstunden', () => {
    const r = roundDate(new Date(2026, 10, 10, 7, 8), 15);
    expect([r.getHours(), r.getMinutes()]).toEqual([7, 15]);
    const s = roundDate(new Date(2026, 10, 10, 7, 7), 15);
    expect([s.getHours(), s.getMinutes()]).toEqual([7, 0]);
    expect(roundDate(new Date(2026, 10, 10, 7, 7), 0).getMinutes()).toBe(7);
  });
  it('schlägt die Pause nach Arbeitsdauer vor', () => {
    expect(pauseVorschlag(6 * 60)).toBe(0);
    expect(pauseVorschlag(6 * 60 + 15)).toBe(30);
    expect(pauseVorschlag(9 * 60 + 15)).toBe(45);
  });
  it('stellt eigene Vorschläge vor den Katalog und entfernt Dubletten', () => {
    expect(merge(['Kabel gezogen', 'Eigenes'], ['Inbetriebnahme', 'kabel gezogen'], (t) => t)).toEqual(['Kabel gezogen', 'Eigenes', 'Inbetriebnahme']);
  });
});

import { sumMaterial } from './util';

describe('Materialsummen', () => {
  it('fasst gleiche Positionen zusammen und hält Regie getrennt', () => {
    const r = sumMaterial([
      { bezeichnung: 'Wickelfalzrohr DN125', einheit: 'm', menge: 12.5, regie: false },
      { bezeichnung: 'wickelfalzrohr dn125 ', einheit: 'm', menge: 8.1, regie: false },
      { bezeichnung: 'Wickelfalzrohr DN125', einheit: 'm', menge: 2, regie: true },
      { bezeichnung: 'Bogen 90°', einheit: 'Stk', menge: 3, regie: false },
    ]);
    expect(r).toEqual([
      { bezeichnung: 'Bogen 90°', einheit: 'Stk', menge: 3, regie: false },
      { bezeichnung: 'Wickelfalzrohr DN125', einheit: 'm', menge: 20.6, regie: false },
      { bezeichnung: 'Wickelfalzrohr DN125', einheit: 'm', menge: 2, regie: true },
    ]);
  });
});
