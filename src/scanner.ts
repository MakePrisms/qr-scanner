import { CameraManager } from './camera.js';
import { FrameExtractor } from './frame-extractor.js';
import { ScanOverlay } from './overlay.js';
import { calculateDefaultScanRegion } from './scan-region.js';
import type {
  ScannerOptions,
  ScanResult,
  ScanRegion,
  InversionMode,
  WorkerRequest,
  WorkerResponse,
} from './types.js';
import type { ReaderOptions } from 'zxing-wasm/reader';

type OnDecodeCallback = (result: ScanResult) => void;

/**
 * Custom worker URL override. When set, this URL is used instead of the
 * default bundler-resolved worker. Useful for CJS consumers or non-standard
 * bundler setups.
 */
let customWorkerUrl: string | URL | null = null;

export function setWorkerUrl(url: string | URL): void {
  customWorkerUrl = url;
}

function resolveWorkerUrl(): string | URL {
  if (customWorkerUrl) {
    return customWorkerUrl;
  }
  // Standard pattern: modern bundlers (Vite, webpack 5, Parcel, esbuild)
  // resolve `new URL('./file', import.meta.url)` at build time,
  // copying worker.js to the output directory and returning the correct URL.
  // Falls back gracefully for CJS builds where import.meta is unavailable.
  try {
    return new URL('./worker.js', import.meta.url);
  } catch {
    throw new Error(
      '@agicash/qr-scanner: Could not resolve worker URL. ' +
        'Call QrScanner.setWorkerUrl() with the path to the worker script before creating a scanner. ' +
        'Example: QrScanner.setWorkerUrl("/path/to/@agicash/qr-scanner/dist/worker.js")',
    );
  }
}

export class Scanner {
  private video: HTMLVideoElement;
  private onDecode: OnDecodeCallback;
  private options: ScannerOptions;
  private camera: CameraManager;
  private frameExtractor: FrameExtractor | null = null;
  private worker: Worker | null = null;
  private overlay: ScanOverlay | null = null;
  private active = false;
  private paused = false;
  private destroyed = false;

  constructor(
    video: HTMLVideoElement,
    onDecode: OnDecodeCallback,
    options: ScannerOptions = {},
  ) {
    this.video = video;
    this.onDecode = onDecode;
    this.options = options;

    this.camera = new CameraManager({
      preferredCamera: options.preferredCamera,
      cameraResolution: options.cameraResolution,
    });
  }

  async start(): Promise<void> {
    if (this.destroyed) {
      throw new Error('Scanner has been destroyed');
    }

    if (this.active && !this.paused) {
      return; // Already running
    }

    const t0 = performance.now();

    // Show overlay immediately (CSS-centered placeholder) so the UI looks
    // ready while the camera is still loading.
    if (
      !this.overlay &&
      (this.options.highlightScanRegion ||
        this.options.highlightCodeOutline ||
        this.options.overlay)
    ) {
      try {
        this.overlay = new ScanOverlay(this.video, {
          highlightScanRegion: this.options.highlightScanRegion ?? false,
          highlightCodeOutline: this.options.highlightCodeOutline ?? false,
          customOverlay: this.options.overlay,
        });
        this.overlay.setup();
      } catch {
        // Overlay setup failed (e.g., no parent element) — continue without overlay
      }
    }

    // Start camera
    await this.camera.start(this.video);
    console.debug(
      `[QrScanner] start: camera ready ${(performance.now() - t0).toFixed(0)}ms`,
    );

    // Now that video dimensions are known, position overlay exactly
    if (this.overlay) {
      this.overlay.updateScanRegion(this.getCurrentScanRegion());
    }

    // Create worker if needed
    if (!this.worker) {
      const tw = performance.now();
      this.worker = this.createWorker();
      console.debug(
        `[QrScanner] start: worker created ${(performance.now() - tw).toFixed(0)}ms`,
      );
    }

    // Create frame extractor if needed
    if (!this.frameExtractor) {
      this.frameExtractor = new FrameExtractor(this.video, {
        maxScansPerSecond: this.options.maxScansPerSecond ?? 15,
        getScanRegion: () => this.getCurrentScanRegion(),
      });
    }

    // Start frame extraction loop
    this.frameExtractor.start((imageData) => {
      this.sendToWorker(imageData);
    });

    this.active = true;
    this.paused = false;

    console.debug(
      `[QrScanner] start: total ${(performance.now() - t0).toFixed(0)}ms`,
    );
  }

