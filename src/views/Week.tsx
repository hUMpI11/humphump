import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { shareOrDownload, toCsv } from '../lib/export';
import { addDays, fmtDate, fmtHours, fmtNumber, isoDate, weekStart } from '../lib/util';
import { Empty, Header, Icon } from '../components/ui';

/** Alle Stunden einer Woche über alle Baustellen – die Grundlage fürs Rechnungschreiben am Abend. */
export default function Week() {
  const [start, setStart] = useState(() => weekStart(isoDate()));
  const end = addDays(start, 6);

  const data = useLiveQuery(async () => {
    const [times, projects] = await Promise.all([db.times.where('datum').between(start, end, true, true).toArray(), db.projects.toArray()]);
    return { times, names: new Map(projects.map((p) => [p.id, p.name])) };
  }, [start, end]);

  const times = data?.times ?? [];
  const name = (id: string) => data?.names.get(id) ?? 'Gelöschte Baustelle';
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const sum = times.reduce((s, t) => s + t.minuten, 0);
  const regie = times.filter((t) => t.regie).reduce((s, t) => s + t.minuten, 0);
  const km = times.reduce((s, t) => s + (t.fahrtKm ?? 0), 0);

  const perProject = new Map<string, number>();
  for (const t of times) perProject.set(t.projectId, (perProject.get(t.projectId) ?? 0) + t.minuten);

  const csv = () =>
    shareOrDownload(
      `Stunden_Woche_${start}.csv`,
      new Blob(
        [
          toCsv([
            ['Datum', 'Baustelle', 'Mitarbeiter', 'Beginn', 'Ende', 'Pause (min)', 'Stunden', 'km', 'Regie', 'Tätigkeit'],
            ...[...times]
              .sort((a, b) => (a.datum === b.datum ? a.createdAt - b.createdAt : a.datum < b.datum ? -1 : 1))
              .map((t) => [t.datum, name(t.projectId), t.mitarbeiter, t.von, t.bis, t.pauseMin, Math.round((t.minuten / 60) * 100) / 100, t.fahrtKm ?? 0, t.regie, t.taetigkeit]),
          ]),
        ],
        { type: 'text/csv' },
      ),
    );

  return (
    <>
      <Header title="Wochenübersicht" subtitle={`${fmtDate(start, false)} – ${fmtDate(end, false)}`} back="/" />
      <div className="scroll page">
        <div className="weeknav">
          <button type="button" className="btn" onClick={() => setStart(addDays(start, -7))} aria-label="Vorherige Woche">
            <Icon name="back" size={18} />
          </button>
          <button type="button" className="btn" onClick={() => setStart(weekStart(isoDate()))} disabled={start === weekStart(isoDate())}>
            Diese Woche
          </button>
          <button type="button" className="btn" onClick={() => setStart(addDays(start, 7))} aria-label="Nächste Woche">
            <Icon name="chevron" size={18} />
          </button>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="num">{fmtHours(sum)}</span>
            <span>Stunden gesamt</span>
          </div>
          <div className="stat">
            <span className="num">{fmtHours(regie)}</span>
            <span>davon Regie</span>
          </div>
          <div className="stat">
            <span className="num">{fmtNumber(km, 1)} km</span>
            <span>gefahren</span>
          </div>
          <div className="stat">
            <span className="num">{perProject.size}</span>
            <span>Baustellen</span>
          </div>
        </div>

        {data && times.length === 0 && <Empty icon="calendar" title="Keine Stunden in dieser Woche" text="Sobald Stunden erfasst sind, erscheinen sie hier nach Tagen und Baustellen." />}

        {perProject.size > 0 && (
          <section className="group">
            <h3>
              <span>Je Baustelle</span>
            </h3>
            <ul className="rows card">
              {[...perProject.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([id, min]) => (
                  <li key={id}>
                    <a className="row" href={`#/p/${id}/stunden`}>
                      <span className="row-main">
                        <strong>{name(id)}</strong>
                      </span>
                      <span className="row-side num">{fmtHours(min)}</span>
                    </a>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {days.map((d) => {
          const list = times.filter((t) => t.datum === d).sort((a, b) => a.createdAt - b.createdAt);
          if (!list.length) return null;
          return (
            <section key={d} className="group">
              <h3>
                <span>{fmtDate(d)}</span>
                <span className="num">{fmtHours(list.reduce((s, t) => s + t.minuten, 0))}</span>
              </h3>
              <ul className="rows card">
                {list.map((t) => (
                  <li key={t.id}>
                    <a className="row" href={`#/p/${t.projectId}/stunden`}>
                      <span className="row-main">
                        <strong>{name(t.projectId)}</strong>
                        <span className="muted">{[t.von && t.bis ? `${t.von}–${t.bis}` : '', t.taetigkeit, t.fahrtKm ? `${fmtNumber(t.fahrtKm, 1)} km` : ''].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="row-side">
                        {t.regie && <span className="chip warn">Regie</span>}
                        <span className="num">{fmtHours(t.minuten)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {times.length > 0 && (
          <div className="button-col">
            <button type="button" className="btn" onClick={csv}>
              Woche als CSV exportieren
            </button>
          </div>
        )}
      </div>
    </>
  );
}
