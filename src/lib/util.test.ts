import { describe, expect, it } from 'vitest';
import { filterTimes, fmtHours, groupByDate, groupTimes, inRange, isoWeek, minutesBetween, monthLabel, parseDecimal, safeFilename, weekLabel } from './util';
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

describe('Stunden gliedern', () => {
  const z = (datum: string, minuten: number, extra: Partial<{ regie: boolean; abgerechnet: boolean; taetigkeit: string; mitarbeiter: string; createdAt: number }> = {}) => ({
    datum,
    minuten,
    createdAt: 1,
    regie: false,
    taetigkeit: '',
    mitarbeiter: '',
    ...extra,
  });

  it('ermittelt die ISO-Kalenderwoche inklusive Jahreswechsel', () => {
    expect(isoWeek('2025-12-29')).toEqual({ jahr: 2026, kw: 1 });
    expect(isoWeek('2027-01-01')).toEqual({ jahr: 2026, kw: 53 });
    expect(isoWeek('2026-11-02')).toEqual({ jahr: 2026, kw: 45 });
    expect(isoWeek('2026-11-08')).toEqual({ jahr: 2026, kw: 45 });
    expect(isoWeek('2024-12-30')).toEqual({ jahr: 2025, kw: 1 });
    expect(isoWeek('2021-01-03')).toEqual({ jahr: 2020, kw: 53 });
  });

  it('beschriftet Wochen und Monate', () => {
    expect(weekLabel('2026-11-04')).toBe('KW 45 · 02.11.–08.11.2026');
    expect(weekLabel('2027-01-01')).toBe('KW 53 · 28.12.2026–03.01.2027');
    expect(monthLabel('2026-11-14')).toBe('November 2026');
  });

  it('bildet Monatsgruppen mit Anzahl und Summe, neueste zuerst', () => {
    const g = groupTimes([z('2026-09-30', 60), z('2026-11-02', 120), z('2026-11-20', 30), z('2026-10-05', 90)], 'monate');
    expect(g.map((x) => [x.key, x.anzahl, x.minuten])).toEqual([
      ['2026-11', 2, 150],
      ['2026-10', 1, 90],
      ['2026-09', 1, 60],
    ]);
    expect(g[0].tage.map(([d]) => d)).toEqual(['2026-11-20', '2026-11-02']);
  });

  it('bildet Wochengruppen über den Jahreswechsel und sortiert älteste zuerst', () => {
    const g = groupTimes([z('2026-12-31', 60), z('2027-01-01', 60), z('2027-01-04', 60)], 'wochen', 'alt');
    expect(g.map((x) => [x.label, x.anzahl])).toEqual([
      ['KW 53 · 28.12.2026–03.01.2027', 2],
      ['KW 1 · 04.01.–10.01.2027', 1],
    ]);
    expect(g[0].tage.map(([d]) => d)).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('filtert nach Suche, Regie und Abrechnung', () => {
    const l = [
      z('2026-01-01', 60, { taetigkeit: 'Rohre verlegen', mitarbeiter: 'Anna', regie: true }),
      z('2026-01-02', 60, { taetigkeit: 'Fühler', mitarbeiter: 'Bernd', abgerechnet: true }),
      z('2026-01-03', 60, { taetigkeit: 'Fühler setzen', mitarbeiter: 'anna', abgerechnet: true, regie: true }),
    ];
    const f = (o: Partial<Parameters<typeof filterTimes>[1]>) => filterTimes(l, { suche: '', nurRegie: false, abrechnung: 'alle', ...o }).map((x) => x.datum);
    expect(f({})).toHaveLength(3);
    expect(f({ suche: 'ANNA' })).toEqual(['2026-01-01', '2026-01-03']);
    expect(f({ suche: 'fühler' })).toEqual(['2026-01-02', '2026-01-03']);
    expect(f({ nurRegie: true })).toEqual(['2026-01-01', '2026-01-03']);
    expect(f({ abrechnung: 'offen' })).toEqual(['2026-01-01']);
    expect(f({ abrechnung: 'abgerechnet', nurRegie: true })).toEqual(['2026-01-03']);
  });

  it('dreht die Tagesreihenfolge um', () => {
    const g = groupByDate([z('2026-01-01', 1), z('2026-01-03', 1)], 'alt');
    expect(g.map(([d]) => d)).toEqual(['2026-01-01', '2026-01-03']);
  });
});
