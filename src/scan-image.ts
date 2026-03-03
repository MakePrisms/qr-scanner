import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import type { ScanResult, ScanRegion } from './types.js';
import { loadImageData } from './utils.js';
import { DEFAULT_READER_OPTIONS, mapPosition } from './decoder-utils.js';

/** Input types that zxing-wasm can handle directly (no canvas needed). */
type DirectInput = Blob | ArrayBuffer | Uint8Array | ImageData;

/** Input types that need canvas-based pixel extraction. */
type CanvasInput = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap;

function isDirectInput(source: unknown): source is DirectInput {
  return (
    source instanceof Blob ||
    source instanceof ArrayBuffer ||
    source instanceof Uint8Array ||
    (typeof ImageData !== 'undefined' && source instanceof ImageData)
  );
}

/**
 * Scan a single image for QR codes. Does not require a camera or video stream.
 */
export async function scanImage(
  source:
    | CanvasInput
    | DirectInput
    | File
    | URL
    | string,
  options?: {
    scanRegion?: ScanRegion | null;
    canvas?: HTMLCanvasElement | null;
    decoderOptions?: Partial<ReaderOptions>;
  },
): Promise<ScanResult> {
  const readerOptions: ReaderOptions = {
    ...DEFAULT_READER_OPTIONS,
    ...options?.decoderOptions,
    formats: ['QRCode'],
  };

  let input: DirectInput;
  if (isDirectInput(source)) {
    input = source;
  } else if (typeof source === 'string' || source instanceof URL) {
    // URL string - fetch and pass as ArrayBuffer
    const url = source instanceof URL ? source.href : source;
    const response = await fetch(url);
    input = await response.arrayBuffer();
  } else {
    // Canvas-based sources - extract ImageData
    input = await loadImageData(source, options?.scanRegion, options?.canvas);
  }

  const results = await readBarcodes(input, readerOptions);
  const valid = results.filter((r) => r.isValid);

  if (valid.length === 0) {
    throw new Error('No QR code found in the image');
  }

  const first = valid[0];
  return {
    data: first.text,
    cornerPoints: mapPosition(first.position),
  };
}
