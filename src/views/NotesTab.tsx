import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, touchProject, type Note, type Project } from '../db';
import { fmtDate, groupByDate, isoDate, uid } from '../lib/util';
import { Empty, Fab, Field, FormActions, Sheet } from '../components/ui';

type Draft = Partial<Note>;

export default function NotesTab({ project }: { project: Project }) {
  const notes = useLiveQuery(() => db.notes.where('projectId').equals(project.id).toArray(), [project.id]);
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <>
      {notes && notes.length === 0 && <Empty icon="note" title="Noch keine Notizen" text="Absprachen, Mängel, Zählerstände, offene Punkte – über + festhalten." />}

      {groupByDate(notes ?? []).map(([datum, list]) => (
        <section key={datum} className="group">
          <h3>
            <span>{fmtDate(datum)}</span>
          </h3>
          <ul className="rows card">
            {list.map((n) => (
              <li key={n.id}>
                <button type="button" className="row" onClick={() => setDraft(n)}>
                  <span className="row-main">
                    {n.titel && <strong>{n.titel}</strong>}
                    <span className={n.titel ? 'muted clamp' : 'clamp'}>{n.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Fab label="Notiz schreiben" onClick={() => setDraft({})} />
      {draft && <NoteForm project={project} draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}

function NoteForm({ project, draft, onClose }: { project: Project; draft: Draft; onClose: () => void }) {
  const [datum, setDatum] = useState(draft.datum ?? isoDate());
  const [titel, setTitel] = useState(draft.titel ?? '');
  const [text, setText] = useState(draft.text ?? '');
  const valid = (titel.trim() !== '' || text.trim() !== '') && datum !== '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const now = Date.now();
    const data = { datum, titel: titel.trim(), text: text.trim(), updatedAt: now };
    if (draft.id) await db.notes.update(draft.id, data);
    else await db.notes.add({ ...data, id: uid(), projectId: project.id, createdAt: now });
    await touchProject(project.id);
    onClose();
  }

  return (
    <Sheet title={draft.id ? 'Notiz bearbeiten' : 'Neue Notiz'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Titel">
          <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Absprache mit Bauleitung" />
        </Field>
        <Field label="Notiz" hint="Tipp: Mikrofon-Taste der iOS-Tastatur zum Diktieren nutzen.">
          <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} autoFocus={!draft.id} />
        </Field>
        <Field label="Datum">
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
        </Field>
        <FormActions disabled={!valid} onDelete={draft.id ? async () => { await db.notes.delete(draft.id!); onClose(); } : undefined} />
      </form>
    </Sheet>
  );
}
