import type Dexie from 'dexie';

// GERÜST – wird von Arbeitspaket „Geräteabgleich“ implementiert. Signaturen bleiben stabil.

/**
 * Hängt Dexie-Hooks an alle SYNC_TABLES:
 *  - creating/updating: `updatedAt` stempeln (falls der Aufrufer es nicht selbst setzt)
 *  - deleting: Löschvermerk in `tombstones` schreiben
 * Wird einmal aus db.ts aufgerufen. Darf db.ts NICHT importieren (Zirkelbezug) – nur den Parameter nutzen.
 */
export function installChangeTracking(_db: Dexie): void {}

/** Führt fn aus, ohne dass die Hooks stempeln oder Löschvermerke schreiben (für das Einspielen/Zusammenführen). */
export async function withoutTracking<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}
