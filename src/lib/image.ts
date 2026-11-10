import { useEffect, useState } from 'react';

export interface ScaledImage {
  data: ArrayBuffer;
  mime: string;
  width: number;
  height: number;
}

export function loadImage(src: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Bild konnte nicht gelesen werden.'));
    };
    img.src = url;
  });
}

export function canvasToBuffer(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? b.arrayBuffer().then(resolve, reject) : reject(new Error('Bild konnte nicht erzeugt werden.'))),
      mime,
      quality,
    );
  });
}

/**
 * Verkleinert ein Bild auf max. Kantenlänge. Handyfotos haben 3–12 MB; unverkleinert
 * wäre der Gerätespeicher nach wenigen Baustellen voll.
 */
export async function scaleImage(src: Blob | HTMLImageElement, maxEdge: number, quality = 0.8): Promise<ScaledImage> {
  const img = src instanceof Blob ? await loadImage(src) : src;
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const data = await canvasToBuffer(canvas, 'image/jpeg', quality);
  canvas.width = canvas.height = 0; // iOS gibt Canvas-Speicher sonst nur zögerlich frei
  return { data, mime: 'image/jpeg', width, height };
}

/** Object-URL für Binärdaten, wird beim Wechsel/Unmount wieder freigegeben. */
export function useBlobUrl(data: ArrayBuffer | null | undefined, mime = 'image/jpeg'): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!data) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(new Blob([data], { type: mime }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data, mime]);
  return url;
}
