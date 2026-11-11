import Dexie, { type Transaction } from 'dexie';

// Eigene Liste statt Import aus db.ts (Zirkelbezug). Muss zu SYNC_TABLES passen.
const TRACKED = ['projects', 'times', 'materials', 'notes', 'photos', 'sketches', 'blobs', 'signatures', 'protocols'] as const;

interface Pending {
  key: string;
  table: string;
  id: string;
  deletedAt: number;
}

let suspended = 0;

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

    table.hook('creating', (_key, obj) => {
      if (suspended) return;
      const rec = obj as Record<string, unknown>;
      if (rec.updatedAt === undefined) rec.updatedAt = Date.now();
    });

    table.hook('updating', (mods) => {
      if (suspended) return;
      if ('updatedAt' in (mods as object)) return;
      return { updatedAt: Date.now() };
    });

    table.hook('deleting', (key, _obj, trans) => {
      if (suspended) return;
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

/** Führt fn aus, ohne dass die Hooks stempeln oder Löschvermerke schreiben (für das Einspielen/Zusammenführen). */
export async function withoutTracking<T>(fn: () => Promise<T>): Promise<T> {
  suspended++;
  try {
    return await fn();
  } finally {
    suspended--;
  }
}
