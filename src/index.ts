import { scanImage } from './scan-image.js';
import type {
  ScanResult,
  ScanRegion,
  ScannerOptions,
  Camera,
  Point,
  FacingMode,
  DeviceId,
  InversionMode,
} from './types.js';
import type { ReaderOptions } from 'zxing-wasm/reader';

export type {
  ScanResult,
  ScanRegion,
  ScannerOptions,
  Camera,
  Point,
  FacingMode,
  DeviceId,
  InversionMode,
};

/**
 * High-performance QR code scanner for the web, powered by ZXing-C++ WebAssembly.
 */
class QrScanner {
  /**
   * Scan a single image for QR codes.
   */
  static scanImage(
    source:
      | HTMLImageElement
      | HTMLCanvasElement
      | OffscreenCanvas
      | ImageBitmap
      | ImageData
      | Blob
      | ArrayBuffer
      | Uint8Array
      | File
      | URL
      | string,
    options?: {
      scanRegion?: ScanRegion | null;
      canvas?: HTMLCanvasElement | null;
      decoderOptions?: Partial<ReaderOptions>;
    },
  ): Promise<ScanResult> {
    return scanImage(source, options);
  }
}

export default QrScanner;
