import { Scanner, setWorkerUrl } from './scanner.js';
import {
  CameraManager,
  CameraNotFoundError,
  CameraPermissionError,
} from './camera.js';
import { setDebug } from './debug.js';
import { scanImage } from './scan-image.js';
import { setZXingModuleOverrides } from 'zxing-wasm/reader';
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

export { CameraNotFoundError, CameraPermissionError };

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
  private scanner: Scanner;

  constructor(
    videoElement: HTMLVideoElement,
    onDecode: (result: ScanResult) => void,
    options: ScannerOptions = {},
  ) {
    this.scanner = new Scanner(videoElement, onDecode, options);
  }

  /** Start camera and begin scanning. Resolves when camera is ready. */
  async start(): Promise<void> {
    return this.scanner.start();
  }

  /** Stop scanning and release the camera stream. */
  stop(): void {
    this.scanner.stop();
  }

  /** Stop scanning, release camera, terminate worker, clean up DOM. */
  destroy(): void {
    this.scanner.destroy();
  }

  /** Pause scanning. If stopStreamImmediately is false, camera stays on. */
  async pause(stopStreamImmediately?: boolean): Promise<boolean> {
    return this.scanner.pause(stopStreamImmediately);
  }

  /** Switch to a different camera by facing mode or device ID. */
  async setCamera(facingModeOrDeviceId: FacingMode | DeviceId): Promise<void> {
    return this.scanner.setCamera(facingModeOrDeviceId);
  }

  /** Check if the current camera supports flash/torch. */
  async hasFlash(): Promise<boolean> {
    return this.scanner.hasFlash();
  }

  /** Whether flash is currently on. */
  isFlashOn(): boolean {
    return this.scanner.isFlashOn();
  }

  /** Toggle flash on/off. */
  async toggleFlash(): Promise<void> {
    return this.scanner.toggleFlash();
  }

  /** Turn flash on. */
  async turnFlashOn(): Promise<void> {
    return this.scanner.turnFlashOn();
  }

  /** Turn flash off. */
  async turnFlashOff(): Promise<void> {
    return this.scanner.turnFlashOff();
  }

  /** Set the inversion mode for detecting inverted QR codes. */
  setInversionMode(mode: InversionMode): void {
    this.scanner.setInversionMode(mode);
  }

  // --- Static methods ---

  /** Check if the device has at least one camera. */
  static hasCamera(): Promise<boolean> {
    return CameraManager.hasCamera();
  }

  /** List available cameras. Pass true to request labels (triggers permission prompt). */
  static listCameras(requestLabels?: boolean): Promise<Camera[]> {
    return CameraManager.listCameras(requestLabels);
  }

  /**
   * Pre-load the WASM binary so it's ready when the scanner starts.
   * Call this early (e.g., on app init) to avoid delay on first scan.
   */
  static async preload(): Promise<void> {
    // Trigger WASM loading by doing a minimal scan
    const pixel = new Uint8ClampedArray([255, 255, 255, 255]);
    const img = new ImageData(pixel, 1, 1);
    try {
      await scanImage(img);
    } catch {
      // Expected — no QR code in a 1x1 image. The point was to load WASM.
    }
  }

  /**
   * Configure WASM loading. Call before creating any scanner instance.
   * @example
   * QrScanner.configureWasm({ locateFile: (filename) => `/wasm/${filename}` });
   */
  static configureWasm(overrides: Partial<EmscriptenModule>): void {
    setZXingModuleOverrides(overrides);
  }

  /**
   * Set a custom URL for the worker script. Call before creating any scanner.
   * Needed for CJS consumers or non-standard bundler setups.
   * By default, the worker URL is resolved via `new URL('./worker.js', import.meta.url)`,
   * which works with Vite, webpack 5, Parcel, and other modern bundlers.
   * @example
   * QrScanner.setWorkerUrl('/assets/qr-scanner-worker.js');
   */
  static setWorkerUrl(url: string | URL): void {
    setWorkerUrl(url);
  }

  /**
   * Enable or disable debug logging (performance timings, camera selection).
   * Off by default. Useful for diagnosing camera issues in the browser console.
   * @example
   * QrScanner.setDebug(true);
   */
  static setDebug(enabled: boolean): void {
    setDebug(enabled);
  }

  /** Scan a single image (not a video stream). */
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