  stop(): void {
    this.frameExtractor?.stop();
    this.camera.stop();
    this.video.srcObject = null;
    this.active = false;
    this.paused = false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.stop();
    this.frameExtractor?.destroy();
    this.frameExtractor = null;
    this.overlay?.destroy();
    this.overlay = null;
    this.worker?.terminate();
    this.worker = null;
    this.destroyed = true;
  }

  async pause(stopStreamImmediately = true): Promise<boolean> {
    if (!this.active) return false;

    this.frameExtractor?.stop();
    this.paused = true;

    if (stopStreamImmediately) {
      this.camera.stop();
      this.video.srcObject = null;
    }

    return true;
  }

  async setCamera(facingModeOrDeviceId: string): Promise<void> {
    const wasActive = this.active && !this.paused;
    if (wasActive) {
      this.frameExtractor?.stop();
    }

    await this.camera.setCamera(facingModeOrDeviceId, this.video);

    if (wasActive) {
      this.frameExtractor?.start((imageData) => {
        this.sendToWorker(imageData);
      });
    }
  }

  async hasFlash(): Promise<boolean> {
    return this.camera.hasFlash();
  }

  isFlashOn(): boolean {
    return this.camera.isFlashOn();
  }

  async toggleFlash(): Promise<void> {
    return this.camera.toggleFlash();
  }

  async turnFlashOn(): Promise<void> {
    return this.camera.turnFlashOn();
  }

  async turnFlashOff(): Promise<void> {
    return this.camera.turnFlashOff();
  }

  setInversionMode(mode: InversionMode): void {
    if (!this.worker) return;

    const options: Partial<ReaderOptions> = {};
    switch (mode) {
      case 'original':
        options.tryInvert = false;
        break;
      case 'invert':
        options.tryInvert = true;
        break;
      case 'both':
        options.tryInvert = true;
        break;
    }

    const msg: WorkerRequest = { type: 'configure', options };
    this.worker.postMessage(msg);
  }

  isActive(): boolean {
    return this.active;
  }

  isPaused(): boolean {
    return this.paused;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  private getCurrentScanRegion(): ScanRegion {
    if (this.options.calculateScanRegion) {
      return this.options.calculateScanRegion(this.video);
    }
    return calculateDefaultScanRegion(this.video);
  }

  private createWorker(): Worker {
    const workerUrl = resolveWorkerUrl();
    const worker = new Worker(workerUrl, { type: 'module' });

    // Configure with custom decoder options
    if (this.options.decoderOptions) {
      const msg: WorkerRequest = {
        type: 'configure',
        options: this.options.decoderOptions,
      };
      worker.postMessage(msg);
    }

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(e.data);
    };

    worker.onerror = (err) => {
      console.error('QR Scanner worker error:', err);
      this.frameExtractor?.markWorkerIdle();
    };

    return worker;
  }

  private handleWorkerMessage(response: WorkerResponse): void {
    this.frameExtractor?.markWorkerIdle();

    if (response.type === 'ready') {
      return;
    }

    if (response.type === 'error') {
      this.options.onDecodeError?.(response.message);
      return;
    }

    if (response.type === 'result') {
      if (response.results.length > 0) {
        const result = response.results[0];
        this.onDecode(result);

        // Update overlay
        if (this.overlay) {
          const region = this.getCurrentScanRegion();
          this.overlay.updateScanRegion(region);
          this.overlay.updateCodeOutline(result.cornerPoints, region);
        }
      } else {
        this.options.onDecodeError?.('No QR code found');

        // Hide code outline when no QR found
        if (this.overlay) {
          this.overlay.updateCodeOutline(null);
        }
      }
    }
  }

  private sendToWorker(imageData: ImageData): void {
    if (!this.worker) return;

    const msg: WorkerRequest = { type: 'decode', imageData };
    this.worker.postMessage(msg, [imageData.data.buffer]);
  }
}
