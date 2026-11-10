import type { Stroke } from '../db';

export const COLORS = ['#111111', '#d92d20', '#1d6fd8', '#17803d', '#f28c28'];

/** Strichstärken relativ zur Zeichenfläche, damit sie auf iPhone und iPad gleich wirken. */
export function widthsFor(w: number, h: number): number[] {
  const edge = Math.max(w, h);
  return [0.003, 0.006, 0.012].map((f) => Math.round(edge * f * 10) / 10);
}

export function textSize(s: Stroke, edge: number): number {
  return s.width * 4 + edge * 0.028;
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, edge: number) {
  const p = s.points;
  if (!p.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  const last = p[p.length - 1];

  switch (s.tool) {
    case 'eraser':
    case 'pen': {
      if (s.tool === 'eraser') {
        // Radiert nur die Zeichnung, nicht das Hintergrundfoto (liegt auf eigener Ebene).
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = s.width * 5;
      }
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + 0.01, p[0][1]);
      // Quadratische Kurven durch die Mittelpunkte glätten die Freihandlinie.
      for (let i = 1; i < p.length - 1; i++) {
        ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      }
      if (p.length > 1) ctx.lineTo(last[0], last[1]);
      ctx.stroke();
      break;
    }
    case 'line':
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
      break;
    case 'rect':
      ctx.strokeRect(p[0][0], p[0][1], last[0] - p[0][0], last[1] - p[0][1]);
      break;
    case 'text': {
      if (!s.text) break;
      ctx.font = `600 ${textSize(s, edge)}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      // Weißer Rand, damit Maße auch auf Fotos lesbar bleiben.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(3, textSize(s, edge) / 7);
      ctx.lineJoin = 'round';
      ctx.strokeText(s.text, p[0][0], p[0][1]);
      ctx.fillText(s.text, p[0][0], p[0][1]);
      break;
    }
  }
  ctx.restore();
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const edge = Math.max(w, h);
  for (const s of strokes) drawStroke(ctx, s, edge);
}
