/*
 * Konfliktstrategie beim Zusammenführen (Geräteabgleich per Sicherungsdatei)
 *
 * - Granularität: ganzer Datensatz, nicht einzelne Felder. Wurde derselbe Datensatz auf beiden Geräten geändert,
 *   gewinnt der spätere Stand komplett; die Änderung des anderen Geräts geht verloren.
 * - Zeitstempel eines Datensatzes: updatedAt ?? createdAt ?? 0. Gleichstand: der lokale Stand bleibt.
 * - Löschungen: Je gelöschtem Datensatz gibt es einen Löschvermerk (tombstones, key `tabelle:id`). Von beiden
 *   Seiten zählt der neuere. Er gewinnt gegenüber jedem Stand, der nicht neuer ist als er (deletedAt >= Zeitstempel);
 *   wurde ein Datensatz nach der Löschung neu bearbeitet, bleibt er bzw. kommt er zurück.
 * - Voraussetzung: Die Uhren der Geräte gehen ungefähr richtig. Es gibt keine Uhrenkorrektur.
 * - blobs (Vollbilder, Skizzenbilder) haben keinen eigenen Zeitstempel. Sie folgen dem zugehörigen Foto bzw. der
 *   Skizze (Blob-id = Foto-/Skizzen-id; Skizzenhintergrund `skizzenId:bg`): Wird das Elternteil angelegt oder ersetzt,
 *   wird der Blob aus der Sicherung übernommen; wird es gelöscht, wird der Blob gelöscht; bleibt es lokal, bleibt
 *   auch der Blob (fehlt er lokal, wird er ergänzt). Blobs werden nicht in MergeResult mitgezählt.
 * - Datensätze, deren Baustelle (projectId) lokal nicht existiert (z. B. dort gelöscht), werden nicht angelegt.
 * - settings: `profil` nur, wenn lokal noch leer; `timer` und `letzteSicherung` nie (gehören zum Gerät).
 * - Beim Zusammenführen laufen die Änderungs-Hooks nicht (withoutTracking), damit Zeitstempel erhalten bleiben.
 */

import { withoutTracking } from './tracking';

export interface MergeResult {
  /** neu angelegte Datensätze */
  neu: number;
  /** durch neueren Stand ersetzte Datensätze */
  aktualisiert: number;
  /** unverändert gelassen, weil lokal neuer oder gleich */
  behalten: number;
  /** lokal gelöscht, weil die Sicherung einen neueren Löschvermerk enthält */
  geloescht: number;
}

type Rec = Record<string, unknown>;
type Entscheidung = 'anlegen' | 'ersetzen' | 'behalten' | 'loeschen' | 'nichts';

const stamp = (r: Rec): number => {
  const v = typeof r.updatedAt === 'number' ? r.updatedAt : typeof r.createdAt === 'number' ? r.createdAt : 0;
  return v;
};

/**
 * Reine Entscheidungslogik (ohne Datenbank, gut testbar):
 * Was passiert mit einem Datensatz, wenn lokal und/oder in der Sicherung ein Stand bzw. Löschvermerk existiert?
 * Zeitstempel eines Datensatzes = updatedAt ?? createdAt ?? 0.
 */
export function decide(local: Rec | undefined, incoming: Rec | undefined, localDeletedAt: number | undefined, incomingDeletedAt: number | undefined): Entscheidung {
  const del = localDeletedAt === undefined ? incomingDeletedAt : incomingDeletedAt === undefined ? localDeletedAt : Math.max(localDeletedAt, incomingDeletedAt);
  const localTs = local ? stamp(local) : undefined;
  const incTs = incoming ? stamp(incoming) : undefined;

  if (del !== undefined) {
    const newest = Math.max(localTs ?? -Infinity, incTs ?? -Infinity);
    if (del >= newest) return local ? 'loeschen' : 'nichts';
  }
  if (local && incoming) return incTs! > localTs! ? 'ersetzen' : 'behalten';
  if (incoming) return 'anlegen';
  return local ? 'behalten' : 'nichts';
}

const FACH_TABELLEN = ['projects', 'times', 'materials', 'notes', 'photos', 'sketches', 'signatures', 'protocols'] as const;
const CHUNK = 40; // klein halten: Fotos sind groß

export interface MergeOptions {
  /** Wird je Zeile erst bei der Verarbeitung aufgerufen (spart Speicher bei vielen Fotos). */
  decode?: (rec: Rec) => Rec;
}

