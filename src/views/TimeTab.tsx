import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROFIL, DEFAULT_RUNDUNG, getSetting, setSetting, touchProject, type Profil, type Project, type RunningTimer, type TimeEntry } from '../db';
import { gewerkName, vorschlaege } from '../gewerke';
import { fmtDate, fmtHours, fmtNumber, groupByDate, hhmm, isoDate, minutesBetween, parseDecimal, pauseVorschlag, roundDate, uid } from '../lib/util';
import { eigeneTaetigkeiten, merge } from '../lib/history';
import { Empty, Fab, Field, FormActions, Icon, Sheet } from '../components/ui';
import { GewerkSelect } from '../components/GewerkSelect';

type Draft = Partial<TimeEntry>;

export default function TimeTab({ project }: { project: Project }) {
  const entries = useLiveQuery(() => db.times.where('projectId').equals(project.id).toArray(), [project.id]);
  const profil = useLiveQuery(() => getSetting<Profil>('profil', DEFAULT_PROFIL), []);
  const timer = useLiveQuery(() => getSetting<RunningTimer | null>('timer', null), []);
  const timerProject = useLiveQuery(async () => (timer ? ((await db.projects.get(timer.projectId)) ?? null) : null), [timer?.projectId]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const runningHere = timer?.projectId === project.id;
  const total = (entries ?? []).reduce((s, e) => s + e.minuten, 0);

  async function stopTimer() {
    if (!timer) return;
    // Abgerechnet wird in der Praxis in Viertelstunden – daher runden (einstellbar).
    const step = profil?.rundung ?? DEFAULT_RUNDUNG;
    const start = roundDate(new Date(timer.start), step);
    let end = roundDate(new Date(), step);
    if (end <= start) end = new Date(start.getTime() + Math.max(step, 1) * 60_000);
    const brutto = (end.getTime() - start.getTime()) / 60_000;
    // Timer bleibt gespeichert, bis der Eintrag wirklich gesichert ist (siehe onSaved).
    setDraft({ datum: isoDate(start), von: hhmm(start), bis: hhmm(end), pauseMin: pauseVorschlag(brutto) });
  }

  return (
    <>
      <div className={`timer card ${runningHere ? 'running' : ''}`}>
        {runningHere && timer ? (
          <>
            <div>
              <strong>Zeit läuft</strong>
              <span className="muted">
                seit {hhmm(new Date(timer.start))} Uhr · <Elapsed since={timer.start} />
              </span>
            </div>
            <button type="button" className="btn danger" onClick={stopTimer}>
              <Icon name="stop" size={18} /> Stopp
            </button>
          </>
        ) : timer ? (
          <div>
            <strong>Zeit läuft auf anderer Baustelle</strong>
            <span className="muted">
              <a className="inline-link" href={`#/p/${timer.projectId}/stunden`}>
                {timerProject?.name ?? 'Baustelle öffnen'}
              </a>
            </span>
          </div>
        ) : (
          <>
            <div>
              <strong>Zeiterfassung</strong>
              <span className="muted">Gesamt: {fmtHours(total)}</span>
            </div>
            <button type="button" className="btn primary" onClick={() => setSetting('timer', { projectId: project.id, start: Date.now() })}>
              <Icon name="play" size={18} /> Start
            </button>
          </>
        )}
      </div>

      {entries && entries.length === 0 && <Empty icon="clock" title="Noch keine Stunden" text="Mit „Start“ die Zeit mitlaufen lassen oder über + nachträglich eintragen." />}

      {groupByDate(entries ?? []).map(([datum, list]) => (
        <section key={datum} className="group">
          <h3>
            <span>{fmtDate(datum)}</span>
            <span className="num">{fmtHours(list.reduce((s, e) => s + e.minuten, 0))}</span>
          </h3>
          <ul className="rows card">
            {list.map((e) => (
              <li key={e.id}>
                <button type="button" className="row" onClick={() => setDraft(e)}>
                  <span className="row-main">
                    <strong>{e.taetigkeit || 'Ohne Tätigkeitsangabe'}</strong>
                    <span className="muted">
                      {[e.mitarbeiter, e.von && e.bis ? `${e.von}–${e.bis}${e.pauseMin ? ` (${e.pauseMin} min Pause)` : ''}` : '', project.gewerke.length > 1 ? gewerkName(e.gewerk) : '', e.fahrtKm ? `${fmtNumber(e.fahrtKm, 1)} km` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="row-side">
                    {e.regie && <span className="chip warn">Regie</span>}
                    <span className="num">{fmtHours(e.minuten)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Fab label="Stunden eintragen" onClick={() => setDraft({})} />
      {draft && profil && (
        <TimeForm
          project={project}
          draft={draft}
          defaultName={profil.name}
          mitarbeiter={[...new Set((entries ?? []).map((e) => e.mitarbeiter).filter(Boolean))]}
          onClose={() => setDraft(null)}
          onSaved={async () => {
            // Kam der Entwurf vom Timer (keine id), ist der Timer damit erledigt.
            if (!draft.id && draft.von && runningHere) await db.settings.delete('timer');
            setDraft(null);
          }}
        />
      )}
    </>
  );
}

function Elapsed({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  return <>{fmtHours(Math.max(0, Math.floor((Date.now() - since) / 60_000)))}</>;
}

function TimeForm({ project, draft, defaultName, mitarbeiter, onClose, onSaved }: { project: Project; draft: Draft; defaultName: string; mitarbeiter: string[]; onClose: () => void; onSaved: () => void }) {
  const [datum, setDatum] = useState(draft.datum ?? isoDate());
  const [name, setName] = useState(draft.mitarbeiter ?? defaultName);
  const [von, setVon] = useState(draft.von ?? '');
  const [bis, setBis] = useState(draft.bis ?? '');
  const [pause, setPause] = useState(String(draft.pauseMin ?? 0));
  const [stunden, setStunden] = useState(draft.minuten && !(draft.von && draft.bis) ? String(draft.minuten / 60).replace('.', ',') : '');
  const [taetigkeit, setTaetigkeit] = useState(draft.taetigkeit ?? '');
  const [gewerk, setGewerk] = useState(draft.gewerk ?? project.gewerke[0] ?? 'sonstiges');
  const [regie, setRegie] = useState(draft.regie ?? false);
  const [km, setKm] = useState(draft.fahrtKm ? String(draft.fahrtKm).replace('.', ',') : '');
  const eigene = useLiveQuery(() => eigeneTaetigkeiten(), []) ?? [];
  const fromTimer = !draft.id && !!draft.von;

  const pauseMin = Math.max(0, Math.round(parseDecimal(pause) || 0));
  const fromClock = von && bis ? minutesBetween(von, bis, pauseMin) : null;
  const minuten = fromClock ?? Math.round((parseDecimal(stunden) || 0) * 60);
  const valid = datum !== '' && minuten > 0 && minuten <= 24 * 60;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const usesClock = fromClock !== null;
    const data = {
      datum,
      mitarbeiter: name.trim(),
      von: usesClock ? von : '',
      bis: usesClock ? bis : '',
      pauseMin: usesClock ? pauseMin : 0,
      minuten,
      taetigkeit: taetigkeit.trim(),
      gewerk,
      regie,
      fahrtKm: Math.max(0, parseDecimal(km) || 0) || undefined,
    };
    if (draft.id) await db.times.update(draft.id, data);
    else await db.times.add({ ...data, id: uid(), projectId: project.id, createdAt: Date.now() });
    await touchProject(project.id);
    onSaved();
  }

  return (
    <Sheet title={draft.id ? 'Stunden bearbeiten' : 'Stunden eintragen'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="grid2">
          <Field label="Datum">
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
          </Field>
          <Field label="Mitarbeiter">
            <input value={name} onChange={(e) => setName(e.target.value)} list="dl-mitarbeiter" autoComplete="off" />
          </Field>
        </div>
        <datalist id="dl-mitarbeiter">
          {mitarbeiter.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="grid3">
          <Field label="Beginn">
            <input type="time" value={von} onChange={(e) => setVon(e.target.value)} />
          </Field>
          <Field label="Ende">
            <input type="time" value={bis} onChange={(e) => setBis(e.target.value)} />
          </Field>
          <Field label="Pause (min)">
            <input inputMode="numeric" value={pause} onChange={(e) => setPause(e.target.value)} disabled={!(von && bis)} />
          </Field>
        </div>
        {fromClock !== null ? (
          <p className="calc">
            Arbeitszeit: <strong>{fmtHours(fromClock)}</strong>
            {fromTimer && <span className="muted"> · Zeiten gerundet, Pause vorgeschlagen – bitte prüfen</span>}
          </p>
        ) : (
          <Field label="… oder Stunden direkt" hint="Ohne Beginn/Ende, z. B. 7,5">
            <input inputMode="decimal" value={stunden} onChange={(e) => setStunden(e.target.value)} placeholder="0,00" />
          </Field>
        )}
        <GewerkSelect project={project} value={gewerk} onChange={setGewerk} />
        <Field label="Tätigkeit">
          <textarea rows={2} value={taetigkeit} onChange={(e) => setTaetigkeit(e.target.value)} placeholder="Was wurde gemacht?" />
        </Field>
        <div className="suggest">
          {merge(eigene, vorschlaege(gewerk).taetigkeiten, (t) => t).map((t) => (
            <button key={t} type="button" className="chip" onClick={() => setTaetigkeit((cur) => (cur.trim() ? `${cur.trim()}, ${t}` : t))}>
              {t}
            </button>
          ))}
        </div>
        <Field label="Gefahrene Kilometer (optional)" hint="Für die Abrechnung der Anfahrt.">
          <input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="0" />
        </Field>
        <label className="check">
          <input type="checkbox" checked={regie} onChange={(e) => setRegie(e.target.checked)} />
          <span>Regiearbeit (Zusatzleistung, gesondert abzurechnen)</span>
        </label>
        <FormActions disabled={!valid} onDelete={draft.id ? async () => { await db.times.delete(draft.id!); onClose(); } : undefined} />
      </form>
    </Sheet>
  );
}
