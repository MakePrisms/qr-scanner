import { CameraManager } from './camera.js';
import { FrameExtractor } from './frame-extractor.js';
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

export class Scanner {
  private video: HTMLVideoElement;
  private onDecode: OnDecodeCallback;
  private options: ScannerOptions;
  private camera: CameraManager;
  private frameExtractor: FrameExtractor | null = null;
  private worker: Worker | null = null;
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

    // Start camera
    await this.camera.start(this.video);

    // Create worker if needed
    if (!this.worker) {
      this.worker = this.createWorker();
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
    // Create an inline worker that imports the worker module
    const workerCode = `import { readBarcodes } from 'zxing-wasm/reader';

const defaultOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryInvert: true,
  tryRotate: true,
  tryDenoise: false,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

let currentOptions = { ...defaultOptions };

function mapPosition(position) {
  return [
    position.topLeft,
    position.topRight,
    position.bottomRight,
    position.bottomLeft,
  ];
}

self.onmessage = async (e) => {
  const data = e.data;

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
      self.postMessage({ type: 'result', results: mapped });
    } catch (err) {
      self.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};

self.postMessage({ type: 'ready' });`;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url, { type: 'module' });
    URL.revokeObjectURL(url);

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
        this.onDecode(response.results[0]);
      } else {
        this.options.onDecodeError?.('No QR code found');
      }
    }
  }

  private sendToWorker(imageData: ImageData): void {
    if (!this.worker) return;

    const msg: WorkerRequest = { type: 'decode', imageData };
    this.worker.postMessage(msg, [imageData.data.buffer]);
  }
}
