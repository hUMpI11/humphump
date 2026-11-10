import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_PROFIL, getSetting, type Profil } from '../db';
import { gewerkName } from '../gewerke';
import { shareOrDownload, toCsv } from '../lib/export';
import { fmtDate, fmtHours, fmtNumber, hhmm, inRange, isoDate, safeFilename, uid } from '../lib/util';
import { SignaturePad } from '../components/SignaturePad';
import { BufferImg, Header } from '../components/ui';

const SECTIONS = ['Stunden', 'Material', 'Notizen', 'Fotos', 'Skizzen'] as const;
type Section = (typeof SECTIONS)[number];

const byDate = <T extends { datum: string; createdAt: number }>(a: T, b: T) => (a.datum === b.datum ? a.createdAt - b.createdAt : a.datum < b.datum ? -1 : 1);

export default function Report({ id }: { id: string }) {
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [signing, setSigning] = useState(false);
  const [show, setShow] = useState<Record<Section, boolean>>({ Stunden: true, Material: true, Notizen: true, Fotos: true, Skizzen: true });

  const data = useLiveQuery(async () => {
    const project = await db.projects.get(id);
    if (!project) return null;
    const [times, materials, notes, photos, sketches, blobs, profil, signatures] = await Promise.all([
      db.times.where('projectId').equals(id).toArray(),
      db.materials.where('projectId').equals(id).toArray(),
      db.notes.where('projectId').equals(id).toArray(),
      db.photos.where('projectId').equals(id).toArray(),
      db.sketches.where('projectId').equals(id).toArray(),
      db.blobs.where('projectId').equals(id).toArray(),
      getSetting<Profil>('profil', DEFAULT_PROFIL),
      db.signatures.where('projectId').equals(id).toArray(),
    ]);
    return { project, times, materials, notes, photos, sketches, blobs: new Map(blobs.map((b) => [b.id, b])), profil, signatures };
  }, [id]);

  if (data === undefined) return null;
  if (data === null) return <Header title="Baustelle nicht gefunden" back="/" />;

  const { project, profil, blobs } = data;
  const times = data.times.filter((t) => inRange(t.datum, von, bis)).sort(byDate);
  const materials = data.materials.filter((m) => inRange(m.datum, von, bis)).sort(byDate);
  const notes = data.notes.filter((n) => inRange(n.datum, von, bis)).sort(byDate);
  const photos = data.photos.filter((p) => inRange(p.datum, von, bis)).sort(byDate);
  // Skizzen haben kein Arbeitsdatum – maßgeblich ist das Erstelldatum.
  const sketches = data.sketches.filter((s) => inRange(isoDate(new Date(s.createdAt)), von, bis)).sort((a, b) => a.createdAt - b.createdAt);

  const sum = times.reduce((s, t) => s + t.minuten, 0);
  const sumKm = times.reduce((s, t) => s + (t.fahrtKm ?? 0), 0);
  // Eine Unterschrift gilt genau für den Zeitraum, für den sie geleistet wurde.
  const signature = data.signatures.filter((s) => s.von === von && s.bis === bis).sort((a, b) => b.createdAt - a.createdAt)[0];
  const sumRegie = times.filter((t) => t.regie).reduce((s, t) => s + t.minuten, 0);
  const zeitraum = von || bis ? `${von ? fmtDate(von, false) : 'Beginn'} – ${bis ? fmtDate(bis, false) : 'heute'}` : 'Gesamte Baustelle';
  const base = safeFilename(project.name);
  const multi = project.gewerke.length > 1;

  const csvTimes = () =>
    shareOrDownload(
      `${base}_Stunden.csv`,
      new Blob(
        [
          toCsv([
            ['Datum', 'Mitarbeiter', 'Beginn', 'Ende', 'Pause (min)', 'Stunden', 'km', 'Gewerk', 'Regie', 'Tätigkeit'],
            ...times.map((t) => [t.datum, t.mitarbeiter, t.von, t.bis, t.pauseMin, Math.round((t.minuten / 60) * 100) / 100, t.fahrtKm ?? 0, gewerkName(t.gewerk), t.regie, t.taetigkeit]),
          ]),
        ],
        { type: 'text/csv' },
      ),
    );

  const csvMaterial = () =>
    shareOrDownload(
      `${base}_Material.csv`,
      new Blob(
        [
          toCsv([
            ['Datum', 'Bezeichnung', 'Menge', 'Einheit', 'Artikelnr.', 'Gewerk', 'Regie'],
            ...materials.map((m) => [m.datum, m.bezeichnung, m.menge, m.einheit, m.artikelnr, gewerkName(m.gewerk), m.regie]),
          ]),
        ],
        { type: 'text/csv' },
      ),
    );

  return (
    <>
      <Header title="Bericht" subtitle={project.name} back={`/p/${id}`} />
      <div className="scroll page report-page">
        <div className="card block no-print">
          <div className="grid2">
            <label className="field">
              <span className="field-label">Von</span>
              <input type="date" value={von} onChange={(e) => setVon(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Bis</span>
              <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
            </label>
          </div>
          <div className="chip-select">
            <button type="button" className="chip" onClick={() => { setVon(isoDate()); setBis(isoDate()); }}>
              Nur heute
            </button>
            <button type="button" className="chip" onClick={() => { setVon(''); setBis(''); }}>
              Alles
            </button>
            {SECTIONS.map((s) => (
              <button key={s} type="button" className={show[s] ? 'chip on' : 'chip'} aria-pressed={show[s]} onClick={() => setShow({ ...show, [s]: !show[s] })}>
                {s}
              </button>
            ))}
          </div>
          <div className="button-col">
            {signature ? (
              <button type="button" className="btn danger" onClick={() => window.confirm('Unterschrift entfernen?') && db.signatures.delete(signature.id)}>
                Unterschrift von {signature.name} entfernen
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => setSigning(true)}>
                Kunde unterschreiben lassen
              </button>
            )}
            <button type="button" className="btn primary" onClick={() => window.print()}>
              Drucken / als PDF sichern
            </button>
            <div className="grid2">
              <button type="button" className="btn" onClick={csvTimes} disabled={!times.length}>
                Stunden als CSV
              </button>
              <button type="button" className="btn" onClick={csvMaterial} disabled={!materials.length}>
                Material als CSV
              </button>
            </div>
          </div>
        </div>

        <article className="report">
          <header>
            <div>
              <h1>Baustellenbericht</h1>
              <p>{zeitraum}</p>
            </div>
            <div className="right">
              {profil.firma && <strong>{profil.firma}</strong>}
              {profil.name && <span>{profil.name}</span>}
              <span>Erstellt am {fmtDate(isoDate(), false)}</span>
            </div>
          </header>

          <dl className="facts">
            <dt>Baustelle</dt>
            <dd>{project.name}</dd>
            {project.kunde && (<><dt>Kunde</dt><dd>{project.kunde}</dd></>)}
            {project.adresse && (<><dt>Adresse</dt><dd>{project.adresse}</dd></>)}
            {project.auftragsnr && (<><dt>Auftragsnr.</dt><dd>{project.auftragsnr}</dd></>)}
            <dt>Gewerke</dt>
            <dd>{project.gewerke.map(gewerkName).join(', ')}</dd>
          </dl>

          {show.Stunden && times.length > 0 && (
            <section>
              <h2>Arbeitszeiten</h2>
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Mitarbeiter</th>
                    <th>Zeit</th>
                    <th>Tätigkeit</th>
                    <th className="r">Std.</th>
                  </tr>
                </thead>
                <tbody>
                  {times.map((t) => (
                    <tr key={t.id}>
                      <td className="nw">{fmtDate(t.datum, false)}</td>
                      <td className="nw">{t.mitarbeiter}</td>
                      <td className="nw">{t.von && t.bis ? `${t.von}–${t.bis}` : ''}</td>
                      <td>
                        {t.regie && <b>[Regie] </b>}
                        {multi && <i>{gewerkName(t.gewerk)}: </i>}
                        {t.taetigkeit}
                        {t.fahrtKm ? ` (${fmtNumber(t.fahrtKm, 1)} km)` : ''}
                      </td>
                      <td className="r nw">{fmtHours(t.minuten).replace(' h', '')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Summe{sumRegie ? ` (davon Regie: ${fmtHours(sumRegie)})` : ''}</td>
                    <td className="r nw">{fmtHours(sum)}</td>
                  </tr>
                  {sumKm > 0 && (
                    <tr>
                      <td colSpan={4}>Gefahrene Kilometer</td>
                      <td className="r nw">{fmtNumber(sumKm, 1)} km</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </section>
          )}

          {show.Material && materials.length > 0 && (
            <section>
              <h2>Material</h2>
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Bezeichnung</th>
                    <th>Art.-Nr.</th>
                    <th className="r">Menge</th>
                    <th>Einh.</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td className="nw">{fmtDate(m.datum, false)}</td>
                      <td>
                        {m.regie && <b>[Regie] </b>}
                        {m.bezeichnung}
                      </td>
                      <td>{m.artikelnr}</td>
                      <td className="r nw">{fmtNumber(m.menge, 3)}</td>
                      <td>{m.einheit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {show.Notizen && notes.length > 0 && (
            <section>
              <h2>Notizen</h2>
              {notes.map((n) => (
                <div key={n.id} className="report-note">
                  <strong>
                    {fmtDate(n.datum, false)}
                    {n.titel ? ` – ${n.titel}` : ''}
                    {n.todo ? (n.done ? ' [erledigt]' : ' [offen]') : ''}
                  </strong>
                  <p className="pre">{n.text}</p>
                </div>
              ))}
            </section>
          )}

          {show.Fotos && photos.length > 0 && (
            <section>
              <h2>Fotos</h2>
              <div className="report-images">
                {photos.map((p) => (
                  <figure key={p.id}>
                    <BufferImg data={blobs.get(p.id)?.data ?? p.thumb} mime={blobs.get(p.id)?.mime} alt={p.caption || 'Foto'} />
                    <figcaption>{[fmtDate(p.datum, false), p.caption].filter(Boolean).join(' – ')}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {show.Skizzen && sketches.length > 0 && (
            <section>
              <h2>Skizzen</h2>
              <div className="report-images">
                {sketches.map((s) => (
                  <figure key={s.id}>
                    <BufferImg data={blobs.get(s.id)?.data ?? s.thumb} mime={blobs.get(s.id)?.mime} alt={s.titel || 'Skizze'} />
                    <figcaption>{s.titel || 'Skizze'}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <div className="signatures">
            <div>Ort, Datum / Unterschrift Auftragnehmer</div>
            <div className={signature ? 'signed' : ''}>
              {signature && <BufferImg data={signature.data} mime="image/png" alt={`Unterschrift ${signature.name}`} />}
              {signature
                ? `${signature.name}, unterschrieben am ${fmtDate(isoDate(new Date(signature.createdAt)), false)} um ${hhmm(new Date(signature.createdAt))} Uhr`
                : 'Ort, Datum / Unterschrift Auftraggeber'}
            </div>
          </div>
        </article>
      </div>
      {signing && (
        <SignaturePad
          onCancel={() => setSigning(false)}
          onSave={async (name, png) => {
            await db.signatures.add({ id: uid(), projectId: id, name, von, bis, data: png, createdAt: Date.now() });
            setSigning(false);
          }}
        />
      )}
    </>
  );
}
