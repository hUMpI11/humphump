import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_PROFIL, DEFAULT_RUNDUNG, getSetting, setSetting, type Profil } from '../db';
import { createBackup, restoreBackup, shareOrDownload } from '../lib/export';
import type { MergeResult } from '../sync/merge';
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

  async function backup() {
    setBusy(true);
    setMsg('');
    try {
      const blob = await createBackup();
      await shareOrDownload(`Baustellenbuch_Sicherung_${isoDate()}.json`, blob);
      await setSetting('letzteSicherung', isoDate());
    } catch (e) {
      setMsg('Sicherung fehlgeschlagen: ' + (e as Error).message);
    }
    setBusy(false);
  }

  async function restore(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!window.confirm('Sicherung einspielen? Sie wird mit deinen Daten zusammengeführt: Je Eintrag gilt der neuere Stand, Löschungen aus der Sicherung werden übernommen, nichts Neueres geht verloren.')) return;
    setBusy(true);
    try {
      const r: MergeResult = await restoreBackup(f);
      setProfil(undefined); // Profil aus der Sicherung neu laden
      setMsg(`Sicherung zusammengeführt: ${r.neu} neu, ${r.aktualisiert} aktualisiert, ${r.geloescht} gelöscht, ${r.behalten} unverändert.`);
    } catch (err) {
      setMsg('Einspielen fehlgeschlagen: ' + (err as Error).message);
    }
    setBusy(false);
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
          <p className="muted">Letzte Sicherung: {lastBackup ? fmtDate(lastBackup) : 'noch nie'}</p>
          <div className="button-col">
            <button type="button" className="btn primary" onClick={backup} disabled={busy}>
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
