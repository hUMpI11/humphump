import { useEffect, useState, type FormEvent } from 'react';
import { db, type Project } from '../db';
import { GEWERKE } from '../gewerke';
import { go } from '../lib/router';
import { uid } from '../lib/util';
import { Field, Header } from '../components/ui';

const EMPTY = { name: '', kunde: '', adresse: '', auftragsnr: '', beschreibung: '', ansprechpartner: '', telefon: '', gewerke: [] as string[] };

export default function ProjectForm({ id }: { id?: string }) {
  const [form, setForm] = useState(EMPTY);
  const [existing, setExisting] = useState<Project>();
  const [ready, setReady] = useState(!id);

  useEffect(() => {
    if (!id) return;
    db.projects.get(id).then((p) => {
      if (p) {
        setExisting(p);
        setForm({ name: p.name, kunde: p.kunde, adresse: p.adresse, auftragsnr: p.auftragsnr, beschreibung: p.beschreibung, ansprechpartner: p.ansprechpartner ?? '', telefon: p.telefon ?? '', gewerke: p.gewerke });
      }
      setReady(true);
    });
  }, [id]);

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (g: string) => set('gewerke', form.gewerke.includes(g) ? form.gewerke.filter((x) => x !== g) : [...form.gewerke, g]);
  const valid = form.name.trim() !== '' && form.gewerke.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const now = Date.now();
    const base = { ...form, name: form.name.trim(), kunde: form.kunde.trim(), adresse: form.adresse.trim(), auftragsnr: form.auftragsnr.trim(), ansprechpartner: form.ansprechpartner.trim(), telefon: form.telefon.trim() };
    if (existing) {
      await db.projects.update(existing.id, { ...base, updatedAt: now });
      go(`/p/${existing.id}`, true);
    } else {
      const newId = uid();
      await db.projects.add({ ...base, id: newId, status: 'aktiv', createdAt: now, updatedAt: now });
      go(`/p/${newId}`, true);
    }
  }

  if (!ready) return null;
  if (id && !existing) return <Header title="Nicht gefunden" back="/" />;

  return (
    <>
      <Header title={existing ? 'Baustelle bearbeiten' : 'Neue Baustelle'} back={existing ? `/p/${existing.id}` : '/'} />
      <form className="scroll form page" onSubmit={submit}>
        <Field label="Bezeichnung *">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. Schule Musterstadt – Lüftung Turnhalle" autoFocus={!existing} required />
        </Field>
        <Field label="Kunde / Auftraggeber">
          <input value={form.kunde} onChange={(e) => set('kunde', e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Adresse">
          <input value={form.adresse} onChange={(e) => set('adresse', e.target.value)} placeholder="Straße, PLZ Ort" autoComplete="off" />
        </Field>
        <div className="grid2">
          <Field label="Ansprechpartner vor Ort">
            <input value={form.ansprechpartner} onChange={(e) => set('ansprechpartner', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Telefon">
            <input type="tel" inputMode="tel" value={form.telefon} onChange={(e) => set('telefon', e.target.value)} autoComplete="off" />
          </Field>
        </div>
        <Field label="Auftrags- / Projektnummer">
          <input value={form.auftragsnr} onChange={(e) => set('auftragsnr', e.target.value)} autoComplete="off" autoCapitalize="characters" />
        </Field>
        <div className="field">
          <span className="field-label">Gewerke * (mehrere möglich)</span>
          <div className="chip-select">
            {GEWERKE.map((g) => (
              <button key={g.id} type="button" className={form.gewerke.includes(g.id) ? 'chip on' : 'chip'} aria-pressed={form.gewerke.includes(g.id)} onClick={() => toggle(g.id)}>
                {g.name}
              </button>
            ))}
          </div>
          <span className="field-hint">Bestimmt die Vorschläge bei Tätigkeiten und Material.</span>
        </div>
        <Field label="Beschreibung / Leistungsumfang">
          <textarea rows={4} value={form.beschreibung} onChange={(e) => set('beschreibung', e.target.value)} />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={!valid}>
            {existing ? 'Speichern' : 'Baustelle anlegen'}
          </button>
        </div>
      </form>
    </>
  );
}
