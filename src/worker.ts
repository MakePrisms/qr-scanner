import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import type { WorkerRequest, WorkerResponse } from './types.js';
import { DEFAULT_READER_OPTIONS, mapPosition } from './decoder-utils.js';

let currentOptions: ReaderOptions = { ...DEFAULT_READER_OPTIONS };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { data } = e;

  if (data.type === 'configure') {
    currentOptions = { ...DEFAULT_READER_OPTIONS, ...data.options, formats: ['QRCode'] };
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
