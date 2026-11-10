import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { canvasToBuffer } from '../lib/image';

const W = 1000;
const H = 360;

/** Unterschriftsfeld im Vollbild – das Gerät wird dem Kunden hingehalten. */
export function SignaturePad({ onCancel, onSave }: { onCancel: () => void; onSave: (name: string, png: ArrayBuffer) => void | Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<[number, number] | null>(null);
  const [name, setName] = useState('');
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b1f4b';
  }, []);

  const pos = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
  };

  function down(e: RPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = pos(e);
    const ctx = canvas.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(...last.current);
    ctx.lineTo(last.current[0] + 0.1, last.current[1]);
    ctx.stroke();
    setHasInk(true);
  }

  function move(e: RPointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    const ctx = canvas.current!.getContext('2d')!;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = pos(ev);
      ctx.beginPath();
      ctx.moveTo(...last.current);
      ctx.lineTo(...p);
      ctx.stroke();
      last.current = p;
    }
  }

  const up = () => {
    last.current = null;
  };

  function clear() {
    canvas.current!.getContext('2d')!.clearRect(0, 0, W, H);
    setHasInk(false);
  }

  return (
    <div className="signpad">
      <div className="signpad-head">
        <button type="button" className="link" onClick={onCancel}>
          Abbrechen
        </button>
        <strong>Unterschrift Auftraggeber</strong>
        <button type="button" className="link" onClick={clear} disabled={!hasInk}>
          Leeren
        </button>
      </div>
      <p className="muted">Mit der Unterschrift werden die im Bericht aufgeführten Arbeitszeiten und Materialien bestätigt.</p>
      <div className="signpad-area">
        <canvas ref={canvas} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name in Druckbuchstaben" aria-label="Name des Unterzeichners" autoComplete="off" />
      <button type="button" className="btn primary" disabled={!hasInk || !name.trim()} onClick={async () => onSave(name.trim(), await canvasToBuffer(canvas.current!, 'image/png'))}>
        Unterschrift übernehmen
      </button>
    </div>
  );
}
