import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import type { WorkerRequest, WorkerResponse, Point } from './types.js';

const defaultOptions: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryInvert: true,
  tryRotate: true,
  tryDenoise: false,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

let currentOptions: ReaderOptions = { ...defaultOptions };

function mapPosition(position: {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
}): Point[] {
  return [
    position.topLeft,
    position.topRight,
    position.bottomRight,
    position.bottomLeft,
  ];
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { data } = e;

  if (data.type === 'configure') {
    currentOptions = { ...defaultOptions, ...data.options, formats: ['QRCode'] };
    return;
  }

  if (data.type === 'decode') {
    try {
      const results = await readBarcodes(data.imageData, currentOptions);
      const mapped = results
        .filter((r) => r.isValid)
        .map((r) => ({
          data: r.text,
          cornerPoints: mapPosition(r.position),
        }));

      const response: WorkerResponse = { type: 'result', results: mapped };
      self.postMessage(response);
    } catch (err) {
      const response: WorkerResponse = {
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
      self.postMessage(response);
    }
  }
};

// Signal that the worker is ready
const readyResponse: WorkerResponse = { type: 'ready' };
self.postMessage(readyResponse);
