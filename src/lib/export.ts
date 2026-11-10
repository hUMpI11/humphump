import { db, TABLES } from '../db';

/** CSV mit Semikolon + BOM, damit deutsches Excel es direkt richtig öffnet. */
export function toCsv(rows: (string | number | boolean)[][]): string {
  const cell = (v: string | number | boolean) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : typeof v === 'boolean' ? (v ? 'ja' : 'nein') : v;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Teilen-Dialog (iOS) wenn möglich, sonst klassischer Download. */
export async function shareOrDownload(filename: string, blob: Blob) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return; // Nutzer hat abgebrochen
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
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
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
    out[k] = v && typeof v === 'object' && '__b64' in v ? b64ToBuf((v as { __b64: string }).__b64) : v;
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

/** Spielt ein Backup ein. Vorhandene Datensätze mit gleicher id werden überschrieben, sonst wird ergänzt. */
export async function restoreBackup(file: Blob): Promise<number> {
  const json = JSON.parse(await file.text()) as { format?: string; tables?: Record<string, Json[]> };
  if (json.format !== BACKUP_FORMAT || !json.tables) throw new Error('Das ist keine gültige Baustellenbuch-Sicherung.');
  let count = 0;
  for (const name of TABLES) {
    const rows = json.tables[name];
    if (!Array.isArray(rows)) continue;
    // Timer nicht übernehmen – der gehört zum Gerät, auf dem er lief.
    const decoded = rows.map(decodeRecord).filter((r) => !(name === 'settings' && r.key === 'timer'));
    await db.table(name).bulkPut(decoded);
    count += decoded.length;
  }
  return count;
}