/** Führt die Tabellen einer Sicherung mit der lokalen Datenbank zusammen. */
export async function mergeTables(tables: Record<string, Rec[]>, opts: MergeOptions = {}): Promise<MergeResult> {
  const { db } = await import('../db'); // erst hier, damit decide() ohne Datenbank testbar bleibt
  const decode = opts.decode ?? ((r: Rec) => r);
  const result: MergeResult = { neu: 0, aktualisiert: 0, behalten: 0, geloescht: 0 };

  const incomingTombs = new Map<string, number>();
  for (const t of tables.tombstones ?? []) {
    if (typeof t.key === 'string' && typeof t.deletedAt === 'number') incomingTombs.set(t.key, t.deletedAt);
  }

  return withoutTracking(async () => {
    const localTombs = new Map<string, number>();
    await db.tombstones.each((t) => localTombs.set(t.key, t.deletedAt));

    const projectIds = new Set<string>((await db.projects.toCollection().primaryKeys()) as string[]);
    // Ergebnis je Foto/Skizze für die Blob-Regel: 'put' (angelegt/ersetzt), 'del' (gelöscht), sonst bleibt lokal.
    const parentOutcome = new Map<string, 'put' | 'del'>();

    for (const name of FACH_TABELLEN) {
      const rows = tables[name];
      if (!Array.isArray(rows)) continue;
      const table = db.table(name);
      let puts: Rec[] = [];
      const flush = async () => {
        if (puts.length) await table.bulkPut(puts);
        puts = [];
      };
      const dels: string[] = [];
      const seen = new Set<string>();

      for (const raw of rows) {
        const rec = decode(raw);
        const id = rec.id;
        if (typeof id !== 'string') continue;
        seen.add(id);
        const key = `${name}:${id}`;
        const local = (await table.get(id)) as Rec | undefined;
        const action = decide(local, rec, localTombs.get(key), incomingTombs.get(key));
        const orphan = name !== 'projects' && typeof rec.projectId === 'string' && !projectIds.has(rec.projectId);
        if (orphan && (action === 'anlegen' || action === 'ersetzen')) {
          result.behalten++;
          continue;
        }
        if (action === 'anlegen' || action === 'ersetzen') {
          puts.push(rec);
          if (action === 'anlegen') result.neu++;
          else result.aktualisiert++;
          if (name === 'projects') projectIds.add(id);
          if (name === 'photos' || name === 'sketches') parentOutcome.set(id, 'put');
          if (puts.length >= CHUNK) await flush();
        } else if (action === 'loeschen') {
          dels.push(id);
          result.geloescht++;
          if (name === 'photos' || name === 'sketches') parentOutcome.set(id, 'del');
          if (name === 'projects') projectIds.delete(id);
        } else {
          result.behalten++;
        }
      }
      await flush();
      // Löschvermerke der Sicherung für Datensätze, die dort selbst nicht (mehr) vorkommen.
      for (const [key, deletedAt] of incomingTombs) {
        if (!key.startsWith(`${name}:`)) continue;
        const id = key.slice(name.length + 1);
        if (seen.has(id)) continue;
        const local = (await table.get(id)) as Rec | undefined;
        if (local && decide(local, undefined, localTombs.get(key), deletedAt) === 'loeschen') {
          dels.push(id);
          result.geloescht++;
          if (name === 'photos' || name === 'sketches') parentOutcome.set(id, 'del');
          if (name === 'projects') projectIds.delete(id);
        }
      }
      if (dels.length) await table.bulkDelete(dels);
    }

    // Lokale Fotos/Skizzen, die nur über einen Löschvermerk aus der Sicherung wegfallen, sind oben schon erfasst.
    // Skizzen mit ersetztem Stand: Hintergrund-Blob prüfen (kann entfallen sein).
    const incomingBlobIds = new Set<string>();
    const blobRows = tables.blobs;
    if (Array.isArray(blobRows)) {
      for (const raw of blobRows) {
        const rec = decode(raw);
        const id = rec.id;
        if (typeof id !== 'string') continue;
        incomingBlobIds.add(id);
        const parent = id.endsWith(':bg') ? id.slice(0, -3) : id;
        const outcome = parentOutcome.get(parent);
        if (outcome === 'put') {
          await db.blobs.put(rec as never);
        } else if (outcome === undefined) {
          // Elternteil bleibt lokal: Blob nur ergänzen, wenn er lokal fehlt und das Elternteil lokal existiert.
          const hasParent = (await db.photos.where('id').equals(parent).count()) + (await db.sketches.where('id').equals(parent).count()) > 0;
          if (hasParent && !(await db.blobs.get(id))) await db.blobs.put(rec as never);
        }
      }
    }
    for (const [parent, outcome] of parentOutcome) {
      if (outcome === 'del') await db.blobs.bulkDelete([parent, `${parent}:bg`]);
      else if (!incomingBlobIds.has(`${parent}:bg`)) {
        // Ersetzte Skizze ohne Hintergrund in der Sicherung: alten lokalen Hintergrund entfernen.
        if (await db.sketches.where('id').equals(parent).count()) await db.blobs.delete(`${parent}:bg`);
      }
    }

    // Löschvermerke: je key der neuere.
    const tombPuts: { key: string; table: string; id: string; deletedAt: number }[] = [];
    for (const t of tables.tombstones ?? []) {
      if (typeof t.key !== 'string' || typeof t.deletedAt !== 'number') continue;
      const have = localTombs.get(t.key);
      if (have === undefined || t.deletedAt > have) {
        const [table, ...rest] = t.key.split(':');
        tombPuts.push({ key: t.key, table: typeof t.table === 'string' ? t.table : table, id: typeof t.id === 'string' ? t.id : rest.join(':'), deletedAt: t.deletedAt });
      }
    }
    if (tombPuts.length) await db.tombstones.bulkPut(tombPuts);

    // Einstellungen: nur Profil, nur wenn lokal leer.
    const incomingProfil = (tables.settings ?? []).find((s) => s.key === 'profil')?.value as { name?: string; firma?: string } | undefined;
    if (incomingProfil) {
      const lokal = (await db.settings.get('profil'))?.value as { name?: string; firma?: string } | undefined;
      if (!lokal || (!lokal.name && !lokal.firma)) await db.settings.put({ key: 'profil', value: incomingProfil });
    }

    return result;
  });
}
