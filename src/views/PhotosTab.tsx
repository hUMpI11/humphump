import { useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, touchProject, type Photo, type Project } from '../db';
import { loadImage, scaleImage } from '../lib/image';
import { shareOrDownload } from '../lib/export';
import { go } from '../lib/router';
import { fmtDate, groupByDate, isoDate, safeFilename, uid } from '../lib/util';
import { BufferImg, Empty, Fab, Field, Sheet } from '../components/ui';

export const PHOTO_MAX_EDGE = 1600;
const THUMB_EDGE = 400;

export default function PhotosTab({ project }: { project: Project }) {
  const photos = useLiveQuery(() => db.photos.where('projectId').equals(project.id).toArray(), [project.id]);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Photo | null>(null);

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = ''; // gleiche Datei soll erneut wählbar sein
    if (!files.length) return;
    setBusy(true);
    setError('');
    let failed = 0;
    for (const file of files) {
      try {
        const img = await loadImage(file);
        const full = await scaleImage(img, PHOTO_MAX_EDGE, 0.8);
        const thumb = await scaleImage(img, THUMB_EDGE, 0.7);
        const id = uid();
        await db.transaction('rw', db.photos, db.blobs, async () => {
          await db.blobs.add({ id, projectId: project.id, data: full.data, mime: full.mime });
          await db.photos.add({ id, projectId: project.id, datum: isoDate(), caption: '', thumb: thumb.data, createdAt: Date.now() });
        });
      } catch {
        failed++;
      }
    }
    await touchProject(project.id);
    setBusy(false);
    if (failed) setError(`${failed} Bild(er) konnten nicht gespeichert werden (Format nicht lesbar oder Speicher voll).`);
  }

  return (
    <>
      {/* Zwei Wege: Kamera sofort (ein Tipp weniger auf der Baustelle) oder mehrere Bilder aus der Mediathek. */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      <div className="tabtools">
        <button type="button" className="btn" onClick={() => input.current?.click()} disabled={busy}>
          Aus Mediathek wählen
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {busy && <p className="calc">Bilder werden verarbeitet …</p>}
      {photos && photos.length === 0 && !busy && <Empty icon="camera" title="Noch keine Fotos" text="Das Kamera-Symbol öffnet direkt die Kamera. Mehrere vorhandene Bilder über „Aus Mediathek wählen“." />}

      {groupByDate(photos ?? []).map(([datum, list]) => (
        <section key={datum} className="group">
          <h3>
            <span>{fmtDate(datum)}</span>
            <span className="num">{list.length}</span>
          </h3>
          <div className="thumbs">
            {list.map((p) => (
              <button key={p.id} type="button" className="thumb" onClick={() => setOpen(p)}>
                <BufferImg data={p.thumb} alt={p.caption || 'Foto'} />
                {p.caption && <span>{p.caption}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}

      <Fab label="Foto aufnehmen" icon="camera" onClick={() => camera.current?.click()} />
      {open && <PhotoSheet project={project} photo={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function PhotoSheet({ project, photo, onClose }: { project: Project; photo: Photo; onClose: () => void }) {
  const blob = useLiveQuery(() => db.blobs.get(photo.id), [photo.id]);
  const [caption, setCaption] = useState(photo.caption);
  const [datum, setDatum] = useState(photo.datum);

  async function save() {
    await db.photos.update(photo.id, { caption: caption.trim(), datum: datum || photo.datum });
    onClose();
  }

  async function remove() {
    if (!window.confirm('Foto wirklich löschen?')) return;
    await db.transaction('rw', db.photos, db.blobs, async () => {
      await db.photos.delete(photo.id);
      await db.blobs.delete(photo.id);
    });
    onClose();
  }

  /** Legt eine Skizze mit diesem Foto als Hintergrund an – das Original bleibt unverändert. */
  async function annotate() {
    if (!blob) return;
    const img = await loadImage(new Blob([blob.data], { type: blob.mime }));
    const id = uid();
    const now = Date.now();
    await db.transaction('rw', db.sketches, db.blobs, async () => {
      await db.blobs.add({ id: `${id}:bg`, projectId: project.id, data: blob.data, mime: blob.mime });
      await db.blobs.add({ id, projectId: project.id, data: blob.data, mime: blob.mime });
      await db.sketches.add({
        id,
        projectId: project.id,
        titel: caption.trim() || 'Foto-Skizze',
        width: img.naturalWidth,
        height: img.naturalHeight,
        strokes: [],
        hasBackground: true,
        thumb: photo.thumb,
        createdAt: now,
        updatedAt: now,
      });
    });
    go(`/p/${project.id}/skizze/${id}`);
  }

  return (
    <Sheet title="Foto" onClose={onClose}>
      <div className="form">
        <BufferImg data={blob?.data} mime={blob?.mime} alt={caption || 'Foto'} className="photo-full" />
        <Field label="Beschreibung">
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="z. B. Verteiler UG vor Umbau" />
        </Field>
        <Field label="Datum">
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </Field>
        <button type="button" className="btn" onClick={annotate} disabled={!blob}>
          Im Foto zeichnen / bemaßen
        </button>
        <button
          type="button"
          className="btn"
          disabled={!blob}
          onClick={() => blob && shareOrDownload(`${safeFilename(project.name)}_${photo.datum}.jpg`, new Blob([blob.data], { type: blob.mime }))}
        >
          Teilen / Sichern
        </button>
        <div className="form-actions">
          <button type="button" className="btn danger" onClick={remove}>
            Löschen
          </button>
          <button type="button" className="btn primary" onClick={save}>
            Speichern
          </button>
        </div>
      </div>
    </Sheet>
  );
}
