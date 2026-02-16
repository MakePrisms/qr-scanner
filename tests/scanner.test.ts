import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scanner } from '../src/scanner.js';

function createMockTrack(): MediaStreamTrack {
  return {
    stop: vi.fn(),
    getCapabilities: vi.fn().mockReturnValue({}),
    getSettings: vi.fn().mockReturnValue({}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    kind: 'video',
  } as unknown as MediaStreamTrack;
}

function createMockStream(): MediaStream {
  const track = createMockTrack();
  return {
    getTracks: vi.fn().mockReturnValue([track]),
    getVideoTracks: vi.fn().mockReturnValue([track]),
    getAudioTracks: vi.fn().mockReturnValue([]),
  } as unknown as MediaStream;
}

function createMockVideo(): HTMLVideoElement {
  return {
    srcObject: null,
    play: vi.fn().mockResolvedValue(undefined),
    setAttribute: vi.fn(),
    videoWidth: 1920,
    videoHeight: 1080,
    readyState: 4,
  } as unknown as HTMLVideoElement;
}

describe('Scanner', () => {
  let mockWorker: {
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    onmessage: ((e: MessageEvent) => void) | null;
    onerror: ((e: ErrorEvent) => void) | null;
  };

  beforeEach(() => {
    // Mock navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(createMockStream()),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
      configurable: true,
      writable: true,
    });

    // Mock Worker
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };

    // Mock Blob & URL.createObjectURL for inline worker creation
    vi.stubGlobal('Worker', vi.fn().mockImplementation(() => mockWorker));
    vi.stubGlobal('Blob', class MockBlob {
      constructor(public parts: unknown[], public options?: BlobPropertyBag) {}
    });
    const mockUrl = 'blob:mock-worker-url';
    URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
    URL.revokeObjectURL = vi.fn();

    // Mock requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    // Mock OffscreenCanvas
    vi.stubGlobal('OffscreenCanvas', class MockOffscreenCanvas {
      width = 0;
      height = 0;
      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue(
            new ImageData(new Uint8ClampedArray(4), 1, 1),
          ),
        };
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('start() resolves once camera stream is active', async () => {
    const video = createMockVideo();
    const onDecode = vi.fn();
    const scanner = new Scanner(video, onDecode);

    await scanner.start();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(video.play).toHaveBeenCalled();
    expect(scanner.isActive()).toBe(true);

    scanner.destroy();
  });

  it('stop() releases camera stream', async () => {
    const video = createMockVideo();
    const stream = createMockStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

    const scanner = new Scanner(video, vi.fn());
    await scanner.start();
    scanner.stop();

    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
    expect(scanner.isActive()).toBe(false);

    scanner.destroy();
  });

  it('destroy() terminates worker and releases all resources', async () => {
    const video = createMockVideo();
    const scanner = new Scanner(video, vi.fn());
    await scanner.start();
    scanner.destroy();

    expect(mockWorker.terminate).toHaveBeenCalled();
    expect(scanner.isDestroyed()).toBe(true);
  });

  it('pause() / start() cycle works without re-initializing worker', async () => {
    const video = createMockVideo();
    const scanner = new Scanner(video, vi.fn());

    await scanner.start();
    expect(scanner.isActive()).toBe(true);

    await scanner.pause();
    expect(scanner.isPaused()).toBe(true);

    // Worker constructor should have been called only once
    const workerCallCount = vi.mocked(Worker).mock.calls.length;

    await scanner.start();
    expect(scanner.isActive()).toBe(true);
    expect(scanner.isPaused()).toBe(false);

    // Worker should not have been re-created
    expect(vi.mocked(Worker).mock.calls.length).toBe(workerCallCount);

    scanner.destroy();
  });

  it('multiple start() calls do not create multiple camera streams', async () => {
    const video = createMockVideo();
    const scanner = new Scanner(video, vi.fn());

    await scanner.start();
    await scanner.start();
    await scanner.start();

    // getUserMedia called once for initial start, once more after pause
    // Since start() on an already-running scanner just returns, only 1 call
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

    scanner.destroy();
  });

  it('throws error after destroy', async () => {
    const video = createMockVideo();
    const scanner = new Scanner(video, vi.fn());
    scanner.destroy();

    await expect(scanner.start()).rejects.toThrow('Scanner has been destroyed');
  });
});
