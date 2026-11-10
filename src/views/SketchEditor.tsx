import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as RPointerEvent } from 'react';
import { db, touchProject, type Sketch, type SketchTool, type Stroke } from '../db';
import { canvasToBuffer, loadImage } from '../lib/image';
import { COLORS, drawStroke, drawStrokes, widthsFor } from '../lib/sketch';
import { go } from '../lib/router';
import { Icon, Sheet } from '../components/ui';

const TOOLS: { id: SketchTool; label: string; icon: string }[] = [
  { id: 'pen', label: 'Stift', icon: 'pencil' },
  { id: 'line', label: 'Linie', icon: 'line' },
  { id: 'rect', label: 'Rechteck', icon: 'rect' },
  { id: 'text', label: 'Text / Maß', icon: 'text' },
  { id: 'eraser', label: 'Radierer', icon: 'eraser' },
];

export default function SketchEditor({ projectId, sketchId }: { projectId: string; sketchId: string }) {
  const [sketch, setSketch] = useState<Sketch | null>();
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const [titel, setTitel] = useState('');
  const [tool, setTool] = useState<SketchTool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [widthIdx, setWidthIdx] = useState(1);
  const [textAt, setTextAt] = useState<[number, number] | null>(null);
  const [fit, setFit] = useState({ w: 0, h: 0 });

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bgCanvas = useRef<HTMLCanvasElement>(null);
  const committed = useRef<HTMLCanvasElement | null>(null);
  const current = useRef<Stroke | null>(null);
  const pointer = useRef<number | null>(null);
  const penSeen = useRef(false);
  const dirty = useRef(false);
  const back = `/p/${projectId}/skizzen`;

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = (await db.sketches.get(sketchId)) ?? null;
      let img: HTMLImageElement | null = null;
      if (s?.hasBackground) {
        const b = await db.blobs.get(`${sketchId}:bg`);
        if (b) img = await loadImage(new Blob([b.data], { type: b.mime })).catch(() => null);
      }
      if (!alive) return;
      if (s) {
        const off = document.createElement('canvas');
        off.width = s.width;
        off.height = s.height;
        committed.current = off;
        setStrokes(s.strokes);
        setTitel(s.titel);
      }
      setBg(img);
      setSketch(s);
    })();
    return () => {
      alive = false;
    };
  }, [sketchId]);

  const paint = useCallback(() => {
    const c = canvas.current;
    const off = committed.current;
    if (!c || !off) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(off, 0, 0);
    if (current.current) drawStroke(ctx, current.current, Math.max(c.width, c.height));
  }, []);

  // Fertige Striche liegen auf einer Offscreen-Ebene; beim Zeichnen wird nur der aktuelle Strich neu gerendert.
  useLayoutEffect(() => {
    const off = committed.current;
    if (!off || !sketch) return;
    drawStrokes(off.getContext('2d')!, strokes, off.width, off.height);
    paint();
  }, [strokes, sketch, paint]);

  // Hintergrundfoto auf eigener Ebene unter der Zeichnung.
  useLayoutEffect(() => {
    const c = bgCanvas.current;
    if (c && bg) c.getContext('2d')!.drawImage(bg, 0, 0, c.width, c.height);
  }, [bg, sketch]);

  // Zeichenfläche formatfüllend einpassen (kein Zoom/Verschieben – bewusst einfach gehalten).
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el || !sketch) return;
    const update = () => {
      const scale = Math.min(el.clientWidth / sketch.width, el.clientHeight / sketch.height);
      setFit({ w: Math.floor(sketch.width * scale), h: Math.floor(sketch.height * scale) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sketch]);

  const persist = useCallback(async () => {
    const off = committed.current;
    if (!sketch || !off || !dirty.current) return;
    dirty.current = false;
    const out = document.createElement('canvas');
    out.width = sketch.width;
    out.height = sketch.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    if (bg) ctx.drawImage(bg, 0, 0, out.width, out.height);
    ctx.drawImage(off, 0, 0);
    // Strichzeichnung als PNG (scharf, klein), mit Foto als JPEG.
    const mime = bg ? 'image/jpeg' : 'image/png';
    const data = await canvasToBuffer(out, mime, 0.85);
    const scale = 480 / Math.max(out.width, out.height);
    const small = document.createElement('canvas');
    small.width = Math.round(out.width * scale);
    small.height = Math.round(out.height * scale);
    small.getContext('2d')!.drawImage(out, 0, 0, small.width, small.height);
    const thumb = await canvasToBuffer(small, 'image/jpeg', 0.75);
    await db.transaction('rw', db.sketches, db.blobs, async () => {
      await db.sketches.update(sketch.id, { strokes, titel: titel.trim(), thumb, updatedAt: Date.now() });
      await db.blobs.put({ id: sketch.id, projectId, data, mime });
    });
  }, [sketch, bg, strokes, titel, projectId]);

  // Automatisch sichern: kurz nach jeder Änderung und wenn die App in den Hintergrund geht
  // (iOS beendet Hintergrund-Apps ohne Vorwarnung).
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => void persist(), 1200);
    return () => clearTimeout(t);
  }, [persist]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void persist();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [persist]);

  const change = (next: Stroke[], nextRedo: Stroke[]) => {
    dirty.current = true;
    setStrokes(next);
    setRedo(nextRedo);
  };

  async function done() {
    if (sketch && !sketch.hasBackground && strokes.length === 0 && !titel.trim()) {
      // Leere Skizze nicht als Karteileiche behalten.
      await db.transaction('rw', db.sketches, db.blobs, async () => {
        await db.sketches.delete(sketch.id);
        await db.blobs.delete(sketch.id);
      });
    } else {
      await persist();
      await touchProject(projectId);
    }
    go(back, true);
  }

  async function remove() {
    if (!sketch || !window.confirm('Skizze wirklich löschen?')) return;
    dirty.current = false;
    await db.transaction('rw', db.sketches, db.blobs, async () => {
      await db.sketches.delete(sketch.id);
      await db.blobs.bulkDelete([sketch.id, `${sketch.id}:bg`]);
    });
    go(back, true);
  }

  const widths = sketch ? widthsFor(sketch.width, sketch.height) : [4, 8, 16];

  function pos(e: { clientX: number; clientY: number }): [number, number] {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) * c.width * 10) / r.width) / 10, Math.round(((e.clientY - r.top) * c.height * 10) / r.height) / 10];
  }

  function onDown(e: RPointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'pen') penSeen.current = true;
    // Handballen-Schutz: Sobald ein Apple Pencil benutzt wurde, zeichnet nur noch der Stift.
    if (penSeen.current && e.pointerType === 'touch') return;
    if (pointer.current !== null) return;
    const p = pos(e);
    if (tool === 'text') {
      setTextAt(p);
      return;
    }
    pointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = { tool, color, width: widths[widthIdx], points: [p] };
    paint();
  }

  function onMove(e: RPointerEvent<HTMLCanvasElement>) {
    const s = current.current;
    if (!s || e.pointerId !== pointer.current) return;
    if (s.tool === 'line' || s.tool === 'rect') {
      s.points[1] = pos(e);
    } else {
      // Zwischenpunkte mitnehmen, sonst werden schnelle Striche eckig.
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
      for (const ev of events.length ? events : [e.nativeEvent]) {
        const p = pos(ev);
        const l = s.points[s.points.length - 1];
        if (Math.hypot(p[0] - l[0], p[1] - l[1]) >= 2) s.points.push(p);
      }
    }
    paint();
  }

  function onUp(e: RPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== pointer.current) return;
    pointer.current = null;
    const s = current.current;
    current.current = null;
    if (!s) return;
    const isShape = s.tool === 'line' || s.tool === 'rect';
    if (isShape && s.points.length < 2) {
      paint(); // nur angetippt – keine Form
      return;
    }
    change([...strokes, s], []);
  }

  function addText(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get('text') ?? '').trim();
    if (text && textAt) change([...strokes, { tool: 'text', color, width: widths[widthIdx], points: [textAt], text }], []);
    setTextAt(null);
  }

  if (sketch === undefined) return null;
  if (sketch === null) {
    return (
      <div className="editor">
        <div className="editor-top">
          <a className="link" href={'#' + back}>
            Zurück
          </a>
          <span>Skizze nicht gefunden</span>
        </div>
      </div>
    );
  }

  return (
    <div className="editor">
      <div className="editor-top">
        <button type="button" className="link strong" onClick={done}>
          Fertig
        </button>
        <input
          className="editor-title"
          value={titel}
          placeholder="Titel der Skizze"
          aria-label="Titel der Skizze"
          onChange={(e) => {
            dirty.current = true;
            setTitel(e.target.value);
          }}
        />
        <button type="button" className="hbtn" aria-label="Rückgängig" disabled={!strokes.length} onClick={() => change(strokes.slice(0, -1), [...redo, strokes[strokes.length - 1]])}>
          <Icon name="undo" />
        </button>
        <button type="button" className="hbtn" aria-label="Wiederholen" disabled={!redo.length} onClick={() => change([...strokes, redo[redo.length - 1]], redo.slice(0, -1))}>
          <Icon name="redo" />
        </button>
        <button type="button" className="hbtn" aria-label="Skizze löschen" onClick={remove}>
          <Icon name="trash" />
        </button>
      </div>

      <div className="stage" ref={stage}>
        <div className="paper" style={{ width: fit.w, height: fit.h }}>
          {bg && <canvas ref={bgCanvas} width={sketch.width} height={sketch.height} className="bg" />}
          <canvas ref={canvas} width={sketch.width} height={sketch.height} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        </div>
      </div>

      <div className="editor-tools">
        <div className="toolgroup">
          {TOOLS.map((t) => (
            <button key={t.id} type="button" className={tool === t.id ? 'tool on' : 'tool'} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
              <Icon name={t.icon} />
            </button>
          ))}
        </div>
        <div className="toolgroup">
          {widths.map((_, i) => (
            <button key={i} type="button" className={widthIdx === i ? 'tool on' : 'tool'} aria-label={`Strichstärke ${i + 1}`} aria-pressed={widthIdx === i} onClick={() => setWidthIdx(i)}>
              <span className="dot" style={{ width: 4 + i * 5, height: 4 + i * 5 }} />
            </button>
          ))}
        </div>
        <div className="toolgroup">
          {COLORS.map((c) => (
            <button key={c} type="button" className={color === c ? 'tool on' : 'tool'} aria-label={`Farbe ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}>
              <span className="swatch" style={{ background: c }} />
            </button>
          ))}
        </div>
      </div>

      {textAt && (
        <Sheet title="Text / Maß einfügen" onClose={() => setTextAt(null)}>
          <form className="form" onSubmit={addText}>
            <input name="text" autoFocus placeholder="z. B. 2,45 m oder DN100" autoComplete="off" />
            <div className="form-actions">
              <button type="submit" className="btn primary">
                Einfügen
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
}
