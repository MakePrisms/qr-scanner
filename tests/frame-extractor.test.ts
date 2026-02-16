import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FrameExtractor } from '../src/frame-extractor.js';

function createMockVideo(overrides: Record<string, unknown> = {}): HTMLVideoElement {
  return {
    videoWidth: 1920,
    videoHeight: 1080,
    readyState: 4, // HAVE_ENOUGH_DATA
    ...overrides,
  } as unknown as HTMLVideoElement;
}

describe('FrameExtractor', () => {
  let rafCallbacks: Array<(time: number) => void>;
  let originalRAF: typeof requestAnimationFrame;
  let originalCancelRAF: typeof cancelAnimationFrame;
  let originalPerformanceNow: typeof performance.now;
  let currentTime: number;

  beforeEach(() => {
    rafCallbacks = [];
    currentTime = 0;

    originalRAF = globalThis.requestAnimationFrame;
    originalCancelRAF = globalThis.cancelAnimationFrame;
    originalPerformanceNow = performance.now;

    globalThis.requestAnimationFrame = vi.fn((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      rafCallbacks[id - 1] = () => {};
    });

    vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

    // Mock OffscreenCanvas
    if (typeof OffscreenCanvas === 'undefined') {
      const mockCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue(
          new ImageData(new Uint8ClampedArray(100 * 100 * 4), 100, 100),
        ),
      };

      vi.stubGlobal(
        'OffscreenCanvas',
        class MockOffscreenCanvas {
          width = 0;
          height = 0;
          getContext() {
            return mockCtx;
          }
        },
      );
    }
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCancelRAF;
    vi.restoreAllMocks();
  });

  function flushRAF(time?: number) {
    if (time !== undefined) {
      currentTime = time;
    }
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    callbacks.forEach((cb) => cb(currentTime));
  }

  it('extracts ImageData from the scan region of a video frame', () => {
    const video = createMockVideo();
    const onFrame = vi.fn();

    const extractor = new FrameExtractor(video, {
      maxScansPerSecond: 30,
      getScanRegion: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });

    extractor.start(onFrame);
    flushRAF(100);

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenCalledWith(expect.any(ImageData));

    extractor.destroy();
  });

  it('respects maxScansPerSecond rate limit', () => {
    const video = createMockVideo();
    const onFrame = vi.fn();

    const extractor = new FrameExtractor(video, {
      maxScansPerSecond: 10, // 100ms interval
      getScanRegion: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });

    extractor.start(onFrame);

    // First frame at t=0
    flushRAF(0);
    expect(onFrame).toHaveBeenCalledTimes(1);

    // Mark worker idle so it can process next frame
    extractor.markWorkerIdle();

    // Too soon (50ms < 100ms)
    flushRAF(50);
    expect(onFrame).toHaveBeenCalledTimes(1);

    // Now enough time has passed
    flushRAF(110);
    expect(onFrame).toHaveBeenCalledTimes(2);

    extractor.destroy();
  });

  it('implements backpressure — skips frames while worker is busy', () => {
    const video = createMockVideo();
    const onFrame = vi.fn();

    const extractor = new FrameExtractor(video, {
      maxScansPerSecond: 60,
      getScanRegion: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });

    extractor.start(onFrame);

    // First frame sent
    flushRAF(0);
    expect(onFrame).toHaveBeenCalledTimes(1);

    // Worker is busy (automatically marked busy after sending), should skip
    flushRAF(100);
    expect(onFrame).toHaveBeenCalledTimes(1);

    // Mark worker idle
    extractor.markWorkerIdle();
    flushRAF(200);
    expect(onFrame).toHaveBeenCalledTimes(2);

    extractor.destroy();
  });

  it('stops extraction when stop() is called', () => {
    const video = createMockVideo();
    const onFrame = vi.fn();

    const extractor = new FrameExtractor(video, {
      maxScansPerSecond: 30,
      getScanRegion: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });

    extractor.start(onFrame);
    extractor.stop();

    flushRAF(100);
    // Should not receive any frames after stop
    expect(onFrame).toHaveBeenCalledTimes(0);

    extractor.destroy();
  });

  it('cancels requestAnimationFrame on destroy', () => {
    const video = createMockVideo();

    const extractor = new FrameExtractor(video, {
      maxScansPerSecond: 30,
      getScanRegion: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });

    extractor.start(vi.fn());
    extractor.destroy();

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('skips frames when video is not ready', () => {
    const video = createMockVideo({ readyState: 0 }); // HAVE_NOTHING
    const onFrame = vi.fn();

    const extractor = new FrameExtractor(video, {
      maxScansPerSecond: 30,
      getScanRegion: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });

    extractor.start(onFrame);
    flushRAF(100);

    expect(onFrame).not.toHaveBeenCalled();

    extractor.destroy();
  });
});
