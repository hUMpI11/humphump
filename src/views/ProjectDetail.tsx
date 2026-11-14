import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteProject, type Project } from '../db';
import { gewerkName } from '../gewerke';
import { go, type Tab } from '../lib/router';
import { fmtHours } from '../lib/util';
import { Header, Icon } from '../components/ui';
import TimeTab from './TimeTab';
import MaterialTab from './MaterialTab';
import NotesTab from './NotesTab';
import PhotosTab from './PhotosTab';
import SketchTab from './SketchTab';
import ProtocolTab from './ProtocolTab';

const TAB_DEF: { id: Tab; label: string; icon: string }[] = [
  { id: 'uebersicht', label: 'Übersicht', icon: 'info' },
  { id: 'stunden', label: 'Stunden', icon: 'clock' },
  { id: 'material', label: 'Material', icon: 'box' },
  { id: 'notizen', label: 'Notizen', icon: 'note' },
  { id: 'fotos', label: 'Fotos', icon: 'camera' },
  { id: 'skizzen', label: 'Skizzen', icon: 'pencil' },
  { id: 'protokolle', label: 'Protokolle', icon: 'clipboard' },
];

export default function ProjectDetail({ id, tab }: { id: string; tab: Tab }) {
  // null = geladen, aber nicht vorhanden; undefined = lädt noch
  const project = useLiveQuery(async () => (await db.projects.get(id)) ?? null, [id]);

  if (project === undefined) return null;
  if (project === null) return <Header title="Baustelle nicht gefunden" back="/" />;

  return (
    <>
      <Header title={project.name} subtitle={project.kunde || undefined} back="/" />
      <nav className="tabbar no-print" aria-label="Bereiche">
        {TAB_DEF.map((t) => (
          <a key={t.id} href={`#/p/${id}/${t.id}`} className={t.id === tab ? 'on' : ''} aria-current={t.id === tab ? 'page' : undefined}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <div className="scroll page">
        {tab === 'uebersicht' && <Overview project={project} />}
        {tab === 'stunden' && <TimeTab project={project} />}
        {tab === 'material' && <MaterialTab project={project} />}
        {tab === 'notizen' && <NotesTab project={project} />}
        {tab === 'fotos' && <PhotosTab project={project} />}
        {tab === 'skizzen' && <SketchTab project={project} />}
        {tab === 'protokolle' && <ProtocolTab project={project} />}
      </div>
    </>
  );
}

function Overview({ project }: { project: Project }) {
  const id = project.id;
  const stats = useLiveQuery(async () => {
    const [times, material, noteList, photos, sketches] = await Promise.all([
      db.times.where('projectId').equals(id).toArray(),
      db.materials.where('projectId').equals(id).count(),
      db.notes.where('projectId').equals(id).toArray(),
      db.photos.where('projectId').equals(id).count(),
      db.sketches.where('projectId').equals(id).count(),
    ]);
    const minuten = times.reduce((s, t) => s + t.minuten, 0);
    const regie = times.filter((t) => t.regie).reduce((s, t) => s + t.minuten, 0);
    const abger = times.filter((t) => t.abgerechnet).reduce((s, t) => s + t.minuten, 0);
    const offen = noteList.filter((n) => n.todo && !n.done).length;
    return { minuten, regie, abger, material, notes: noteList.length, offen, photos, sketches };
  }, [id]);

  const done = project.status === 'abgeschlossen';

  async function remove() {
    if (!window.confirm(`Baustelle „${project.name}“ mit ALLEN Stunden, Materialien, Notizen, Fotos und Skizzen endgültig löschen?`)) return;
    await deleteProject(id);
    go('/', true);
  }

  return (
    <>
      <div className="stats">
        <a className="stat" href={`#/p/${id}/stunden`}>
          <span className="num">{fmtHours(stats?.minuten ?? 0)}</span>
          <span>Stunden{stats?.regie ? ` · davon ${fmtHours(stats.regie)} Regie` : ''}{stats?.abger ? ` · offen ${fmtHours(stats.minuten - stats.abger)}` : ''}</span>
        </a>
        <a className="stat" href={`#/p/${id}/material`}>
          <span className="num">{stats?.material ?? 0}</span>
          <span>Materialpositionen</span>
        </a>
        <a className="stat" href={`#/p/${id}/notizen`}>
          <span className="num">{stats?.notes ?? 0}</span>
          <span>Notizen{stats?.offen ? ` · ${stats.offen} offen` : ''}</span>
        </a>
        <a className="stat" href={`#/p/${id}/fotos`}>
          <span className="num">{(stats?.photos ?? 0) + (stats?.sketches ?? 0)}</span>
          <span>Fotos & Skizzen</span>
        </a>
      </div>

      <section className="card block">
        <dl className="facts">
          <dt>Status</dt>
          <dd>
            <span className={`chip ${done ? '' : 'on'}`}>{done ? 'Abgeschlossen' : 'Aktiv'}</span>{' '}
            {done && <span className={project.abgerechnet ? 'chip' : 'chip warn'}>{project.abgerechnet ? 'abgerechnet' : 'Rechnung offen'}</span>}
          </dd>
          <dt>Gewerke</dt>
          <dd>{project.gewerke.map(gewerkName).join(', ')}</dd>
          {project.kunde && (<><dt>Kunde</dt><dd>{project.kunde}</dd></>)}
          {(project.ansprechpartner || project.telefon) && (
            <>
              <dt>Kontakt</dt>
              <dd>
                {project.ansprechpartner}
                {project.ansprechpartner && project.telefon ? ' · ' : ''}
                {project.telefon && (
                  <a href={`tel:${project.telefon.replace(/[^\d+]/g, '')}`} className="inline-link">
                    <Icon name="phone" size={16} /> {project.telefon}
                  </a>
                )}
              </dd>
            </>
          )}
          {project.auftragsnr && (<><dt>Auftragsnr.</dt><dd>{project.auftragsnr}</dd></>)}
          {project.adresse && (
            <>
              <dt>Adresse</dt>
              <dd>
                <a href={`https://maps.apple.com/?q=${encodeURIComponent(project.adresse)}`} target="_blank" rel="noreferrer" className="inline-link">
                  <Icon name="pin" size={16} /> {project.adresse}
                </a>
              </dd>
            </>
          )}
          {project.beschreibung && (<><dt>Beschreibung</dt><dd className="pre">{project.beschreibung}</dd></>)}
        </dl>
      </section>

      <div className="button-col">
        <a className="btn primary" href={`#/p/${id}/bericht`}>
          Bericht / PDF / Export
        </a>
        <a className="btn" href={`#/p/${id}/bearbeiten`}>
          Stammdaten bearbeiten
        </a>
        {done && (
          <button type="button" className="btn" onClick={() => db.projects.update(id, { abgerechnet: !project.abgerechnet })}>
            {project.abgerechnet ? 'Abrechnung zurücknehmen' : 'Als abgerechnet markieren'}
          </button>
        )}
        <button type="button" className="btn" onClick={() => db.projects.update(id, { status: done ? 'aktiv' : 'abgeschlossen', updatedAt: Date.now() })}>
          {done ? 'Wieder aktivieren' : 'Baustelle abschließen'}
        </button>
        <button type="button" className="btn danger" onClick={remove}>
          Baustelle löschen
        </button>
      </div>
    </>
  );
}
