import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, touchProject, type Note, type Project } from '../db';
import { fmtDate, groupByDate, isoDate, uid } from '../lib/util';
import { useLock } from '../lib/useLock';
import { Empty, Fab, Field, FormActions, Icon, Sheet } from '../components/ui';

type Draft = Partial<Note>;

export default function NotesTab({ project }: { project: Project }) {
  const notes = useLiveQuery(() => db.notes.where('projectId').equals(project.id).toArray(), [project.id]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const offen = (notes ?? []).filter((n) => n.todo && !n.done).sort((a, b) => a.createdAt - b.createdAt);
  const rest = (notes ?? []).filter((n) => !(n.todo && !n.done));

  const toggle = (n: Note) => db.notes.update(n.id, { done: !n.done, updatedAt: Date.now() });

  const row = (n: Note) => (
    <li key={n.id} className="todo-row">
      {n.todo && (
        <button type="button" className={n.done ? 'tick on' : 'tick'} aria-label={n.done ? 'Wieder öffnen' : 'Als erledigt abhaken'} aria-pressed={!!n.done} onClick={() => toggle(n)}>
          {n.done && <Icon name="check" size={18} />}
        </button>
      )}
      <button type="button" className="row" onClick={() => setDraft(n)}>
        <span className={`row-main ${n.done ? 'done' : ''}`}>
          {n.titel && <strong>{n.titel}</strong>}
          <span className={n.titel ? 'muted clamp' : 'clamp'}>{n.text}</span>
        </span>
      </button>
    </li>
  );

  return (
    <>
      {notes && notes.length === 0 && (
        <Empty icon="note" title="Noch keine Notizen" text="Absprachen, Mängel, Zählerstände festhalten – oder offene Punkte anlegen (Restarbeiten, „morgen mitbringen“) und später abhaken." />
      )}

      {offen.length > 0 && (
        <section className="group">
          <h3>
            <span>Offene Punkte</span>
            <span className="num">{offen.length}</span>
          </h3>
          <ul className="rows card">{offen.map(row)}</ul>
        </section>
      )}

      {groupByDate(rest).map(([datum, list]) => (
        <section key={datum} className="group">
          <h3>
            <span>{fmtDate(datum)}</span>
          </h3>
          <ul className="rows card">{list.map(row)}</ul>
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
  const [todo, setTodo] = useState(draft.todo ?? false);
  const valid = (titel.trim() !== '' || text.trim() !== '') && datum !== '';
  const lock = useLock();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await lock(async () => {
      const now = Date.now();
      const data = { datum, titel: titel.trim(), text: text.trim(), todo, done: todo ? (draft.done ?? false) : false, updatedAt: now };
      if (draft.id) await db.notes.update(draft.id, data);
      else await db.notes.add({ ...data, id: uid(), projectId: project.id, createdAt: now });
      await touchProject(project.id);
      onClose();
    });
  }

  return (
    <Sheet title={draft.id ? 'Notiz bearbeiten' : 'Neue Notiz'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Titel">
          <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Absprache mit Bauleitung" />
        </Field>
        <Field label="Notiz" hint="Tipp: Mikrofon-Taste der iOS-Tastatur zum Diktieren nutzen.">
          <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} autoFocus={!draft.id} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={todo} onChange={(e) => setTodo(e.target.checked)} />
          <span>Offener Punkt – zum Abhaken (Restarbeit, Material mitbringen, Rückruf …)</span>
        </label>
        <Field label="Datum">
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
        </Field>
        <FormActions disabled={!valid} onDelete={draft.id ? async () => { await db.notes.delete(draft.id!); onClose(); } : undefined} />
      </form>
    </Sheet>
  );
}
