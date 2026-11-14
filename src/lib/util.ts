export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Lokales Datum als YYYY-MM-DD (nicht UTC – sonst kippt der Tag nachts). */
export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hhmm(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDate(iso: string, withWeekday = true): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('de-DE', {
    weekday: withWeekday ? 'short' : undefined,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

/** Montag der Woche, in der das Datum liegt. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return addDays(iso, -((new Date(y, m - 1, d).getDay() + 6) % 7));
}

/** Rundet auf das nächste Vielfache von stepMin Minuten (0 = unverändert). */
export function roundDate(d: Date, stepMin: number): Date {
  if (!stepMin) return d;
  const ms = stepMin * 60_000;
  return new Date(Math.round(d.getTime() / ms) * ms);
}

/** Übliche Mindestpause nach Arbeitszeitgesetz als Vorschlag: >6 h = 30 min, >9 h = 45 min. */
export function pauseVorschlag(bruttoMin: number): number {
  return bruttoMin > 9 * 60 ? 45 : bruttoMin > 6 * 60 ? 30 : 0;
}

function toMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Netto-Minuten zwischen zwei Uhrzeiten abzüglich Pause. Ende vor Beginn = über Mitternacht. */
export function minutesBetween(von: string, bis: string, pauseMin = 0): number | null {
  const a = toMinutes(von);
  const b = toMinutes(bis);
  if (a === null || b === null) return null;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return Math.max(0, diff - Math.max(0, pauseMin));
}

/** Akzeptiert deutsche und englische Dezimalschreibweise ("7,5" / "7.5"). */
export function parseDecimal(s: string): number {
  const n = Number(s.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export function fmtNumber(n: number, maxDigits = 2): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: maxDigits });
}

export function fmtHours(minuten: number): string {
  return (minuten / 60).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';
}

export type Reihenfolge = 'neu' | 'alt';

/** Gruppiert nach Datum (Standard: neueste zuerst); innerhalb des Tages nach Erstellzeit. */
export function groupByDate<T extends { datum: string; createdAt: number }>(items: T[], reihenfolge: Reihenfolge = 'neu'): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const list = map.get(it.datum);
    if (list) list.push(it);
    else map.set(it.datum, [it]);
  }
  const dir = reihenfolge === 'neu' ? -1 : 1;
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -dir : dir))
    .map(([d, list]) => [d, list.sort((a, b) => a.createdAt - b.createdAt)]);
}

/** ISO-8601-Kalenderwoche (Montag bis Sonntag, KW 1 enthält den ersten Donnerstag). */
export function isoWeek(iso: string): { jahr: number; kw: number } {
  const [y, m, d] = iso.split('-').map(Number);
  const tag = Date.UTC(y, m - 1, d);
  const wochentag = (new Date(tag).getUTCDay() + 6) % 7; // Montag = 0
  const donnerstag = new Date(tag + (3 - wochentag) * 86_400_000);
  const jahr = donnerstag.getUTCFullYear();
  const tagImJahr = Math.round((donnerstag.getTime() - Date.UTC(jahr, 0, 1)) / 86_400_000);
  return { jahr, kw: Math.floor(tagImJahr / 7) + 1 };
}

/** "KW 45 · 02.11.–08.11.2026" (über den Jahreswechsel mit beiden Jahren). */
export function weekLabel(iso: string): string {
  const { kw } = isoWeek(iso);
  const von = weekStart(iso);
  const bis = addDays(von, 6);
  const a = fmtDate(von, false);
  const b = fmtDate(bis, false);
  return `KW ${kw} · ${von.slice(0, 4) === bis.slice(0, 4) ? a.slice(0, 6) : a}–${b}`;
}

/** "November 2026" */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export type Abrechnung = 'alle' | 'offen' | 'abgerechnet';

export interface ZeitFilter {
  suche: string;
  nurRegie: boolean;
  abrechnung: Abrechnung;
}

interface ZeitLike {
  datum: string;
  createdAt: number;
  minuten: number;
  regie: boolean;
  abgerechnet?: boolean;
  taetigkeit: string;
  mitarbeiter: string;
}

export const sumMinuten = (items: { minuten: number }[]) => items.reduce((s, e) => s + e.minuten, 0);

/** Suche in Tätigkeit und Mitarbeiter ohne Groß-/Kleinschreibung; alle Bedingungen müssen zutreffen. */
export function filterTimes<T extends ZeitLike>(items: T[], f: ZeitFilter): T[] {
  const q = f.suche.trim().toLowerCase();
  return items.filter(
    (e) =>
      (!q || e.taetigkeit.toLowerCase().includes(q) || e.mitarbeiter.toLowerCase().includes(q)) &&
      (!f.nurRegie || e.regie) &&
      (f.abrechnung === 'alle' || (f.abrechnung === 'abgerechnet') === !!e.abgerechnet),
  );
}

export interface ZeitGruppe<T> {
  key: string;
  label: string;
  anzahl: number;
  minuten: number;
  items: T[];
  tage: [string, T[]][];
}

/** Gruppiert Stunden nach Kalenderwoche (ISO) oder Monat; Abschnitte und Tage in der gewählten Reihenfolge. */
export function groupTimes<T extends ZeitLike>(items: T[], modus: 'wochen' | 'monate', reihenfolge: Reihenfolge = 'neu'): ZeitGruppe<T>[] {
  const map = new Map<string, { label: string; items: T[] }>();
  for (const it of items) {
    const key = modus === 'monate' ? it.datum.slice(0, 7) : weekStart(it.datum);
    const g = map.get(key);
    if (g) g.items.push(it);
    else map.set(key, { label: modus === 'monate' ? monthLabel(it.datum) : weekLabel(it.datum), items: [it] });
  }
  const dir = reihenfolge === 'neu' ? -1 : 1;
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -dir : dir))
    .map(([key, g]) => ({ key, label: g.label, anzahl: g.items.length, minuten: sumMinuten(g.items), items: g.items, tage: groupByDate(g.items, reihenfolge) }));
}

export function inRange(datum: string, von: string, bis: string): boolean {
  return (!von || datum >= von) && (!bis || datum <= bis);
}

export function safeFilename(s: string): string {
  return s.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'export';
}

export interface MaterialSumme {
  bezeichnung: string;
  einheit: string;
  menge: number;
  regie: boolean;
}

/** Fasst gleiche Materialien zusammen (gleiche Bezeichnung + Einheit, Regie getrennt) – so steht es auf der Rechnung. */
export function sumMaterial(list: { bezeichnung: string; einheit: string; menge: number; regie: boolean }[]): MaterialSumme[] {
  const map = new Map<string, MaterialSumme>();
  for (const m of list) {
    const key = `${m.bezeichnung.trim().toLowerCase()}|${m.einheit}|${m.regie}`;
    const cur = map.get(key);
    if (cur) cur.menge = Math.round((cur.menge + m.menge) * 1000) / 1000;
    else map.set(key, { bezeichnung: m.bezeichnung.trim(), einheit: m.einheit, menge: m.menge, regie: m.regie });
  }
  return [...map.values()].sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung, 'de') || Number(a.regie) - Number(b.regie));
}
