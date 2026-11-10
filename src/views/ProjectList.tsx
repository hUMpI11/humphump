import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { gewerkName } from '../gewerke';
import { fmtHours } from '../lib/util';
import { Empty, Header, Icon } from '../components/ui';

export default function ProjectList({ activeId }: { activeId?: string }) {
  const [query, setQuery] = useState('');
  const [showDone, setShowDone] = useState(false);

  const data = useLiveQuery(async () => {
    const [projects, times] = await Promise.all([db.projects.toArray(), db.times.toArray()]);
    const minutes = new Map<string, number>();
    for (const t of times) minutes.set(t.projectId, (minutes.get(t.projectId) ?? 0) + t.minuten);
    return { projects: projects.sort((a, b) => b.updatedAt - a.updatedAt), minutes };
  }, []);

  const q = query.trim().toLowerCase();
  const all = data?.projects ?? [];
  const visible = all.filter(
    (p) =>
      (showDone ? p.status === 'abgeschlossen' : p.status === 'aktiv') &&
      (!q || [p.name, p.kunde, p.adresse, p.auftragsnr].some((s) => s.toLowerCase().includes(q))),
  );
  const doneCount = all.filter((p) => p.status === 'abgeschlossen').length;

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
              <a className={`card project-card ${p.id === activeId ? 'active' : ''}`} href={`#/p/${p.id}`}>
                <div className="card-main">
                  <strong>{p.name}</strong>
                  <span className="muted">{[p.kunde, p.adresse].filter(Boolean).join(' · ') || 'Keine Kundendaten'}</span>
                  <span className="chips">
                    {p.gewerke.map((g) => (
                      <span key={g} className="chip">
                        {gewerkName(g)}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="card-side">
                  <span className="num">{fmtHours(data?.minutes.get(p.id) ?? 0)}</span>
                  <Icon name="chevron" size={18} />
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
