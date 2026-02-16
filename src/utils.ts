import type { ScanRegion } from './types.js';

/**
 * Load an image source into an ImageData object, optionally cropping to a scan region.
 */
export async function loadImageData(
  source: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap | File | Blob | URL | string,
  scanRegion?: ScanRegion | null,
  canvas?: HTMLCanvasElement | null,
): Promise<ImageData> {
  const img = await resolveImageSource(source);

  const sx = scanRegion?.x ?? 0;
  const sy = scanRegion?.y ?? 0;
  const sw = scanRegion?.width ?? (img.width - sx);
  const sh = scanRegion?.height ?? (img.height - sy);

  let drawCanvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  if (canvas) {
    drawCanvas = canvas;
    canvas.width = sw;
    canvas.height = sh;
    ctx = canvas.getContext('2d')!;
  } else if (typeof OffscreenCanvas !== 'undefined') {
    drawCanvas = new OffscreenCanvas(sw, sh);
    ctx = drawCanvas.getContext('2d')! as OffscreenCanvasRenderingContext2D;
  } else {
    drawCanvas = document.createElement('canvas');
    drawCanvas.width = sw;
    drawCanvas.height = sh;
    ctx = drawCanvas.getContext('2d')!;
  }

  ctx.drawImage(img as CanvasImageSource, sx, sy, sw, sh, 0, 0, sw, sh);
  return ctx.getImageData(0, 0, sw, sh);
}

async function resolveImageSource(
  source: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap | File | Blob | URL | string,
): Promise<HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap> {
  if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || source instanceof ImageBitmap) {
    return source;
  }

  if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
    return source;
  }

  if (source instanceof File || source instanceof Blob) {
    return createImageBitmapFromBlob(source);
  }

  // URL or string
  const url = source instanceof URL ? source.href : source;
  const response = await fetch(url);
  const blob = await response.blob();
  return createImageBitmapFromBlob(blob);
}

async function createImageBitmapFromBlob(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'undefined') {
    return createImageBitmap(blob);
  }
  // Fallback for environments without createImageBitmap
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
    });
    return img as unknown as ImageBitmap;
  } finally {
    URL.revokeObjectURL(url);
  }
}
