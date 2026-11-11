/*
 * Konfliktstrategie beim Zusammenführen (Geräteabgleich per Sicherungsdatei)
 *
 * - Granularität: ganzer Datensatz, nicht einzelne Felder. Wurde derselbe Datensatz auf beiden Geräten geändert,
 *   gewinnt der spätere Stand komplett; die Änderung des anderen Geräts geht verloren.
 * - Zeitstempel eines Datensatzes: updatedAt ?? createdAt ?? 0. Gleichstand: der lokale Stand bleibt.
 * - Löschungen: Je gelöschtem Datensatz gibt es einen Löschvermerk (tombstones, key `tabelle:id`). Von beiden
 *   Seiten zählt der neuere. Er gewinnt gegenüber jedem Stand, der nicht neuer ist als er (deletedAt >= Zeitstempel);
 *   wurde ein Datensatz nach der Löschung neu bearbeitet, bleibt er bzw. kommt er zurück.
 * - Voraussetzung: Die Uhren der Geräte gehen ungefähr richtig. Es gibt nur eine Obergrenze (siehe unten), keine Uhrenkorrektur.
 * - blobs (Vollbilder, Skizzenbilder) haben keinen eigenen Zeitstempel. Sie folgen dem zugehörigen Foto bzw. der
 *   Skizze (Blob-id = Foto-/Skizzen-id; Skizzenhintergrund `skizzenId:bg`): Wird das Elternteil angelegt oder ersetzt,
 *   wird der Blob aus der Sicherung übernommen; wird es gelöscht, wird der Blob gelöscht; bleibt es lokal, bleibt
 *   auch der Blob (fehlt er lokal, wird er ergänzt). Blobs werden nicht in MergeResult mitgezählt.
 * - Datensätze, deren Baustelle (projectId) lokal nicht existiert (z. B. dort gelöscht), werden nicht angelegt.
 * - settings: `profil` nur, wenn lokal noch leer; `timer` und `letzteSicherung` nie (gehören zum Gerät).
 * - Die Einspiel-Transaktion ist von den Änderungs-Hooks ausgenommen (untrackCurrentTransaction), damit Zeitstempel erhalten
 *   bleiben. Das gilt nur für diese Transaktion: Eingaben in der Oberfläche während des Einspielens werden normal gestempelt.
 *
 * Härtung (die Datei ist eine nicht vertrauenswürdige Eingabe):
 * - Erst vollständig dekodieren und je Zeile prüfen (validate.ts), dann in EINER Transaktion über alle Tabellen
 *   schreiben: Schlägt etwas fehl, bleibt der lokale Stand unverändert. Ungültige Zeilen werden übersprungen (verworfen).
 * - Zeitstempel (updatedAt/createdAt/deletedAt) mehr als 5 Minuten nach dem Erstellzeitpunkt der Sicherung werden auf
 *   diesen begrenzt (korrigiert; Bezugszeit `now`, siehe planRestore);
 *   nicht endliche oder negative gelten als fehlend (ein solcher Löschvermerk wird ignoriert). `decide` bleibt davon unberührt.
 * - Bewusste Grenze: Die ganze Sicherung liegt dekodiert im Arbeitsspeicher (grob das 1,5- bis 2-Fache der Dateigröße),
 *   weil erst nach vollständiger Prüfung geschrieben wird. Deshalb lehnt planRestore Dateien über 500 MB ab.
 */

import { untrackCurrentTransaction } from './tracking';
import { sanitize, validateProfil, validateRecord, validateTombstone, type ProfilWert } from './validate';

export interface MergeResult {
  /** neu angelegte Datensätze */
  neu: number;
  /** durch neueren Stand ersetzte Datensätze */
  aktualisiert: number;
  /** unverändert gelassen, weil lokal neuer oder gleich */
  behalten: number;
  /** lokal gelöscht, weil die Sicherung einen neueren Löschvermerk enthält */
  geloescht: number;
  /** aus der Sicherung nicht übernommen, weil ungültig (falsche Typen, fehlende Pflichtfelder) */
  verworfen: number;
  /** Zeitstempel, die in der Zukunft lagen und auf „jetzt“ begrenzt wurden */
  korrigiert: number;
}

/** Ergebnis bzw. Vorschau in einem Satz, für Rückfrage und Erfolgsmeldung. */
export function formatMergeResult(r: MergeResult): string {
  const teile = [`${r.neu} neu`, `${r.aktualisiert} aktualisiert`, `${r.geloescht} gelöscht`, `${r.behalten} unverändert`];
  if (r.verworfen) teile.push(`${r.verworfen} ungültig und übersprungen`);
  if (r.korrigiert) teile.push(`${r.korrigiert} Zeitstempel korrigiert`);
  return teile.join(', ');
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
  /** Dekodiert eine Zeile (z. B. Base64 zu ArrayBuffer). Darf werfen: dann wird nichts geschrieben. */
  decode?: (rec: Rec) => Rec;
  /** Bezugszeit für das Begrenzen von Zeitstempeln (Tests). */
  now?: number;
}

interface PreparedTombstone {
  key: string;
  table: string;
  id: string;
  deletedAt: number;
}

/** Vollständig dekodierte und geprüfte Sicherung; Zwischenstand zwischen Prüfen und Schreiben. */
export interface PreparedMerge {
  rows: Record<string, Rec[]>;
  tombstones: PreparedTombstone[];
  profil: ProfilWert | null;
  verworfen: number;
  korrigiert: number;
}

