import Dexie, { type EntityTable } from 'dexie';

export type ProjectStatus = 'aktiv' | 'abgeschlossen';

export interface Project {
  id: string;
  name: string;
  kunde: string;
  adresse: string;
  auftragsnr: string;
  gewerke: string[];
  status: ProjectStatus;
  beschreibung: string;
  createdAt: number;
  updatedAt: number;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  datum: string; // YYYY-MM-DD
  mitarbeiter: string;
  von: string; // HH:MM oder ''
  bis: string;
  pauseMin: number;
  minuten: number; // Netto-Arbeitszeit
  taetigkeit: string;
  gewerk: string;
  regie: boolean;
  createdAt: number;
}

export interface MaterialEntry {
  id: string;
  projectId: string;
  datum: string;
  bezeichnung: string;
  menge: number;
  einheit: string;
  artikelnr: string;
  gewerk: string;
  regie: boolean;
  createdAt: number;
}

export interface Note {
  id: string;
  projectId: string;
  datum: string;
  titel: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

/** Foto-Metadaten + Vorschaubild. Das Vollbild liegt in `blobs` unter derselben id. */
export interface Photo {
  id: string;
  projectId: string;
  datum: string;
  caption: string;
  thumb: ArrayBuffer;
  createdAt: number;
}

export type SketchTool = 'pen' | 'line' | 'rect' | 'text' | 'eraser';

export interface Stroke {
  tool: SketchTool;
  color: string;
  width: number;
  points: [number, number][];
  text?: string;
}

/**
 * Skizze als Vektordaten (bleibt editierbar). Gerendertes Bild liegt in `blobs`
 * unter der id, ein optionales Hintergrundfoto unter `${id}:bg`.
 */
export interface Sketch {
  id: string;
  projectId: string;
  titel: string;
  width: number;
  height: number;
  strokes: Stroke[];
  hasBackground: boolean;
  thumb: ArrayBuffer | null;
  createdAt: number;
  updatedAt: number;
}

/** Große Binärdaten getrennt, damit Listen nicht alle Vollbilder laden. */
export interface BlobRecord {
  id: string;
  projectId: string;
  data: ArrayBuffer; // ArrayBuffer statt Blob: robuster in iOS-IndexedDB
  mime: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface Profil {
  name: string;
  firma: string;
}

export interface RunningTimer {
  projectId: string;
  start: number;
}

export const db = new Dexie('baustellenbuch') as Dexie & {
  projects: EntityTable<Project, 'id'>;
  times: EntityTable<TimeEntry, 'id'>;
  materials: EntityTable<MaterialEntry, 'id'>;
  notes: EntityTable<Note, 'id'>;
  photos: EntityTable<Photo, 'id'>;
  sketches: EntityTable<Sketch, 'id'>;
  blobs: EntityTable<BlobRecord, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

db.version(1).stores({
  projects: 'id, status, updatedAt',
  times: 'id, projectId, datum',
  materials: 'id, projectId, datum',
  notes: 'id, projectId, datum',
  photos: 'id, projectId, datum',
  sketches: 'id, projectId, updatedAt',
  blobs: 'id, projectId',
  settings: 'key',
});

export const TABLES = ['projects', 'times', 'materials', 'notes', 'photos', 'sketches', 'blobs', 'settings'] as const;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value });
}

export const DEFAULT_PROFIL: Profil = { name: '', firma: '' };

export function touchProject(id: string) {
  return db.projects.update(id, { updatedAt: Date.now() });
}

export async function deleteProject(id: string) {
  await db.transaction('rw', [db.projects, db.times, db.materials, db.notes, db.photos, db.sketches, db.blobs, db.settings], async () => {
    await Promise.all([
      db.times.where('projectId').equals(id).delete(),
      db.materials.where('projectId').equals(id).delete(),
      db.notes.where('projectId').equals(id).delete(),
      db.photos.where('projectId').equals(id).delete(),
      db.sketches.where('projectId').equals(id).delete(),
      db.blobs.where('projectId').equals(id).delete(),
    ]);
    const timer = await db.settings.get('timer');
    if (timer && (timer.value as RunningTimer | null)?.projectId === id) await db.settings.delete('timer');
    await db.projects.delete(id);
  });
}
