import { Component, useEffect, useState, type ReactNode } from 'react';
import { createBackup, shareOrDownload } from '../lib/export';
import { isoDate } from '../lib/util';
import Settings from '../views/Settings';

/** Zeigt fehlgeschlagene Speichervorgänge an, statt sie stillschweigend zu verschlucken. */
export function GlobalErrors() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const onReject = (e: PromiseRejectionEvent) => {
      const err = e.reason as { name?: string; message?: string; inner?: { name?: string } } | undefined;
      const names = `${err?.name ?? ''} ${err?.inner?.name ?? ''} ${err?.message ?? ''}`;
      // Nur Datenbankfehler melden – ein fehlgeschlagener Update-Check o. Ä. ist kein Datenverlust.
      if (!/quota|dexie|transaction|database|constraint|dataerror|invalidstate|aborterror|openfailed|versionerror|unknownerror/i.test(names)) return;
      setMsg(
        /quota/i.test(names)
          ? 'Nicht gespeichert: Der Speicher des Geräts ist voll. Bitte Sicherung erstellen und alte Fotos oder abgeschlossene Baustellen löschen.'
          : `Nicht gespeichert – bitte erneut versuchen. (${err?.message ?? 'unbekannter Fehler'})`,
      );
    };
    window.addEventListener('unhandledrejection', onReject);
    return () => window.removeEventListener('unhandledrejection', onReject);
  }, []);
  if (!msg) return null;
  return (
    <div className="toast" role="alert">
      <span>{msg}</span>
      <button type="button" className="link strong" onClick={() => setMsg('')}>
        OK
      </button>
    </div>
  );
}

/** Notausgang: Sicherung auch dann möglich, wenn eine Ansicht wegen eines kaputten Datensatzes abstürzt. */
function Notausgang({ onSettings }: { onSettings: () => void }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function sichern() {
    setBusy(true);
    setMsg('');
    try {
      await shareOrDownload(`Baustellenbuch_Sicherung_${isoDate()}.json`, await createBackup());
      setMsg('Sicherung erstellt.');
    } catch (e) {
      setMsg('Sicherung fehlgeschlagen: ' + (e as Error).message);
    }
    setBusy(false);
  }
  return (
    <>
      <div className="button-col">
        <button type="button" className="btn" onClick={() => void sichern()} disabled={busy}>
          Sicherung erstellen
        </button>
        <a className="btn" href="#/einstellungen" onClick={onSettings}>
          Zu den Einstellungen
        </a>
      </div>
      {msg && <p className="calc" role="status">{msg}</p>}
      <p className="muted">
        Stürzt die App immer wieder ab, erstelle zuerst eine Sicherung. Über Einstellungen → „Alle Daten auf diesem Gerät löschen“ lässt sich anschließend ein Neuanfang erzwingen.
      </p>
    </>
  );
}

/** Fängt Darstellungsfehler ab, damit nie nur ein weißer Bildschirm bleibt. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; notfall: boolean }> {
  state = { error: null as Error | null, notfall: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.beiAdressWechsel);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.beiAdressWechsel);
  }

  /** Verlässt der Nutzer die Einstellungen, wird die App wieder normal versucht. */
  private beiAdressWechsel = () => {
    if (this.state.notfall && window.location.hash !== '#/einstellungen') this.setState({ error: null, notfall: false });
  };

  render() {
    if (!this.state.error) return this.props.children;
    // Notfallansicht: nur die Einstellungen, ohne die Baustellenliste. Die Liste ist in jeder Ansicht
    // eingebaut – ein kaputter Datensatz würde sonst auch die Einstellungen zum Absturz bringen.
    if (this.state.notfall) {
      return (
        <div className="app is-detail">
          <main className="main">
            <Settings />
          </main>
        </div>
      );
    }
    return (
      <div className="empty crash">
        <h3>Da ist etwas schiefgelaufen</h3>
        <p>Deine erfassten Daten sind davon nicht betroffen – sie liegen sicher auf dem Gerät.</p>
        <p className="muted">{this.state.error.message}</p>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            window.location.hash = '#/';
            window.location.reload();
          }}
        >
          App neu laden
        </button>
        <Notausgang onSettings={() => this.setState({ notfall: true })} />
      </div>
    );
  }
}
