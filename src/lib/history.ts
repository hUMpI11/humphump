import { db } from '../db';

/**
 * Vorschläge aus den eigenen bisherigen Einträgen (alle Baustellen), häufigste zuerst.
 * Ein Handwerker verbaut zu 80 % immer dasselbe – das soll er nicht jedes Mal tippen.
 */
export async function eigeneMaterialien(limit = 40): Promise<[string, string][]> {
  const stat = new Map<string, { n: number; einheit: string; last: number }>();
  await db.materials.each((m) => {
    const cur = stat.get(m.bezeichnung);
    if (!cur) stat.set(m.bezeichnung, { n: 1, einheit: m.einheit, last: m.createdAt });
    else {
      cur.n++;
      if (m.createdAt > cur.last) Object.assign(cur, { einheit: m.einheit, last: m.createdAt });
    }
  });
  return [...stat.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)
    .slice(0, limit)
    .map(([b, s]) => [b, s.einheit]);
}

export async function eigeneTaetigkeiten(limit = 12): Promise<string[]> {
  const stat = new Map<string, number>();
  await db.times.each((t) => {
    for (const teil of t.taetigkeit.split(/,\s*|\n/)) {
      const s = teil.trim();
      if (s.length >= 3 && s.length <= 60) stat.set(s, (stat.get(s) ?? 0) + 1);
    }
  });
  return [...stat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([s]) => s);
}

/** Eigene Einträge vorn, Katalog dahinter, ohne Dubletten (Groß-/Kleinschreibung egal). */
export function merge<T>(eigene: T[], katalog: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return [...eigene, ...katalog].filter((t) => {
    const k = key(t).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
