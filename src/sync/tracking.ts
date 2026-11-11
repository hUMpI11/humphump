import Dexie, { type Transaction } from 'dexie';

// Eigene Liste statt Import aus db.ts (Zirkelbezug). Muss zu SYNC_TABLES passen.
const TRACKED = ['projects', 'times', 'materials', 'notes', 'photos', 'sketches', 'blobs', 'signatures', 'protocols'] as const;

interface Pending {
  key: string;
  table: string;
  id: string;
  deletedAt: number;
}

// Nur die Einspiel-Transaktion ist ausgenommen. Schreibvorgänge der Oberfläche laufen in eigenen Transaktionen und
// werden weiter gestempelt, auch wenn sie während des Einspielens stattfinden.
const untracked = new WeakSet<Transaction>();

/**
 * Hängt Dexie-Hooks an alle SYNC_TABLES:
 *  - creating/updating: `updatedAt` stempeln (falls der Aufrufer es nicht selbst setzt)
 *  - deleting: Löschvermerk in `tombstones` schreiben
 * Wird einmal aus db.ts aufgerufen. Darf db.ts NICHT importieren (Zirkelbezug) – nur den Parameter nutzen.
 *
 * Löschvermerke: Viele Transaktionen (deleteProject, Foto + Blob löschen …) kennen `tombstones` nicht in ihrem
 * Scope; ein Schreibzugriff im Hook würde das Löschen scheitern lassen. Deshalb werden die Vermerke je Transaktion
 * gesammelt und erst nach deren erfolgreichem Abschluss in einer eigenen Transaktion geschrieben. Stürzt die App
 * dazwischen ab, fehlt der Vermerk (hinnehmbar); das Löschen selbst schlägt nie wegen des Vermerks fehl.
 */
export function installChangeTracking(db: Dexie): void {
  const pendingByTrans = new WeakMap<Transaction, Pending[]>();

  const flush = (list: Pending[]) => {
    // ignoreTransaction: der Complete-Handler läuft sonst noch in der Zone der beendeten Transaktion.
    Dexie.ignoreTransaction(() => {
      db.table('tombstones')
        .bulkPut(list)
        .catch(() => undefined);
    });
  };

  for (const name of TRACKED) {
    const table = db.table(name);

    table.hook('creating', (_key, obj, trans) => {
      if (untracked.has(trans)) return;
      const rec = obj as Record<string, unknown>;
      if (rec.updatedAt === undefined) rec.updatedAt = Date.now();
    });

    table.hook('updating', (mods, _key, _obj, trans) => {
      if (untracked.has(trans)) return;
      if ('updatedAt' in (mods as object)) return;
      return { updatedAt: Date.now() };
    });

    table.hook('deleting', (key, _obj, trans) => {
      if (untracked.has(trans)) return;
      const id = String(key);
      const entry: Pending = { key: `${name}:${id}`, table: name, id, deletedAt: Date.now() };
      let list = pendingByTrans.get(trans);
      if (!list) {
        list = [];
        pendingByTrans.set(trans, list);
        const mine = list;
        trans.on('complete', () => flush(mine));
      }
      list.push(entry);
    });
  }
}

/**
 * Nimmt die aktuelle Transaktion von der Änderungsverfolgung aus (für das Einspielen/Zusammenführen: Zeitstempel
 * bleiben erhalten, keine Löschvermerke). Muss innerhalb des Transaktions-Callbacks vor dem ersten Schreiben
 * aufgerufen werden. Andere Transaktionen, auch gleichzeitig laufende, bleiben verfolgt.
 */
export function untrackCurrentTransaction(): void {
  const trans = Dexie.currentTransaction;
  if (!trans) throw new Error('untrackCurrentTransaction außerhalb einer Transaktion aufgerufen');
  untracked.add(trans);
}
