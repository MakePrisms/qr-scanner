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

  describe('camera upgrade (autofocus detection)', () => {
    it('switches to a camera with continuous autofocus when initial camera lacks it', async () => {
      // Initial camera: ultrawide with no autofocus
      const ultrawideTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['manual'] }),
        getSettings: vi.fn().mockReturnValue({ deviceId: 'ultrawide-id', facingMode: 'environment' }),
      });
      const ultrawideStream = createMockStream([ultrawideTrack]);

      // Better camera: main sensor with autofocus
      const mainTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['manual', 'single-shot', 'continuous'] }),
        getSettings: vi.fn().mockReturnValue({ deviceId: 'main-id', facingMode: 'environment' }),
      });
      const mainStream = createMockStream([mainTrack]);

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockResolvedValueOnce(ultrawideStream)  // initial start
        .mockResolvedValueOnce(mainStream);       // upgrade candidate

      vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
        { kind: 'videoinput', deviceId: 'ultrawide-id', groupId: '', label: 'Ultrawide' } as MediaDeviceInfo,
        { kind: 'videoinput', deviceId: 'main-id', groupId: '', label: 'Main' } as MediaDeviceInfo,
      ]);

      const camera = new CameraManager();
      const video = createMockVideo();
      await camera.start(video);

      // Should have stopped the ultrawide first, then switched to main
      expect(ultrawideTrack.stop).toHaveBeenCalled();
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
      // Video gets the upgraded stream (assigned by start() after ensureBestCamera)
      expect(video.srcObject).toBe(mainStream);
    });

    it('keeps current camera when it already has continuous autofocus', async () => {
      const track = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['continuous'] }),
        getSettings: vi.fn().mockReturnValue({ deviceId: 'good-cam' }),
      });
      const stream = createMockStream([track]);
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

      const camera = new CameraManager();
      const video = createMockVideo();
      await camera.start(video);

      // Should not enumerate or try other cameras
      expect(navigator.mediaDevices.enumerateDevices).not.toHaveBeenCalled();
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });

    it('skips upgrade when using explicit deviceId', async () => {
      const track = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['manual'] }),
        getSettings: vi.fn().mockReturnValue({ deviceId: 'specific-cam' }),
      });
      const stream = createMockStream([track]);
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

      // User explicitly chose a device — don't override their choice
      const camera = new CameraManager({ preferredCamera: 'specific-cam' });
      const video = createMockVideo();
      await camera.start(video);

      expect(navigator.mediaDevices.enumerateDevices).not.toHaveBeenCalled();
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });

    it('skips cameras with wrong facing mode and falls back to original', async () => {
      // Initial: back camera without autofocus
      const backTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['manual'] }),
        getSettings: vi.fn().mockReturnValue({ deviceId: 'back-no-af', facingMode: 'environment' }),
      });
      const backStream = createMockStream([backTrack]);

      // Front camera has autofocus but wrong facing mode
      const frontTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['continuous'] }),
        getSettings: vi.fn().mockReturnValue({ deviceId: 'front-cam', facingMode: 'user' }),
      });
      const frontStream = createMockStream([frontTrack]);

      // Fallback: re-open original camera
      const fallbackTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['manual'] }),
        getSettings: vi.fn().mockReturnValue({ deviceId: 'back-no-af', facingMode: 'environment' }),
      });
      const fallbackStream = createMockStream([fallbackTrack]);

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockResolvedValueOnce(backStream)     // initial start
        .mockResolvedValueOnce(frontStream)    // candidate (wrong facing mode)
        .mockResolvedValueOnce(fallbackStream); // fallback to original

      vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
        { kind: 'videoinput', deviceId: 'back-no-af', groupId: '', label: 'Back' } as MediaDeviceInfo,
        { kind: 'videoinput', deviceId: 'front-cam', groupId: '', label: 'Front' } as MediaDeviceInfo,
      ]);

      const camera = new CameraManager();
      const video = createMockVideo();
      await camera.start(video);

      // Front camera opened but rejected due to facing mode mismatch
      expect(frontTrack.stop).toHaveBeenCalled();
      // Should have fallen back to re-opening original by deviceId
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(3);
      expect(video.srcObject).toBe(fallbackStream);
    });
  });
});
