import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraManager } from '../src/camera.js';

function createMockTrack(
  overrides: Partial<MediaStreamTrack> = {},
): MediaStreamTrack {
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
    getVideoTracks: vi
      .fn()
      .mockReturnValue(tracks.filter((t) => t.kind === 'video')),
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
    localStorage.removeItem('@agicash/qr-scanner:camera:environment');
    localStorage.removeItem('@agicash/qr-scanner:camera:user');
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
      {
        kind: 'videoinput',
        deviceId: 'abc',
        groupId: '',
        label: 'Camera',
      } as MediaDeviceInfo,
    ]);

    expect(await CameraManager.hasCamera()).toBe(true);
  });

  it('hasCamera returns false when no videoinput device exists', async () => {
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      {
        kind: 'audioinput',
        deviceId: 'xyz',
        groupId: '',
        label: 'Mic',
      } as MediaDeviceInfo,
    ]);

    expect(await CameraManager.hasCamera()).toBe(false);
  });

  it('listCameras returns camera list with IDs and labels', async () => {
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      {
        kind: 'videoinput',
        deviceId: 'cam1',
        groupId: '',
        label: 'Front Camera',
      } as MediaDeviceInfo,
      {
        kind: 'videoinput',
        deviceId: 'cam2',
        groupId: '',
        label: 'Back Camera',
      } as MediaDeviceInfo,
      {
        kind: 'audioinput',
        deviceId: 'mic1',
        groupId: '',
        label: 'Mic',
      } as MediaDeviceInfo,
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

  describe('constraint fallback (acquireStream)', () => {
    it('falls back to simpler constraints on OverconstrainedError', async () => {
      const overconstrainedError = new OverconstrainedError(
        'deviceId',
        'Invalid constraint',
      );

      const track = createMockTrack();
      const stream = createMockStream([track]);

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockRejectedValueOnce(overconstrainedError) // full constraints fail
        .mockRejectedValueOnce(overconstrainedError) // no resolution fails
        .mockResolvedValueOnce(stream); // bare minimum succeeds

      const camera = new CameraManager();
      const video = createMockVideo();
      await camera.start(video);

      expect(video.srcObject).toBe(stream);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(3);
      // Last call should be bare minimum
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
        video: true,
        audio: false,
      });
    });

    it('clears stale cached deviceId on failure and succeeds with fallback', async () => {
      // Seed a cached deviceId
      localStorage.setItem(
        '@agicash/qr-scanner:camera:environment',
        'stale-device-id',
      );

      const overconstrainedError = new OverconstrainedError(
        'deviceId',
        'Invalid constraint',
      );

      const track = createMockTrack();
      const stream = createMockStream([track]);

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockRejectedValueOnce(overconstrainedError) // cached deviceId fails
        .mockResolvedValueOnce(stream); // full constraints succeeds

      const camera = new CameraManager();
      const video = createMockVideo();
      await camera.start(video);

      expect(video.srcObject).toBe(stream);
      // Cached deviceId should be cleared
      expect(
        localStorage.getItem('@agicash/qr-scanner:camera:environment'),
      ).toBeNull();
    });

    it('still throws CameraPermissionError even with cached deviceId', async () => {
      localStorage.setItem('@agicash/qr-scanner:camera:environment', 'some-id');

      const err = new DOMException('Permission denied', 'NotAllowedError');
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(err);

      const camera = new CameraManager();
      const video = createMockVideo();

      await expect(camera.start(video)).rejects.toThrow('Camera access denied');
    });

    it('throws lastError when all fallback attempts fail', async () => {
      const overconstrainedError = new OverconstrainedError(
        'deviceId',
        'Invalid constraint',
      );

      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
        overconstrainedError,
      );

      const camera = new CameraManager();
      const video = createMockVideo();

      await expect(camera.start(video)).rejects.toThrow();
      // 3 standard attempts (full, no resolution, bare minimum)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(3);
    });

    it('rethrows unexpected non-DOM errors immediately', async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
        new TypeError('Unexpected error'),
      );

      const camera = new CameraManager();
      const video = createMockVideo();

      await expect(camera.start(video)).rejects.toThrow(TypeError);
      // Should not have retried
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });

    it('falls back on NotReadableError (DOMException)', async () => {
      const notReadableError = new DOMException(
        'Could not start video source',
        'NotReadableError',
      );

      const track = createMockTrack();
      const stream = createMockStream([track]);

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockRejectedValueOnce(notReadableError) // full constraints fail
        .mockResolvedValueOnce(stream); // no resolution succeeds

      const camera = new CameraManager();
      const video = createMockVideo();
      await camera.start(video);

      expect(video.srcObject).toBe(stream);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    });

    it('falls back when OverconstrainedError is not a DOMException (Safari/iOS)', async () => {
      // On Safari/iOS, OverconstrainedError may not extend DOMException.
      // Temporarily swap the global to simulate this browser behavior.
      const OriginalOCE = globalThis.OverconstrainedError;
      class SafariOverconstrainedError extends Error {
        constraint: string;
        constructor(constraint: string, message: string) {
          super(message);
          this.name = 'OverconstrainedError';
          this.constraint = constraint;
        }
      }
      globalThis.OverconstrainedError =
        SafariOverconstrainedError as unknown as typeof OverconstrainedError;

      try {
        const err = new SafariOverconstrainedError('deviceId', 'Invalid');
        // Verify this does NOT pass instanceof DOMException
        expect(err instanceof DOMException).toBe(false);

        const track = createMockTrack();
        const stream = createMockStream([track]);

        vi.mocked(navigator.mediaDevices.getUserMedia)
          .mockRejectedValueOnce(err)
          .mockResolvedValueOnce(stream);

        const camera = new CameraManager();
        const video = createMockVideo();
        await camera.start(video);

        expect(video.srcObject).toBe(stream);
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
      } finally {
        globalThis.OverconstrainedError = OriginalOCE;
      }
    });

    it('clears stale cached deviceId for user facingMode', async () => {
      localStorage.setItem(
        '@agicash/qr-scanner:camera:user',
        'stale-user-device',
      );

      const overconstrainedError = new OverconstrainedError(
        'deviceId',
        'Invalid constraint',
      );

      const track = createMockTrack();
      const stream = createMockStream([track]);

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockRejectedValueOnce(overconstrainedError) // cached deviceId fails
        .mockResolvedValueOnce(stream); // full constraints succeeds

      const camera = new CameraManager({ preferredCamera: 'user' });
      const video = createMockVideo();
      await camera.start(video);

      expect(video.srcObject).toBe(stream);
      expect(
        localStorage.getItem('@agicash/qr-scanner:camera:user'),
      ).toBeNull();
    });
  });

  describe('camera upgrade (autofocus detection)', () => {
    it('switches to a camera with continuous autofocus when initial camera lacks it', async () => {
      // Initial camera: ultrawide with no autofocus
      const ultrawideTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['manual'] }),
        getSettings: vi.fn().mockReturnValue({
          deviceId: 'ultrawide-id',
          facingMode: 'environment',
        }),
      });
      const ultrawideStream = createMockStream([ultrawideTrack]);

      // Better camera: main sensor with autofocus
      const mainTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({
          focusMode: ['manual', 'single-shot', 'continuous'],
        }),
        getSettings: vi
          .fn()
          .mockReturnValue({ deviceId: 'main-id', facingMode: 'environment' }),
      });
      const mainStream = createMockStream([mainTrack]);

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockResolvedValueOnce(ultrawideStream) // initial start
        .mockResolvedValueOnce(mainStream); // upgrade candidate

      vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
        {
          kind: 'videoinput',
          deviceId: 'ultrawide-id',
          groupId: '',
          label: 'Ultrawide',
        } as MediaDeviceInfo,
        {
          kind: 'videoinput',
          deviceId: 'main-id',
          groupId: '',
          label: 'Main',
        } as MediaDeviceInfo,
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
        getSettings: vi.fn().mockReturnValue({
          deviceId: 'back-no-af',
          facingMode: 'environment',
        }),
      });
      const backStream = createMockStream([backTrack]);

      // Front camera has autofocus but wrong facing mode
      const frontTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['continuous'] }),
        getSettings: vi
          .fn()
          .mockReturnValue({ deviceId: 'front-cam', facingMode: 'user' }),
      });
      const frontStream = createMockStream([frontTrack]);

      // Fallback: re-open original camera
      const fallbackTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['manual'] }),
        getSettings: vi.fn().mockReturnValue({
          deviceId: 'back-no-af',
          facingMode: 'environment',
        }),
      });
      const fallbackStream = createMockStream([fallbackTrack]);

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockResolvedValueOnce(backStream) // initial start
        .mockResolvedValueOnce(frontStream) // candidate (wrong facing mode)
        .mockResolvedValueOnce(fallbackStream); // fallback to original

      vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
        {
          kind: 'videoinput',
          deviceId: 'back-no-af',
          groupId: '',
          label: 'Back',
        } as MediaDeviceInfo,
        {
          kind: 'videoinput',
          deviceId: 'front-cam',
          groupId: '',
          label: 'Front',
        } as MediaDeviceInfo,
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

    it('leaves stream null when all ensureBestCamera recovery attempts fail', async () => {
      // Initial: camera without autofocus
      const initialTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['manual'] }),
        getSettings: vi.fn().mockReturnValue({
          deviceId: 'initial-cam',
          facingMode: 'environment',
        }),
      });
      const initialStream = createMockStream([initialTrack]);

      const overconstrainedError = new OverconstrainedError(
        'deviceId',
        'Invalid constraint',
      );

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockResolvedValueOnce(initialStream) // acquireStream succeeds
        // ensureBestCamera: candidate camera fails
        .mockRejectedValueOnce(overconstrainedError)
        // ensureBestCamera recovery: all 4 attempts fail
        .mockRejectedValueOnce(overconstrainedError)
        .mockRejectedValueOnce(overconstrainedError)
        .mockRejectedValueOnce(overconstrainedError)
        .mockRejectedValueOnce(overconstrainedError);

      vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
        {
          kind: 'videoinput',
          deviceId: 'initial-cam',
          groupId: '',
          label: 'Back Camera',
        } as MediaDeviceInfo,
        {
          kind: 'videoinput',
          deviceId: 'other-cam',
          groupId: '',
          label: 'Front Camera',
        } as MediaDeviceInfo,
      ]);

      const camera = new CameraManager();
      const video = createMockVideo();
      // video.play() will be called with srcObject=null, which should fail
      vi.mocked(video.play).mockRejectedValueOnce(
        new DOMException('No supported sources', 'NotSupportedError'),
      );

      await expect(camera.start(video)).rejects.toThrow();
    });

    it('recovers with bare minimum when all ensureBestCamera fallbacks fail except last', async () => {
      // Initial: camera without autofocus
      const initialTrack = createMockTrack({
        getCapabilities: vi.fn().mockReturnValue({ focusMode: ['manual'] }),
        getSettings: vi.fn().mockReturnValue({
          deviceId: 'initial-cam',
          facingMode: 'environment',
        }),
      });
      const initialStream = createMockStream([initialTrack]);

      // Recovery: bare minimum stream (after all other recovery attempts fail)
      const recoveryTrack = createMockTrack();
      const recoveryStream = createMockStream([recoveryTrack]);

      const overconstrainedError = new OverconstrainedError(
        'deviceId',
        'Invalid constraint',
      );

      vi.mocked(navigator.mediaDevices.getUserMedia)
        .mockResolvedValueOnce(initialStream) // acquireStream succeeds
        // ensureBestCamera: candidate camera fails
        .mockRejectedValueOnce(overconstrainedError)
        // ensureBestCamera recovery: original deviceId + resolution fails
        .mockRejectedValueOnce(overconstrainedError)
        // ensureBestCamera recovery: facingMode + resolution fails
        .mockRejectedValueOnce(overconstrainedError)
        // ensureBestCamera recovery: facingMode only fails
        .mockRejectedValueOnce(overconstrainedError)
        // ensureBestCamera recovery: bare minimum succeeds
        .mockResolvedValueOnce(recoveryStream);

      // Need a second camera so ensureBestCamera enters the candidate loop
      // (it skips when no candidates exist besides the current camera)
      vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
        {
          kind: 'videoinput',
          deviceId: 'initial-cam',
          groupId: '',
          label: 'Back Camera',
        } as MediaDeviceInfo,
        {
          kind: 'videoinput',
          deviceId: 'other-cam',
          groupId: '',
          label: 'Front Camera',
        } as MediaDeviceInfo,
      ]);

      const camera = new CameraManager();
      const video = createMockVideo();
      await camera.start(video);

      // Should have recovered with the bare minimum stream
      expect(video.srcObject).toBe(recoveryStream);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
        video: true,
        audio: false,
      });
    });
  });
});
