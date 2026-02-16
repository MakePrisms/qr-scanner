import type { ScanRegion, Point } from './types.js';

export interface OverlayConfig {
  highlightScanRegion: boolean;
  highlightCodeOutline: boolean;
  customOverlay?: HTMLDivElement;
}

export class ScanOverlay {
  private container: HTMLElement;
  private overlayEl: HTMLDivElement | null = null;
  private codeOutlineEl: SVGElement | null = null;
  private config: OverlayConfig;
  private video: HTMLVideoElement;

  constructor(
    video: HTMLVideoElement,
    config: OverlayConfig,
  ) {
    this.video = video;
    this.config = config;

    const parent = video.parentElement;
    if (!parent) {
      throw new Error(
        'QrScanner: video element must have a parent element. ' +
        'The parent should have position: relative.',
      );
    }
    this.container = parent;
  }

  setup(): void {
    if (this.config.customOverlay) {
      this.overlayEl = this.config.customOverlay;
      this.positionOverlay();
      return;
    }

    if (this.config.highlightScanRegion) {
      this.createScanRegionOverlay();
    }

    if (this.config.highlightCodeOutline) {
      this.createCodeOutline();
    }
  }

  updateScanRegion(region: ScanRegion): void {
    if (!this.overlayEl || this.config.customOverlay) return;
    this.positionOverlayToRegion(region);
  }

  updateCodeOutline(cornerPoints: Point[] | null, scanRegion?: ScanRegion): void {
    if (!this.codeOutlineEl) return;

    if (!cornerPoints || cornerPoints.length < 4) {
      this.codeOutlineEl.style.display = 'none';
      return;
    }

    this.codeOutlineEl.style.display = 'block';

    const polygon = this.codeOutlineEl.querySelector('polygon');
    if (!polygon) return;

    // Corner points are relative to the cropped scan region.
    // Add the scan region offset to get full video coordinates,
    // then scale to display coordinates.
    const regionX = scanRegion?.x ?? 0;
    const regionY = scanRegion?.y ?? 0;
    const videoRect = this.video.getBoundingClientRect();
    const scaleX = videoRect.width / this.video.videoWidth;
    const scaleY = videoRect.height / this.video.videoHeight;

    const points = cornerPoints
      .map((p) => `${(p.x + regionX) * scaleX},${(p.y + regionY) * scaleY}`)
      .join(' ');

    polygon.setAttribute('points', points);
  }

  destroy(): void {
    if (this.overlayEl && !this.config.customOverlay) {
      this.overlayEl.remove();
    }
    if (this.codeOutlineEl) {
      this.codeOutlineEl.remove();
    }
    this.overlayEl = null;
    this.codeOutlineEl = null;
  }

  private createScanRegionOverlay(): void {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'qr-scanner-region';

    Object.assign(this.overlayEl.style, {
      position: 'absolute',
      border: '2px solid rgba(255, 255, 255, 0.5)',
      borderRadius: '8px',
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
      pointerEvents: 'none',
      zIndex: '10',
    });

    // Corner markers
    const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    for (const corner of corners) {
      const marker = document.createElement('div');
      marker.className = `qr-scanner-corner qr-scanner-corner-${corner}`;

      const [vertical, horizontal] = corner.split('-');

      Object.assign(marker.style, {
        position: 'absolute',
        width: '24px',
        height: '24px',
        [vertical]: '-2px',
        [horizontal]: '-2px',
        [`border-${vertical}`]: '3px solid white',
        [`border-${horizontal}`]: '3px solid white',
        [`border-${vertical}-${horizontal}-radius`]: '8px',
      });

      this.overlayEl.appendChild(marker);
    }

    this.container.appendChild(this.overlayEl);
  }

  private createCodeOutline(): void {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'qr-scanner-code-outline');

    Object.assign(svg.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '11',
      display: 'none',
    });

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', '#00ff00');
    polygon.setAttribute('stroke-width', '3');
    polygon.setAttribute('stroke-linejoin', 'round');

    // Animated stroke
    const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    animate.setAttribute('attributeName', 'stroke-opacity');
    animate.setAttribute('values', '1;0.5;1');
    animate.setAttribute('dur', '1.5s');
    animate.setAttribute('repeatCount', 'indefinite');
    polygon.appendChild(animate);

    svg.appendChild(polygon);
    this.container.appendChild(svg);
    this.codeOutlineEl = svg;
  }

  private positionOverlay(): void {
    if (!this.overlayEl) return;

    Object.assign(this.overlayEl.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '10',
    });
  }

  private positionOverlayToRegion(region: ScanRegion): void {
    if (!this.overlayEl) return;

    const videoRect = this.video.getBoundingClientRect();
    const videoWidth = this.video.videoWidth || 1;
    const videoHeight = this.video.videoHeight || 1;
    const scaleX = videoRect.width / videoWidth;
    const scaleY = videoRect.height / videoHeight;

    const x = (region.x ?? 0) * scaleX;
    const y = (region.y ?? 0) * scaleY;
    const w = (region.width ?? videoWidth) * scaleX;
    const h = (region.height ?? videoHeight) * scaleY;

    Object.assign(this.overlayEl.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
  }
}
