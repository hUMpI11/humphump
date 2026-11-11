import { db, TABLES } from '../db';
import { prepareMerge, runPrepared, type MergeResult } from '../sync/merge';
import { FORBIDDEN_KEYS } from '../sync/validate';

/** CSV mit Semikolon + BOM, damit deutsches Excel es direkt richtig öffnet. */
export function toCsv(rows: (string | number | boolean)[][]): string {
  const cell = (v: string | number | boolean) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : typeof v === 'boolean' ? (v ? 'ja' : 'nein') : v;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

export type ShareResult = 'geteilt' | 'heruntergeladen' | 'abgebrochen';

/**
 * Teilen-Dialog (iOS) wenn möglich, sonst klassischer Download. 'abgebrochen' heißt: Die Datei wurde nicht
 * weitergegeben (Nutzer hat den Teilen-Dialog geschlossen) – wer eine Sicherung braucht, darf sie dann nicht als erstellt werten.
 */
export async function shareOrDownload(filename: string, blob: Blob): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'geteilt';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'abgebrochen';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'heruntergeladen';
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64ToBuf(b64: unknown): ArrayBuffer {
  if (typeof b64 !== 'string') throw new Error('Bilddaten fehlen oder haben ein falsches Format');
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new Error('Bilddaten sind nicht lesbar (kaputtes Base64)');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

type Json = Record<string, unknown>;

export function encodeRecord(rec: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(rec)) out[k] = v instanceof ArrayBuffer ? { __b64: bufToB64(v) } : v;
  return out;
}

export function decodeRecord(rec: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(rec)) {
    if ((FORBIDDEN_KEYS as readonly string[]).includes(k)) continue; // JSON.parse legt `__proto__` als eigenen Schlüssel an
    out[k] = v && typeof v === 'object' && '__b64' in v ? b64ToBuf((v as { __b64: unknown }).__b64) : v;
  }
  return out;
}

const BACKUP_FORMAT = 'baustellenbuch-backup';

export async function createBackup(): Promise<Blob> {
  // Stückweise zusammensetzen statt ein Riesen-String: schont den Speicher bei vielen Fotos.
  const parts: string[] = [`{"format":"${BACKUP_FORMAT}","version":1,"erstellt":"${new Date().toISOString()}","tables":{`];
  for (let t = 0; t < TABLES.length; t++) {
    const name = TABLES[t];
    parts.push(`${t ? ',' : ''}"${name}":[`);
    let first = true;
    await db.table(name).each((rec: Json) => {
      parts.push((first ? '' : ',') + JSON.stringify(encodeRecord(rec)));
      first = false;
    });
    parts.push(']');
  }
  parts.push('}}');
  return new Blob(parts, { type: 'application/json' });
}

const TOMBSTONE_MAX_AGE = 180 * 24 * 3600 * 1000;

/** Zweistufiges Einspielen: erst prüfen und zeigen, was passieren würde, dann anwenden. */
export interface RestorePlan {
  /** Was das Einspielen bewirken würde – ohne etwas zu verändern. */
  vorschau: MergeResult;
  /** Hinweis, wenn das Erstellungsdatum der Sicherung unplausibel ist (Zukunft, ungültig, vor 2024). */
  warnung?: string;
  /** Führt das Zusammenführen aus. Schreibt entweder alles oder nichts. */
  anwenden(): Promise<MergeResult>;
}

const FRUEHESTES_ERSTELLDATUM = Date.UTC(2024, 0, 1);
const MAX_BACKUP_BYTES = 500 * 1024 * 1024;

/**
 * Liest und prüft eine Sicherung vollständig (nichts wird geschrieben) und liefert die Vorschau.
 * `anwenden()` schreibt in einer einzigen Transaktion: entweder alles oder nichts.
 * Bewusste Grenze: Die Datei wird als Ganzes gelesen und dekodiert im Speicher gehalten (siehe merge.ts), daher das Größenlimit.
 * Sicherungen der Version 1 (ohne tombstones/protocols/updatedAt) funktionieren; fehlende Tabellen zählen als leer.
 */
