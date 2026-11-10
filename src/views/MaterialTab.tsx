import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, touchProject, type MaterialEntry, type Project } from '../db';
import { EINHEITEN, vorschlaege } from '../gewerke';
import { fmtDate, fmtNumber, groupByDate, isoDate, parseDecimal, uid } from '../lib/util';
import { Empty, Fab, Field, FormActions, Sheet } from '../components/ui';
import { GewerkSelect } from '../components/GewerkSelect';

type Draft = Partial<MaterialEntry>;

export default function MaterialTab({ project }: { project: Project }) {
  const entries = useLiveQuery(() => db.materials.where('projectId').equals(project.id).toArray(), [project.id]);
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <>
      {entries && entries.length === 0 && <Empty icon="box" title="Noch kein Material" text="Über + verbautes Material mit Menge und Einheit erfassen." />}

      {groupByDate(entries ?? []).map(([datum, list]) => (
        <section key={datum} className="group">
          <h3>
            <span>{fmtDate(datum)}</span>
            <span className="num">{list.length} Pos.</span>
          </h3>
          <ul className="rows card">
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" className="row" onClick={() => setDraft(m)}>
                  <span className="row-main">
                    <strong>{m.bezeichnung}</strong>
                    {m.artikelnr && <span className="muted">Art.-Nr. {m.artikelnr}</span>}
                  </span>
                  <span className="row-side">
                    {m.regie && <span className="chip warn">Regie</span>}
                    <span className="num">
                      {fmtNumber(m.menge, 3)} {m.einheit}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Fab label="Material erfassen" onClick={() => setDraft({})} />
      {draft && <MaterialForm project={project} draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}

function MaterialForm({ project, draft, onClose }: { project: Project; draft: Draft; onClose: () => void }) {
  const [datum, setDatum] = useState(draft.datum ?? isoDate());
  const [bezeichnung, setBezeichnung] = useState(draft.bezeichnung ?? '');
  const [menge, setMenge] = useState(draft.menge !== undefined ? String(draft.menge).replace('.', ',') : '');
  const [einheit, setEinheit] = useState(draft.einheit ?? 'Stk');
  const [artikelnr, setArtikelnr] = useState(draft.artikelnr ?? '');
  const [gewerk, setGewerk] = useState(draft.gewerk ?? project.gewerke[0] ?? 'sonstiges');
  const [regie, setRegie] = useState(draft.regie ?? false);
  const [more, setMore] = useState(false);

  const katalog = vorschlaege(gewerk).material;
  const m = parseDecimal(menge);
  const valid = bezeichnung.trim() !== '' && m > 0 && datum !== '';
  const q = bezeichnung.trim().toLowerCase();
  // Beim Tippen filtern; eine exakt übernommene Bezeichnung nicht nochmal vorschlagen.
  const treffer = katalog.filter(([b]) => b.toLowerCase().includes(q) && b.toLowerCase() !== q);

  async function save(addAnother: boolean) {
    if (!valid) return;
    const data = { datum, bezeichnung: bezeichnung.trim(), menge: m, einheit, artikelnr: artikelnr.trim(), gewerk, regie };
    if (draft.id) await db.materials.update(draft.id, data);
    else await db.materials.add({ ...data, id: uid(), projectId: project.id, createdAt: Date.now() });
    await touchProject(project.id);
    if (addAnother) {
      setBezeichnung('');
      setMenge('');
      setArtikelnr('');
    } else onClose();
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save(false);
  };

  return (
    <Sheet title={draft.id ? 'Material bearbeiten' : 'Material erfassen'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <GewerkSelect project={project} value={gewerk} onChange={setGewerk} />
        <Field label="Bezeichnung *">
          <input value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} placeholder="Tippen oder Vorschlag wählen" autoComplete="off" required />
        </Field>
        {treffer.length > 0 && (
          <div className="suggest">
            {(more || q ? treffer : treffer.slice(0, 8)).map(([b, e]) => (
              <button key={b} type="button" className="chip" onClick={() => { setBezeichnung(b); setEinheit(e); }}>
                {b}
              </button>
            ))}
            {!more && !q && treffer.length > 8 && (
              <button type="button" className="chip more" onClick={() => setMore(true)}>
                mehr …
              </button>
            )}
          </div>
        )}
        <div className="grid2">
          <Field label="Menge *">
            <input inputMode="decimal" value={menge} onChange={(e) => setMenge(e.target.value)} placeholder="0" required />
          </Field>
          <Field label="Einheit">
            <select value={einheit} onChange={(e) => setEinheit(e.target.value)}>
              {(EINHEITEN.includes(einheit) ? EINHEITEN : [einheit, ...EINHEITEN]).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid2">
          <Field label="Datum">
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
          </Field>
          <Field label="Artikelnummer">
            <input value={artikelnr} onChange={(e) => setArtikelnr(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={regie} onChange={(e) => setRegie(e.target.checked)} />
          <span>Regie (Zusatzleistung)</span>
        </label>
        {!draft.id && (
          <button type="button" className="btn" disabled={!valid} onClick={() => save(true)}>
            Speichern & nächste Position
          </button>
        )}
        <FormActions disabled={!valid} onDelete={draft.id ? async () => { await db.materials.delete(draft.id!); onClose(); } : undefined} />
      </form>
    </Sheet>
  );
}
