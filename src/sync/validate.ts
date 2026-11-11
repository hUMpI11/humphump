/*
 * Prüfung einer Sicherungsdatei, Zeile für Zeile. Reine Funktionen ohne Datenbank.
 *
 * Eine Sicherung ist eine nicht vertrauenswürdige Eingabe (anderes Gerät, falsche Uhr, beschädigte oder präparierte
 * Datei). Jede Zeile wird gegen das Schema aus src/db.ts geprüft und in eine neue, saubere Zeile kopiert: Unbekannte
 * Felder fallen weg, Typen und Größen sind begrenzt. Was nicht passt, wird verworfen – die übrigen Zeilen bleiben gültig.
 * Die Grenzen sind großzügig gewählt (reale Daten liegen weit darunter) und dienen nur dazu, offensichtlichen Unsinn
 * und Speicherbomben abzuweisen.
 */

type Rec = Record<string, unknown>;

export const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'] as const;
const isForbidden = (k: string) => (FORBIDDEN_KEYS as readonly string[]).includes(k);

/** Zeitstempel aus der Datei, die weiter als das in der Zukunft liegen, gelten als falsch gestellte Uhr. */
export const MAX_FUTURE_MS = 24 * 3600 * 1000;

/** Tabellen mit Datensätzen, für die Löschvermerke zulässig sind. */
export const VALID_TOMBSTONE_TABLES = ['projects', 'times', 'materials', 'notes', 'photos', 'sketches', 'blobs', 'signatures', 'protocols'];

const MB = 1024 * 1024;
const MAX_ID = 100;
const MAX_SHORT = 500;
const MAX_TEXT = 50_000;
const MAX_THUMB = 5 * MB;
const MAX_SIGNATURE = 5 * MB;
const MAX_BLOB = 40 * MB;
const MAX_STROKES = 5000;
const MAX_POINTS_TOTAL = 400_000;
const MAX_VALUES_JSON = 2 * MB;

/**
 * Kopiert ein dekodiertes JSON-Objekt ohne die Schlüssel `__proto__`, `constructor`, `prototype` (rekursiv, auch in
 * Feldern und Listen). JSON.parse legt `__proto__` als eigenen Schlüssel an; ein naives Kopieren würde den Prototyp setzen.
 */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 12) return null;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof ArrayBuffer)) {
    const out: Rec = {};
    for (const [k, v] of Object.entries(value as Rec)) {
      if (isForbidden(k)) continue;
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Ein Zeitstempel: nur endliche, nicht negative Zahlen; mehr als 24 h in der Zukunft wird auf „jetzt“ begrenzt. */
export function limitTimestamp(v: unknown, now: number): { value: number | undefined; korrigiert: boolean } {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return { value: undefined, korrigiert: false };
  if (v > now + MAX_FUTURE_MS) return { value: now, korrigiert: true };
  return { value: v, korrigiert: false };
}

// --- Feldprüfer: liefern den (ggf. bereinigten) Wert oder INVALID ---------------------------------------------

const INVALID = Symbol('invalid');
type Check = (v: unknown) => unknown;

const str = (max = MAX_SHORT): Check => (v) => (typeof v === 'string' && v.length <= max ? v : INVALID);
const id = (max = MAX_ID): Check => (v) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : INVALID);
const num = (min: number, max: number): Check => (v) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : INVALID);
const bool: Check = (v) => (typeof v === 'boolean' ? v : INVALID);
const oneOf = (...allowed: string[]): Check => (v) => (typeof v === 'string' && allowed.includes(v) ? v : INVALID);
const datum: Check = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : INVALID);
const uhrzeit: Check = (v) => (typeof v === 'string' && (v === '' || /^\d{1,2}:\d{2}$/.test(v)) ? v : INVALID);
const buffer = (max: number): Check => (v) => (v instanceof ArrayBuffer && v.byteLength <= max ? v : INVALID);
const nullable = (c: Check): Check => (v) => (v === null ? null : c(v));
const strList = (maxItems: number, maxLen: number): Check => (v) => {
  if (!Array.isArray(v) || v.length > maxItems) return INVALID;
  return v.every((s) => typeof s === 'string' && s.length <= maxLen) ? v : INVALID;
};

const TOOLS = ['pen', 'line', 'rect', 'text', 'eraser'];
function strokes(v: unknown): unknown {
  if (!Array.isArray(v) || v.length > MAX_STROKES) return INVALID;
  let points = 0;
  const out: Rec[] = [];
  for (const s of v) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return INVALID;
    const st = s as Rec;
    if (typeof st.tool !== 'string' || !TOOLS.includes(st.tool)) return INVALID;
    if (str(50)(st.color) === INVALID || num(0, 1000)(st.width) === INVALID) return INVALID;
    if (!Array.isArray(st.points)) return INVALID;
    points += st.points.length;
    if (points > MAX_POINTS_TOTAL) return INVALID;
    for (const p of st.points) {
      if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e6)) return INVALID;
    }
    if (st.text !== undefined && str(2000)(st.text) === INVALID) return INVALID;
    const clean: Rec = { tool: st.tool, color: st.color, width: st.width, points: st.points };
    if (st.text !== undefined) clean.text = st.text;
    out.push(clean);
  }
  return out;
}

function protokollWerte(v: unknown): unknown {
  if (!v || typeof v !== 'object' || Array.isArray(v) || v instanceof ArrayBuffer) return INVALID;
  if (Object.keys(v as Rec).length > 2000) return INVALID;
  try {
    return JSON.stringify(v).length <= MAX_VALUES_JSON ? v : INVALID;
  } catch {
    return INVALID;
  }
}