/** Dekodiert und prüft alle Zeilen. Schreibt nichts; wirft bei nicht lesbaren Daten (z. B. kaputtes Base64). */
export function prepareMerge(tables: Record<string, Rec[]>, opts: MergeOptions = {}): PreparedMerge {
  const decode = opts.decode ?? ((r: Rec) => r);
  const now = opts.now ?? Date.now();
  const p: PreparedMerge = { rows: {}, tombstones: [], profil: null, verworfen: 0, korrigiert: 0 };

  for (const name of [...FACH_TABELLEN, 'blobs'] as const) {
    const rows = tables[name];
    if (!Array.isArray(rows)) continue;
    const out: Rec[] = [];
    for (const raw of rows) {
      let decoded: unknown;
      try {
        decoded = sanitize(decode(raw));
      } catch (e) {
        throw new Error(`Die Sicherung ist beschädigt (Tabelle „${name}“: ${(e as Error).message}). Es wurde nichts verändert.`);
      }
      const g = validateRecord(name, decoded, now);
      if (!g) {
        p.verworfen++;
        continue;
      }
      p.korrigiert += g.korrigiert;
      out.push(g.rec);
    }
    p.rows[name] = out;
  }

  const seenTomb = new Set<string>();
  for (const raw of Array.isArray(tables.tombstones) ? tables.tombstones : []) {
    const g = validateTombstone(sanitize(raw), now);
    if (!g || seenTomb.has(g.tomb.key)) {
      p.verworfen++;
      continue;
    }
    seenTomb.add(g.tomb.key);
    p.korrigiert += g.korrigiert;
    p.tombstones.push(g.tomb);
  }

  const profilRow = (Array.isArray(tables.settings) ? tables.settings : []).find((s) => s && (s as Rec).key === 'profil');
  if (profilRow) {
    p.profil = validateProfil(sanitize((profilRow as Rec).value));
    if (!p.profil) p.verworfen++;
  }
  return p;
}

/**
 * Wendet eine geprüfte Sicherung an: in einer Transaktion über alle Tabellen. Mit `dryRun` wird nichts geschrieben
 * (gleiche Entscheidungen, nur Zählung) – das ist die Vorschau.
 */
export async function runPrepared(p: PreparedMerge, opts: { dryRun?: boolean } = {}): Promise<MergeResult> {
  const { db } = await import('../db'); // erst hier, damit decide() ohne Datenbank testbar bleibt
  const write = !opts.dryRun;
  const result: MergeResult = { neu: 0, aktualisiert: 0, behalten: 0, geloescht: 0, verworfen: p.verworfen, korrigiert: p.korrigiert };

  const incomingTombs = new Map<string, number>();
  for (const t of p.tombstones) incomingTombs.set(t.key, t.deletedAt);

  const scope = [db.projects, db.times, db.materials, db.notes, db.photos, db.sketches, db.blobs, db.signatures, db.protocols, db.tombstones, db.settings];

  return db.transaction(write ? 'rw' : 'r', scope, async () => {
    untrackCurrentTransaction();
    const localTombs = new Map<string, number>();
    await db.tombstones.each((t) => localTombs.set(t.key, t.deletedAt));

    const projectIds = new Set<string>((await db.projects.toCollection().primaryKeys()) as string[]);
    // Ergebnis je Foto/Skizze für die Blob-Regel: 'put' (angelegt/ersetzt), 'del' (gelöscht), sonst bleibt lokal.
    const parentOutcome = new Map<string, 'put' | 'del'>();

    for (const name of FACH_TABELLEN) {
      const rows = p.rows[name] ?? []; // fehlende Tabelle = leer; Löschvermerke der Sicherung gelten trotzdem
      const table = db.table(name);
      let puts: Rec[] = [];
      const flush = async () => {
        if (write && puts.length) await table.bulkPut(puts);
        puts = [];
      };
      const dels: string[] = [];
      const seen = new Set<string>();

      for (const rec of rows) {
        const id = rec.id as string;
        if (seen.has(id)) {
          result.verworfen++; // doppelte id in derselben Datei
          continue;
        }
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
      if (write && dels.length) await table.bulkDelete(dels);
    }

    if (write) {
      const incomingBlobIds = new Set<string>();
      for (const rec of p.rows.blobs ?? []) {
        const id = rec.id as string;
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
      for (const [parent, outcome] of parentOutcome) {
        if (outcome === 'del') await db.blobs.bulkDelete([parent, `${parent}:bg`]);
        else if (!incomingBlobIds.has(`${parent}:bg`)) {
          // Ersetzte Skizze ohne Hintergrund in der Sicherung: alten lokalen Hintergrund entfernen.
          if (await db.sketches.where('id').equals(parent).count()) await db.blobs.delete(`${parent}:bg`);
        }
      }

      // Löschvermerke: je key der neuere.
      const tombPuts = p.tombstones.filter((t) => {
        const have = localTombs.get(t.key);
        return have === undefined || t.deletedAt > have;
      });
      if (tombPuts.length) await db.tombstones.bulkPut(tombPuts);

      // Einstellungen: nur Profil, nur wenn lokal leer.
      if (p.profil) {
        const lokal = (await db.settings.get('profil'))?.value as { name?: string; firma?: string } | undefined;
        if (!lokal || (!lokal.name && !lokal.firma)) await db.settings.put({ key: 'profil', value: p.profil });
      }
    }

    return result;
  });
}

/** Führt die Tabellen einer Sicherung mit der lokalen Datenbank zusammen (prüfen, dann alles oder nichts schreiben). */
export async function mergeTables(tables: Record<string, Rec[]>, opts: MergeOptions = {}): Promise<MergeResult> {
  return runPrepared(prepareMerge(tables, opts));
}
