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

/** Gruppiert nach Datum, neueste zuerst; innerhalb des Tages nach Erstellzeit. */
export function groupByDate<T extends { datum: string; createdAt: number }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const list = map.get(it.datum);
    if (list) list.push(it);
    else map.set(it.datum, [it]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([d, list]) => [d, list.sort((a, b) => a.createdAt - b.createdAt)]);
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
