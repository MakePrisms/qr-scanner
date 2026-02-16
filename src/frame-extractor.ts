import type { ScanRegion } from './types.js';

export interface FrameExtractorConfig {
  maxScansPerSecond: number;
  getScanRegion: () => ScanRegion;
}

export class FrameExtractor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private rafId: number | null = null;
  private running = false;
  private workerBusy = false;
  private lastScanTime = -Infinity;
  private minInterval: number;
  private getScanRegion: () => ScanRegion;
  private onFrame: ((imageData: ImageData) => void) | null = null;

  constructor(video: HTMLVideoElement, config: FrameExtractorConfig) {
    this.video = video;
    this.minInterval = 1000 / config.maxScansPerSecond;
    this.getScanRegion = config.getScanRegion;

    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(1, 1);
      this.ctx = this.canvas.getContext('2d')! as OffscreenCanvasRenderingContext2D;
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.style.display = 'none';
      this.ctx = this.canvas.getContext('2d')!;
    }
  }

  start(onFrame: (imageData: ImageData) => void): void {
    if (this.running) return;
    this.running = true;
    this.onFrame = onFrame;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    this.onFrame = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.stop();
    if (this.canvas instanceof HTMLCanvasElement && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  markWorkerIdle(): void {
    this.workerBusy = false;
  }

  markWorkerBusy(): void {
    this.workerBusy = true;
  }

  private tick = (): void => {
    if (!this.running) return;

    this.rafId = requestAnimationFrame(this.tick);

    // Skip if worker is still processing previous frame
    if (this.workerBusy) return;

    // Rate limiting
    const now = performance.now();
    if (now - this.lastScanTime < this.minInterval) return;

    // Skip if video isn't ready
    if (this.video.readyState < 2) return;

    this.lastScanTime = now;

    const region = this.getScanRegion();
    const sx = region.x ?? 0;
    const sy = region.y ?? 0;
    const sw = region.width ?? this.video.videoWidth;
    const sh = region.height ?? this.video.videoHeight;

    if (sw <= 0 || sh <= 0) return;

    this.canvas.width = sw;
    this.canvas.height = sh;

    this.ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, sw, sh);
    const imageData = this.ctx.getImageData(0, 0, sw, sh);

    this.workerBusy = true;
    this.onFrame?.(imageData);
  };
}
