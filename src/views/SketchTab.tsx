import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Project } from '../db';
import { go } from '../lib/router';
import { fmtDate, isoDate, uid } from '../lib/util';
import { BufferImg, Empty, Fab } from '../components/ui';

export default function SketchTab({ project }: { project: Project }) {
  const sketches = useLiveQuery(async () => (await db.sketches.where('projectId').equals(project.id).toArray()).sort((a, b) => b.updatedAt - a.updatedAt), [project.id]);

  async function create() {
    const id = uid();
    const now = Date.now();
    const landscape = window.innerWidth > window.innerHeight;
    await db.sketches.add({
      id,
      projectId: project.id,
      titel: '',
      width: landscape ? 1600 : 1200,
      height: landscape ? 1200 : 1600,
      strokes: [],
      hasBackground: false,
      thumb: null,
      createdAt: now,
      updatedAt: now,
    });
    go(`/p/${project.id}/skizze/${id}`);
  }

  return (
    <>
      {sketches && sketches.length === 0 && <Empty icon="pencil" title="Noch keine Skizzen" text="Über den Stift eine freie Skizze beginnen. Fotos lassen sich im Fotos-Bereich bemaßen." />}
      <div className="thumbs wide">
        {(sketches ?? []).map((s) => (
          <a key={s.id} className="thumb" href={`#/p/${project.id}/skizze/${s.id}`}>
            <BufferImg data={s.thumb} alt={s.titel || 'Skizze'} />
            <span>{s.titel || `Skizze vom ${fmtDate(isoDate(new Date(s.createdAt)), false)}`}</span>
          </a>
        ))}
      </div>
      <Fab label="Neue Skizze" icon="pencil" onClick={create} />
    </>
  );
}
