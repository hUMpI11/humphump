import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting, type RunningTimer } from '../db';
import { gewerkName } from '../gewerke';
import { addDays, fmtDate, fmtHours, hhmm, isoDate, weekStart } from '../lib/util';
import { Empty, Header, Icon } from '../components/ui';

export default function ProjectList({ activeId }: { activeId?: string }) {
  const [query, setQuery] = useState('');
  const [showDone, setShowDone] = useState(false);

  const data = useLiveQuery(async () => {
    const [projects, times, notes, timer, lastBackup] = await Promise.all([
      db.projects.toArray(),
      db.times.toArray(),
      db.notes.toArray(),
      getSetting<RunningTimer | null>('timer', null),
      getSetting<string>('letzteSicherung', ''),
    ]);
    const today = isoDate();
    const monday = weekStart(today);
    const minutes = new Map<string, number>();
    const offen = new Map<string, number>();
    let heute = 0;
    let woche = 0;
    for (const t of times) {
      minutes.set(t.projectId, (minutes.get(t.projectId) ?? 0) + t.minuten);
      if (t.datum === today) heute += t.minuten;
      if (t.datum >= monday && t.datum <= addDays(monday, 6)) woche += t.minuten;
    }
    for (const n of notes) if (n.todo && !n.done) offen.set(n.projectId, (offen.get(n.projectId) ?? 0) + 1);
    // Ohne Sicherung reicht ein verlorenes Handy, und alle Nachweise sind weg – also erinnern.
    const backupFaellig = times.length + notes.length > 0 && (!lastBackup || lastBackup < addDays(today, -7));
    return { projects: projects.sort((a, b) => b.updatedAt - a.updatedAt), minutes, offen, heute, woche, timer, backupFaellig, lastBackup };
  }, []);

  const q = query.trim().toLowerCase();
  const all = data?.projects ?? [];
  const visible = all.filter(
    (p) =>
      (showDone ? p.status === 'abgeschlossen' : p.status === 'aktiv') &&
      (!q || [p.name, p.kunde, p.adresse, p.auftragsnr].some((s) => s.toLowerCase().includes(q))),
  );
  const doneCount = all.filter((p) => p.status === 'abgeschlossen').length;
  const unbilled = all.filter((p) => p.status === 'abgeschlossen' && !p.abgerechnet).length;

  return (
    <>
      <Header
        title="Baustellen"
        actions={
          <>
            <a className="hbtn" href="#/einstellungen" aria-label="Einstellungen">
              <Icon name="settings" />
            </a>
            <a className="hbtn accent" href="#/neu" aria-label="Neue Baustelle">
              <Icon name="plus" />
            </a>
          </>
        }
      />
      <div className="scroll">
        <div className="list-tools">
          <input type="search" placeholder="Suchen (Name, Kunde, Adresse, Nr.)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="segmented">
            <button type="button" className={!showDone ? 'on' : ''} onClick={() => setShowDone(false)}>
              Aktiv
            </button>
            <button type="button" className={showDone ? 'on' : ''} onClick={() => setShowDone(true)}>
              Abgeschlossen{doneCount ? ` (${doneCount})` : ''}
            </button>
          </div>
        </div>

        {data && all.length > 0 && (
          <div className="home-info">
            {data.timer && (
              <a className="card timer running" href={`#/p/${data.timer.projectId}/stunden`}>
                <div>
                  <strong>Zeit läuft</strong>
                  <span className="muted">
                    {all.find((p) => p.id === data.timer!.projectId)?.name ?? 'Baustelle'} · seit {isoDate(new Date(data.timer.start)) === isoDate() ? '' : `${fmtDate(isoDate(new Date(data.timer.start)))}, `}
                    {hhmm(new Date(data.timer.start))} Uhr
                  </span>
                </div>
                <Icon name="chevron" size={18} />
              </a>
            )}
            <a className="card today" href="#/woche">
              <span>
                <span className="num">{fmtHours(data.heute)}</span> heute
              </span>
              <span>
                <span className="num">{fmtHours(data.woche)}</span> diese Woche
              </span>
              <Icon name="chevron" size={18} />
            </a>
            {unbilled > 0 && !showDone && (
              <button type="button" className="card today" onClick={() => setShowDone(true)}>
                <span>
                  <span className="num">{unbilled}</span> abgeschlossene {unbilled === 1 ? 'Baustelle' : 'Baustellen'} ohne Rechnung
                </span>
                <Icon name="chevron" size={18} />
              </button>
            )}
            {data.backupFaellig && (
              <a className="warnbox" href="#/einstellungen">
                <strong>Datensicherung fällig.</strong> {data.lastBackup ? 'Die letzte Sicherung ist älter als 7 Tage.' : 'Es wurde noch nie gesichert.'} Jetzt sichern →
              </a>
            )}
          </div>
        )}

        {data && all.length === 0 && (
          <div className="empty">
            <Icon name="box" size={44} />
            <h3>Noch keine Baustelle</h3>
            <p>Lege deine erste Baustelle an, um Stunden, Material, Notizen, Fotos und Skizzen zu erfassen.</p>
            <a className="btn primary" href="#/neu">
              Baustelle anlegen
            </a>
          </div>
        )}
        {data && all.length > 0 && visible.length === 0 && <Empty icon="info" title="Nichts gefunden" text="Keine Baustelle passt zu Suche bzw. Filter." />}

        <ul className="cards">
          {visible.map((p) => (
            <li key={p.id}>
              <div className={`card project-card ${p.id === activeId ? 'active' : ''}`}>
                <a className="card-link" href={`#/p/${p.id}`}>
                <div className="card-main">
                  <strong>{p.name}</strong>
                  <span className="muted">{[p.kunde, p.adresse].filter(Boolean).join(' · ') || 'Keine Kundendaten'}</span>
                  <span className="chips">
                    {p.gewerke.map((g) => (
                      <span key={g} className="chip">
                        {gewerkName(g)}
                      </span>
                    ))}
                    {data?.offen.get(p.id) ? <span className="chip warn">{data.offen.get(p.id)} offen</span> : null}
                    {p.status === 'abgeschlossen' && <span className={p.abgerechnet ? 'chip' : 'chip warn'}>{p.abgerechnet ? 'abgerechnet' : 'Rechnung offen'}</span>}
                  </span>
                </div>
                <div className="card-side">
                  <span className="num">{fmtHours(data?.minutes.get(p.id) ?? 0)}</span>
                </div>
                </a>
                {/* Zeit mit einem Tipp starten – morgens auf der Baustelle zählt jeder Handgriff weniger. */}
                {p.status === 'aktiv' && !data?.timer && (
                  <button type="button" className="quick" aria-label={`Zeit starten: ${p.name}`} onClick={() => setSetting('timer', { projectId: p.id, start: Date.now() })}>
                    <Icon name="play" size={20} />
                  </button>
                )}
                {data?.timer?.projectId === p.id && (
                  <a className="quick running" href={`#/p/${p.id}/stunden`} aria-label={`Laufende Zeit stoppen: ${p.name}`}>
                    <Icon name="stop" size={20} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
