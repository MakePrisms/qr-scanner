import type { ScanRegion, Point } from './types.js';

/**
 * Compute the actual rendered position and size of the video content
 * within the element, accounting for object-fit: cover.
 *
 * With object-fit: cover the video is scaled up to fill the element and
 * cropped. The rendered content is larger than the element, centered,
 * with negative offsets for the cropped portions.
 *
 * When object-fit is the default (fill), the rendered size equals the
 * element size and offsets are zero — so this is backwards-compatible.
 */
function getRenderedVideoRect(video: HTMLVideoElement): {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
} {
  const elementWidth = video.clientWidth;
  const elementHeight = video.clientHeight;
  const videoWidth = video.videoWidth || 1;
  const videoHeight = video.videoHeight || 1;

  const objectFit = getComputedStyle(video).objectFit;

  if (objectFit === 'cover') {
    const scale = Math.max(
      elementWidth / videoWidth,
      elementHeight / videoHeight,
    );
    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;
    return {
      offsetX: (elementWidth - renderedWidth) / 2,
      offsetY: (elementHeight - renderedHeight) / 2,
      width: renderedWidth,
      height: renderedHeight,
    };
  }

  if (objectFit === 'contain') {
    const scale = Math.min(
      elementWidth / videoWidth,
      elementHeight / videoHeight,
    );
    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;
    return {
      offsetX: (elementWidth - renderedWidth) / 2,
      offsetY: (elementHeight - renderedHeight) / 2,
      width: renderedWidth,
      height: renderedHeight,
    };
  }

  // Default (fill / none / scale-down with no scaling needed): element dimensions
  return { offsetX: 0, offsetY: 0, width: elementWidth, height: elementHeight };
}

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

  constructor(video: HTMLVideoElement, config: OverlayConfig) {
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

  updateCodeOutline(
    cornerPoints: Point[] | null,
    scanRegion?: ScanRegion,
  ): void {
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
    // then scale to display coordinates (accounting for object-fit).
    const regionX = scanRegion?.x ?? 0;
    const regionY = scanRegion?.y ?? 0;
    const rendered = getRenderedVideoRect(this.video);
    const scaleX = rendered.width / this.video.videoWidth;
    const scaleY = rendered.height / this.video.videoHeight;

    const points = cornerPoints
      .map(
        (p) =>
          `${(p.x + regionX) * scaleX + rendered.offsetX},${(p.y + regionY) * scaleY + rendered.offsetY}`,
      )
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

    // Placeholder size: 2/3 of the smaller container dimension ensures
    // the overlay stays visible and centered before video dimensions are
    // known. positionOverlayToRegion() overrides with exact values once
    // the camera starts.
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const size = Math.round((Math.min(cw, ch) * 2) / 3);

    Object.assign(this.overlayEl.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${size}px`,
      height: `${size}px`,
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

    const polygon = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'polygon',
    );
    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', '#00ff00');
    polygon.setAttribute('stroke-width', '3');
    polygon.setAttribute('stroke-linejoin', 'round');

    // Animated stroke
    const animate = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'animate',
    );
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

  private positionOverlayToRegion(_region: ScanRegion): void {
    if (!this.overlayEl) return;

    // Keep the overlay at a container-relative centered size rather than
    // mapping scan region coordinates to display coordinates. With
    // object-fit: cover on a portrait phone with a landscape camera, the
    // mapped region extends beyond the container — fine once the camera is
    // visible but causes a jarring jump from the initial placeholder.
    // The overlay is a visual guide; the actual scan area (in the frame
    // extractor) is unaffected and may be larger than what's shown.
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const size = Math.round((Math.min(cw, ch) * 2) / 3);

    // Only update size — initial CSS centering (top: 50%, left: 50%,
    // transform: translate(-50%, -50%)) persists and handles re-centering.
    Object.assign(this.overlayEl.style, {
      width: `${size}px`,
      height: `${size}px`,
    });
  }
}
