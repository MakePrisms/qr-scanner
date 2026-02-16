import { describe, it, expect } from 'vitest';
import { calculateDefaultScanRegion } from '../src/scan-region.js';

function createMockVideo(videoWidth: number, videoHeight: number): HTMLVideoElement {
  return { videoWidth, videoHeight, width: 0, height: 0 } as HTMLVideoElement;
}

describe('calculateDefaultScanRegion', () => {
  it('returns centered square of 2/3 smaller dimension for landscape video', () => {
    const video = createMockVideo(1920, 1080);
    const region = calculateDefaultScanRegion(video);

    expect(region.width).toBe(720);
    expect(region.height).toBe(720);
    expect(region.x).toBe(600);
    expect(region.y).toBe(180);
  });

  it('returns centered square of 2/3 smaller dimension for portrait video', () => {
    const video = createMockVideo(1080, 1920);
    const region = calculateDefaultScanRegion(video);

    expect(region.width).toBe(720);
    expect(region.height).toBe(720);
    expect(region.x).toBe(180);
    expect(region.y).toBe(600);
  });

  it('returns centered square of 2/3 for square video', () => {
    const video = createMockVideo(1080, 1080);
    const region = calculateDefaultScanRegion(video);

    expect(region.width).toBe(720);
    expect(region.height).toBe(720);
    expect(region.x).toBe(180);
    expect(region.y).toBe(180);
  });

  it('handles very small video dimensions without error', () => {
    const video = createMockVideo(10, 5);
    const region = calculateDefaultScanRegion(video);

    expect(region.width).toBe(3);
    expect(region.height).toBe(3);
    expect(region.x).toBe(4); // Math.round((10 - 3) / 2) = 4
    expect(region.y).toBe(1);
  });

  it('handles zero dimensions without error', () => {
    const video = createMockVideo(0, 0);
    const region = calculateDefaultScanRegion(video);

    expect(region.width).toBe(0);
    expect(region.height).toBe(0);
    expect(region.x).toBe(0);
    expect(region.y).toBe(0);
  });

  it('falls back to width/height when videoWidth/videoHeight are 0', () => {
    const video = { videoWidth: 0, videoHeight: 0, width: 640, height: 480 } as HTMLVideoElement;
    const region = calculateDefaultScanRegion(video);

    expect(region.width).toBe(320);
    expect(region.height).toBe(320);
  });
});