export async function planRestore(file: Blob): Promise<RestorePlan> {
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error(`Die Datei ist zu groß (${Math.round(file.size / 1024 / 1024)} MB, erlaubt sind 500 MB). Sie kann auf diesem Gerät nicht sicher eingelesen werden.`);
  }
  let json: { format?: unknown; tables?: unknown; erstellt?: unknown };
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error('Die Datei ist keine lesbare Baustellenbuch-Sicherung (beschädigt oder abgeschnitten).');
  }
  const tabellen = json && typeof json === 'object' ? json.tables : undefined;
  if (!json || typeof json !== 'object' || json.format !== BACKUP_FORMAT || !tabellen || typeof tabellen !== 'object' || Array.isArray(tabellen)) {
    throw new Error('Das ist keine gültige Baustellenbuch-Sicherung.');
  }
  const tables: Record<string, Json[]> = {};
  for (const name of TABLES) {
    const rows = (tabellen as Record<string, unknown>)[name];
    if (Array.isArray(rows)) tables[name] = rows.filter((r): r is Json => !!r && typeof r === 'object' && !Array.isArray(r));
  }
  // Nichts in der Datei kann jünger sein als die Datei selbst. Zeitstempel, die mehr als 5 Minuten (Uhren-Toleranz,
  // MAX_FUTURE_MS) nach dem Erstellzeitpunkt liegen, werden deshalb auf diesen begrenzt (nicht auf „jetzt“) – sonst
  // würde dieselbe Datei bei jedem erneuten Einspielen wieder gegen inzwischen geänderte lokale Daten gewinnen.
  // Ist das Erstellungsdatum selbst unplausibel, gilt „jetzt“ als Bezug und der Nutzer wird gewarnt.
  const erstellt = typeof json.erstellt === 'string' ? Date.parse(json.erstellt) : NaN;
  const jetzt = Date.now();
  const unplausibel = !Number.isFinite(erstellt) || erstellt > jetzt || erstellt < FRUEHESTES_ERSTELLDATUM;
  const bezug = unplausibel ? jetzt : erstellt;
  const prepared = prepareMerge(tables, { decode: decodeRecord, now: bezug });
  const vorschau = await runPrepared(prepared, { dryRun: true });
  return {
    vorschau,
    warnung: unplausibel ? 'Sicherungsdatum unplausibel: Das Erstellungsdatum der Datei fehlt, liegt in der Zukunft oder vor 2024. Prüfe die Uhr der Geräte und ob dies die richtige Datei ist.' : undefined,
    async anwenden() {
      const result = await runPrepared(prepared);
      // Alte Löschvermerke aufräumen: nach so langer Zeit ist ein Gerät mit altem Stand nicht mehr zu erwarten.
      // Eigenes try/catch: Das Zusammenführen ist hier schon geschrieben und darf nicht als gescheitert gemeldet werden.
      try {
        await db.tombstones.where('key').above('').filter((t) => t.deletedAt < Date.now() - TOMBSTONE_MAX_AGE).delete();
      } catch {
        /* Aufräumen holt der nächste Einspielvorgang nach */
      }
      return result;
    },
  };
}

/** Spielt eine Sicherung ein (Abkürzung für planRestore + anwenden), siehe src/sync/merge.ts. */
export async function restoreBackup(file: Blob): Promise<MergeResult> {
  return (await planRestore(file)).anwenden();
}

/** Text über den Teilen-Dialog weitergeben (WhatsApp, Mail …), ersatzweise in die Zwischenablage. */
export async function shareText(title: string, text: string): Promise<'geteilt' | 'kopiert' | 'abgebrochen' | 'fehler'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'geteilt';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'abgebrochen';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'kopiert';
  } catch {
    return 'fehler';
  }
}