interface Spec {
  required: Record<string, Check>;
  optional?: Record<string, Check>;
}

const STATUS = oneOf('aktiv', 'abgeschlossen');

const SPECS: Record<string, Spec> = {
  projects: {
    required: { id: id(), name: str(200), kunde: str(), adresse: str(), auftragsnr: str(), gewerke: strList(50, 100), status: STATUS, beschreibung: str(MAX_TEXT) },
    optional: { ansprechpartner: str(), abgerechnet: bool, telefon: str(100) },
  },
  times: {
    required: {
      id: id(), projectId: id(), datum, mitarbeiter: str(200), von: uhrzeit, bis: uhrzeit, pauseMin: num(0, 24 * 60), minuten: num(0, 100_000),
      taetigkeit: str(MAX_TEXT), gewerk: str(100), regie: bool,
    },
    optional: { fahrtKm: num(0, 100_000) },
  },
  materials: {
    required: { id: id(), projectId: id(), datum, bezeichnung: str(), menge: num(-1e9, 1e9), einheit: str(50), artikelnr: str(200), gewerk: str(100), regie: bool },
  },
  notes: {
    required: { id: id(), projectId: id(), datum, titel: str(), text: str(MAX_TEXT) },
    optional: { todo: bool, done: bool },
  },
  signatures: {
    required: { id: id(), projectId: id(), name: str(200), von: str(50), bis: str(50), data: buffer(MAX_SIGNATURE) },
    optional: { nurRegie: bool },
  },
  photos: {
    required: { id: id(), projectId: id(), datum, caption: str(2000), thumb: buffer(MAX_THUMB) },
  },
  sketches: {
    required: {
      id: id(), projectId: id(), titel: str(), width: num(1, 8192), height: num(1, 8192), strokes, hasBackground: bool, thumb: nullable(buffer(MAX_THUMB)),
    },
  },
  blobs: {
    required: { id: id(MAX_ID + 3), projectId: id(), data: buffer(MAX_BLOB), mime: oneOf('image/jpeg', 'image/png') },
  },
  protocols: {
    required: {
      id: id(), projectId: id(), templateId: id(), templateVersion: num(0, 100_000), titel: str(), datum, values: protokollWerte, abgeschlossen: bool,
    },
  },
};

const TIME_FIELDS = ['createdAt', 'updatedAt'] as const;

export interface GeprueftEntry {
  rec: Rec;
  /** Anzahl auf „jetzt“ begrenzter Zeitstempel */
  korrigiert: number;
}

/**
 * Prüft eine dekodierte Zeile. Liefert eine bereinigte Kopie oder null (verwerfen).
 * Ungültige oder negative Zeitstempel gelten als fehlend; Zeitstempel in der Zukunft werden begrenzt.
 */
export function validateRecord(table: string, input: unknown, now = Date.now()): GeprueftEntry | null {
  const spec = SPECS[table];
  if (!spec || !input || typeof input !== 'object' || Array.isArray(input)) return null;
  const rec = input as Rec;
  const out: Rec = {};
  for (const [k, check] of Object.entries(spec.required)) {
    const v = check(rec[k]);
    if (v === INVALID) return null;
    out[k] = v;
  }
  for (const [k, check] of Object.entries(spec.optional ?? {})) {
    if (rec[k] === undefined) continue;
    const v = check(rec[k]);
    if (v === INVALID) return null;
    out[k] = v;
  }
  let korrigiert = 0;
  for (const k of TIME_FIELDS) {
    if (rec[k] === undefined) continue;
    const t = limitTimestamp(rec[k], now);
    if (t.value !== undefined) out[k] = t.value;
    if (t.korrigiert) korrigiert++;
  }
  return { rec: out, korrigiert };
}

export interface GeprueftTombstone {
  tomb: { key: string; table: string; id: string; deletedAt: number };
  korrigiert: number;
}

/** Löschvermerk: Schlüssel `tabelle:id` muss zu table/id passen; ungültiger deletedAt = Vermerk wird ignoriert. */
export function validateTombstone(input: unknown, now = Date.now()): GeprueftTombstone | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const t = input as Rec;
  if (typeof t.key !== 'string' || t.key.length > 200) return null;
  const sep = t.key.indexOf(':');
  if (sep <= 0) return null;
  const table = t.key.slice(0, sep);
  const rid = t.key.slice(sep + 1);
  if (!VALID_TOMBSTONE_TABLES.includes(table) || rid.length === 0 || rid.length > MAX_ID + 3) return null;
  if ((t.table !== undefined && t.table !== table) || (t.id !== undefined && t.id !== rid)) return null;
  const d = limitTimestamp(t.deletedAt, now);
  if (d.value === undefined) return null;
  return { tomb: { key: t.key, table, id: rid, deletedAt: d.value }, korrigiert: d.korrigiert ? 1 : 0 };
}

export interface ProfilWert {
  name: string;
  firma: string;
  rundung: 0 | 5 | 10 | 15 | 30;
}

/** `profil` nur als { name, firma, rundung ∈ {0,5,10,15,30} (fehlend = 15) }; sonst null. */
export function validateProfil(v: unknown): ProfilWert | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const p = v as Rec;
  if (str(200)(p.name) === INVALID || str(200)(p.firma) === INVALID) return null;
  // Ohne Angabe gilt der App-Standard (DEFAULT_RUNDUNG in db.ts = 15); das Feld ist im Typ `Profil` optional.
  const rundung = p.rundung === undefined ? 15 : p.rundung;
  if (typeof rundung !== 'number' || ![0, 5, 10, 15, 30].includes(rundung)) return null;
  return { name: p.name as string, firma: p.firma as string, rundung: rundung as ProfilWert['rundung'] };
}
