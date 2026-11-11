import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_PROFIL, DEFAULT_RUNDUNG, db, getSetting, setSetting, type Profil } from '../db';
import { createBackup, planRestore, shareOrDownload } from '../lib/export';
import { formatMergeResult } from '../sync/merge';
import { fmtDate, isoDate } from '../lib/util';
import { Field, Header } from '../components/ui';

const mb = (bytes: number) => (bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' MB';

export default function Settings() {
  const stored = useLiveQuery(() => getSetting<Profil>('profil', DEFAULT_PROFIL), []);
  const lastBackup = useLiveQuery(() => getSetting<string>('letzteSicherung', ''), []);
  const [profil, setProfil] = useState<Profil>();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean }>();
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stored && !profil) setProfil(stored);
  }, [stored, profil]);

  useEffect(() => {
    (async () => {
      const est = await navigator.storage?.estimate?.();
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      if (est) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted });
    })().catch(() => undefined);
  }, [busy]);

  const update = (patch: Partial<Profil>) => {
    const next = { ...(profil ?? DEFAULT_PROFIL), ...patch };
    setProfil(next);
    void setSetting('profil', next);
  };

  /** Liefert true nur, wenn die Sicherung wirklich weitergegeben wurde (geteilt oder heruntergeladen); bei Abbruch false. */
  async function backup(): Promise<boolean> {
    setBusy(true);
    setMsg('');
    try {
      const blob = await createBackup();
      const ergebnis = await shareOrDownload(`Baustellenbuch_Sicherung_${isoDate()}.json`, blob);
      if (ergebnis === 'abgebrochen') {
        setMsg('Sicherung abgebrochen. Es wurde keine Sicherung erstellt.');
        setBusy(false);
        return false;
      }
      await setSetting('letzteSicherung', isoDate());
      setBusy(false);
      return true;
    } catch (e) {
      setMsg('Sicherung fehlgeschlagen: ' + (e as Error).message);
      setBusy(false);
      return false;
    }
  }

  async function restore(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setMsg('');
    try {
      // Schritt 1: Datei prüfen und Vorschau rechnen – verändert nichts.
      const plan = await planRestore(f);
      const v = plan.vorschau;
      const frage =
        (plan.warnung ? `Warnung: ${plan.warnung}\n\n` : '') +
        `Diese Sicherung würde Folgendes bewirken:\n${formatMergeResult(v)}.` +
        (v.geloescht > 0 ? `\n\nAchtung: ${v.geloescht} ${v.geloescht === 1 ? 'Eintrag wird' : 'Einträge werden'} auf diesem Gerät gelöscht.` : '') +
        '\n\nJe Eintrag gilt der neuere Stand. Fortfahren?';
      if (!window.confirm(frage)) {
        setMsg('Einspielen abgebrochen. Es wurde nichts verändert.');
        setBusy(false);
        return;
      }
      // Schritt 2: anwenden.
      const r = await plan.anwenden();
      setProfil(undefined); // Profil aus der Sicherung neu laden
      setMsg(`Sicherung zusammengeführt: ${formatMergeResult(r)}.`);
    } catch (err) {
      setMsg('Einspielen fehlgeschlagen: ' + (err as Error).message + ' Deine Daten auf diesem Gerät sind unverändert.');
    }
    setBusy(false);
  }

  async function alleLoeschen() {
    if (window.confirm('Vor dem Löschen eine Sicherung erstellen? „OK“ erstellt jetzt eine Sicherung. „Abbrechen“ löscht noch nichts; ohne Sicherung geht es nur nach ausdrücklicher Bestätigung weiter.')) {
      if (!(await backup())) return; // Sicherung fehlgeschlagen oder abgebrochen: nichts löschen
    } else if (!window.confirm('Ohne Sicherung weitermachen? Die Daten sind danach unwiederbringlich verloren. „OK“ bestätigt den Verzicht auf die Sicherung, „Abbrechen“ löscht nichts.')) {
      return;
    }
    if (!window.confirm('Wirklich ALLE Daten auf diesem Gerät löschen? Das kann nicht rückgängig gemacht werden.')) return;
    let n = 0;
    try {
      n = await db.projects.count();
    } catch {
      /* Zahl nur für die Rückfrage */
    }
    if (!window.confirm(`Letzte Rückfrage: ${n} ${n === 1 ? 'Baustelle' : 'Baustellen'} mit allen Stunden, Materialien, Notizen, Fotos, Skizzen, Unterschriften und Protokollen werden endgültig gelöscht. Jetzt löschen?`)) return;
    setBusy(true);
    try {
      await db.delete();
      window.location.hash = '#/';
      window.location.reload();
    } catch (e) {
      setMsg('Löschen fehlgeschlagen: ' + (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="Einstellungen" back="/" />
      <div className="scroll page form">
        <section className="card block">
          <h2>Profil</h2>
          <Field label="Dein Name" hint="Wird bei neuen Stundeneinträgen als Mitarbeiter vorbelegt.">
            <input value={profil?.name ?? ''} onChange={(e) => update({ name: e.target.value })} autoComplete="name" />
          </Field>
          <Field label="Firma" hint="Erscheint im Kopf der Berichte.">
            <input value={profil?.firma ?? ''} onChange={(e) => update({ firma: e.target.value })} autoComplete="organization" />
          </Field>
          <Field label="Timer-Zeiten runden auf" hint="Beginn und Ende werden beim Stoppen gerundet; vor dem Speichern noch änderbar.">
            <select value={profil?.rundung ?? DEFAULT_RUNDUNG} onChange={(e) => update({ rundung: Number(e.target.value) })}>
              <option value={0}>nicht runden</option>
              <option value={5}>5 Minuten</option>
              <option value={10}>10 Minuten</option>
              <option value={15}>15 Minuten</option>
              <option value={30}>30 Minuten</option>
            </select>
          </Field>
        </section>

        <section className="card block">
          <h2>Datensicherung</h2>
          <p className="warnbox">
            <strong>Wichtig:</strong> Alle Daten liegen nur auf diesem Gerät. Es gibt keine Cloud. Geht das Gerät verloren oder werden die Website-Daten gelöscht, sind die Daten weg.
            Sichere regelmäßig – z. B. in „Dateien“/iCloud Drive. Beim Einspielen wird die Sicherung mit den vorhandenen Daten zusammengeführt.
          </p>
          <p className="warnbox">
            <strong>Vorsicht, vertrauliche Daten:</strong> Die Sicherungsdatei enthält Kunden- und Mitarbeiterdaten (Namen, Adressen, Telefonnummern, Arbeitszeiten, Unterschriften, Fotos){' '}
            <strong>unverschlüsselt</strong>. Nur an eigene Geräte weitergeben, an einem sicheren Ort ablegen und nicht mehr benötigte Dateien löschen.
          </p>
          <p className="muted">Letzte Sicherung: {lastBackup ? fmtDate(lastBackup) : 'noch nie'}</p>
          <div className="button-col">
            <button type="button" className="btn primary" onClick={() => void backup()} disabled={busy}>
              {busy ? 'Bitte warten …' : 'Sicherung erstellen'}
            </button>
            <button type="button" className="btn" onClick={() => file.current?.click()} disabled={busy}>
              Sicherung einspielen
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={restore} />
          </div>
          {msg && <p className="calc">{msg}</p>}
          {storage && (
            <p className="muted">
              Speicher: {mb(storage.usage)} belegt{storage.quota ? ` von ca. ${mb(storage.quota)}` : ''} · Schutz vor automatischem Löschen:{' '}
              {storage.persisted ? 'aktiv' : 'nicht zugesichert'}
            </p>
          )}
        </section>

        <section className="card block danger-zone">
          <h2>Gefahrenbereich</h2>
          <p>
            Löscht alle Baustellen und Einträge auf diesem Gerät vollständig. Sicherungsdateien, die du außerhalb der App abgelegt hast (z. B. in „Dateien“ oder iCloud Drive), bleiben bestehen.
          </p>
          <button type="button" className="btn danger-solid" onClick={() => void alleLoeschen()} disabled={busy}>
            Alle Daten auf diesem Gerät löschen
          </button>
        </section>

        <section className="card block">
          <h2>iPhone ↔ iPad abgleichen</h2>
          <ol className="steps">
            <li>Auf dem ersten Gerät <strong>„Sicherung erstellen“</strong> und die Datei in „Dateien“/iCloud Drive ablegen oder per AirDrop senden.</li>
            <li>Auf dem zweiten Gerät <strong>„Sicherung einspielen“</strong> und die Datei wählen. Neue und neuere Einträge werden übernommen, Löschungen wandern mit.</li>
            <li>Danach dasselbe in die andere Richtung, damit beide Geräte denselben Stand haben.</li>
          </ol>
          <p className="muted">
            Grenzen: Die Uhren beider Geräte müssen stimmen (Datum und Uhrzeit automatisch). Zusammengeführt wird je Eintrag, nicht je Feld: Wurde derselbe Eintrag auf beiden Geräten
            geändert, gewinnt der spätere Stand komplett.
          </p>
        </section>

        <section className="card block">
          <h2>Auf dem iPhone / iPad installieren</h2>
          <ol className="steps">
            <li>Diese Seite in <strong>Safari</strong> öffnen.</li>
            <li>
              <strong>Teilen</strong>-Symbol antippen → <strong>„Zum Home-Bildschirm“</strong>.
            </li>
            <li>Die App vom Home-Bildschirm starten – sie läuft dann im Vollbild und auch ohne Netz.</li>
          </ol>
          <p className="muted">Version {__APP_VERSION__}</p>
        </section>
      </div>
    </>
  );
}
