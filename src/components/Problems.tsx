import { Component, useEffect, useState, type ReactNode } from 'react';

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

/** Fängt Darstellungsfehler ab, damit nie nur ein weißer Bildschirm bleibt. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
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
      </div>
    );
  }
}
