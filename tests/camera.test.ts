import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraManager } from '../src/camera.js';

function createMockTrack(overrides: Partial<MediaStreamTrack> = {}): MediaStreamTrack {
  return {
    stop: vi.fn(),
    getCapabilities: vi.fn().mockReturnValue({}),
    getSettings: vi.fn().mockReturnValue({}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    kind: 'video',
    ...overrides,
  } as unknown as MediaStreamTrack;
}

function createMockStream(tracks: MediaStreamTrack[] = []): MediaStream {
  return {
    getTracks: vi.fn().mockReturnValue(tracks),
    getVideoTracks: vi.fn().mockReturnValue(tracks.filter((t) => t.kind === 'video')),
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
  } as unknown as HTMLVideoElement;
}

describe('CameraManager', () => {
  let originalMediaDevices: MediaDevices;

  beforeEach(() => {
    originalMediaDevices = navigator.mediaDevices;

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(),
        enumerateDevices: vi.fn(),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
      writable: true,
    });
  });

  it('requests environment-facing camera by default', async () => {
    const track = createMockTrack();
    const stream = createMockStream([track]);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

    const camera = new CameraManager();
    const video = createMockVideo();
    await camera.start(video);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: expect.objectContaining({
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      }),
      audio: false,
    });
  });

  it('applies cameraResolution option to constraints', async () => {
    const track = createMockTrack();
    const stream = createMockStream([track]);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

    const camera = new CameraManager({
      cameraResolution: { width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const video = createMockVideo();
    await camera.start(video);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: expect.objectContaining({
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }),
      audio: false,
    });
  });

  it('stops all tracks on cleanup', async () => {
    const track1 = createMockTrack();
    const track2 = createMockTrack();
    const stream = createMockStream([track1, track2]);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

    const camera = new CameraManager();
    const video = createMockVideo();
    await camera.start(video);
    camera.stop();

    expect(track1.stop).toHaveBeenCalled();
    expect(track2.stop).toHaveBeenCalled();
  });

  it('throws descriptive error on permission denied', async () => {
    const err = new DOMException('Permission denied', 'NotAllowedError');
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(err);

    const camera = new CameraManager();
    const video = createMockVideo();

    await expect(camera.start(video)).rejects.toThrow('Camera access denied');
  });

  it('throws descriptive error when no camera found', async () => {
    const err = new DOMException('No camera', 'NotFoundError');
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(err);

    const camera = new CameraManager();
    const video = createMockVideo();

    await expect(camera.start(video)).rejects.toThrow('No camera found');
  });

  it('setCamera stops old stream and starts new one', async () => {
    const track1 = createMockTrack();
    const stream1 = createMockStream([track1]);
    const track2 = createMockTrack();
    const stream2 = createMockStream([track2]);

    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockResolvedValueOnce(stream1)
      .mockResolvedValueOnce(stream2);

    const camera = new CameraManager();
    const video = createMockVideo();
    await camera.start(video);
    await camera.setCamera('user', video);

    expect(track1.stop).toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('hasCamera returns true when videoinput device exists', async () => {
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { kind: 'videoinput', deviceId: 'abc', groupId: '', label: 'Camera' } as MediaDeviceInfo,
    ]);

    expect(await CameraManager.hasCamera()).toBe(true);
  });

  it('hasCamera returns false when no videoinput device exists', async () => {
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { kind: 'audioinput', deviceId: 'xyz', groupId: '', label: 'Mic' } as MediaDeviceInfo,
    ]);

    expect(await CameraManager.hasCamera()).toBe(false);
  });

  it('listCameras returns camera list with IDs and labels', async () => {
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { kind: 'videoinput', deviceId: 'cam1', groupId: '', label: 'Front Camera' } as MediaDeviceInfo,
      { kind: 'videoinput', deviceId: 'cam2', groupId: '', label: 'Back Camera' } as MediaDeviceInfo,
      { kind: 'audioinput', deviceId: 'mic1', groupId: '', label: 'Mic' } as MediaDeviceInfo,
    ]);

    const cameras = await CameraManager.listCameras();
    expect(cameras).toHaveLength(2);
    expect(cameras[0]).toEqual({ id: 'cam1', label: 'Front Camera' });
    expect(cameras[1]).toEqual({ id: 'cam2', label: 'Back Camera' });
  });

  it('flash methods use the camera track torch capability', async () => {
    const track = createMockTrack({
      getCapabilities: vi.fn().mockReturnValue({ torch: true }),
      getSettings: vi.fn().mockReturnValue({ torch: false }),
    });
    const stream = createMockStream([track]);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

    const camera = new CameraManager();
    const video = createMockVideo();
    await camera.start(video);

    expect(await camera.hasFlash()).toBe(true);
    expect(camera.isFlashOn()).toBe(false);

    await camera.turnFlashOn();
    expect(track.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ torch: true }],
    });
  });

  it('does not create multiple streams on duplicate start calls', async () => {
    const track = createMockTrack();
    const stream = createMockStream([track]);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

    const camera = new CameraManager();
    const video = createMockVideo();

    await camera.start(video);
    await camera.start(video);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });
});
