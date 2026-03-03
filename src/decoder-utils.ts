import type { ReaderOptions } from 'zxing-wasm/reader';
import type { Point } from './types.js';

export const DEFAULT_READER_OPTIONS: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryInvert: true,
  tryRotate: true,
  tryDenoise: false,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

export function mapPosition(position: {
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
