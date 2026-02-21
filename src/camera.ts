import type { FacingMode, DeviceId, Camera } from './types.js';

export class CameraPermissionError extends Error {
  constructor(
    message = 'Camera access denied. Please grant camera permission and try again.',
  ) {
    super(message);
    this.name = 'CameraPermissionError';
  }
}

export class CameraNotFoundError extends Error {
  constructor(
    message = 'No camera found. Please connect a camera and try again.',
  ) {
    super(message);
    this.name = 'CameraNotFoundError';
  }
}

const CACHE_KEY_PREFIX = '@agicash/qr-scanner:camera:';

function getCachedDeviceId(facingMode: string): string | null {
  try {
    return localStorage.getItem(`${CACHE_KEY_PREFIX}${facingMode}`);
  } catch {
    return null;
  }
}

function setCachedDeviceId(facingMode: string, deviceId: string): void {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${facingMode}`, deviceId);
  } catch {
    // localStorage unavailable or full — ignore
  }
}

export interface CameraConfig {
  preferredCamera?: FacingMode | DeviceId;
  cameraResolution?: {
    width?: MediaTrackConstraintSet['width'];
    height?: MediaTrackConstraintSet['height'];
  };
}

export class CameraManager {
  private stream: MediaStream | null = null;
  private facingMode: FacingMode | DeviceId;
  private resolution: CameraConfig['cameraResolution'];

  constructor(config: CameraConfig = {}) {
    this.facingMode = config.preferredCamera ?? 'environment';
    this.resolution = config.cameraResolution;
  }

  async start(video: HTMLVideoElement): Promise<MediaStream> {
    if (this.stream) {
      return this.stream;
    }

    const t0 = performance.now();

    this.stream = await this.acquireStream();
    const t1 = performance.now();
    console.debug(`[QrScanner] acquireStream: ${(t1 - t0).toFixed(0)}ms`);

    // On some devices (e.g. Samsung S24 + Brave), facingMode: 'environment'
    // picks an ultrawide camera that lacks autofocus. Check and switch to a
    // better camera BEFORE showing on screen to avoid visible flicker.
    await this.ensureBestCamera();
    const t2 = performance.now();
    console.debug(`[QrScanner] ensureBestCamera: ${(t2 - t1).toFixed(0)}ms`);

    video.srcObject = this.stream;
    video.setAttribute('playsinline', 'true');
    await video.play();
    const t3 = performance.now();
    console.debug(`[QrScanner] video.play: ${(t3 - t2).toFixed(0)}ms`);
    console.debug(`[QrScanner] camera.start total: ${(t3 - t0).toFixed(0)}ms`);

    // Cache the final camera so subsequent starts skip ensureBestCamera
    if (this.facingMode === 'environment' || this.facingMode === 'user') {
      const finalDeviceId = this.getVideoTrack()?.getSettings().deviceId;
      if (finalDeviceId) {
        setCachedDeviceId(this.facingMode, finalDeviceId);
      }
    }

    return this.stream;
  }

  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }

  async setCamera(
    facingModeOrDeviceId: FacingMode | DeviceId,
    video: HTMLVideoElement,
  ): Promise<void> {
    this.stop();
    this.facingMode = facingModeOrDeviceId;
    await this.start(video);
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async hasFlash(): Promise<boolean> {
    const track = this.getVideoTrack();
    if (!track) return false;

    try {
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
        torch?: boolean;
      };
      return capabilities.torch === true;
    } catch {
      return false;
    }
  }

  isFlashOn(): boolean {
    const track = this.getVideoTrack();
    if (!track) return false;

    const settings = track.getSettings() as MediaTrackSettings & {
      torch?: boolean;
    };
    return settings.torch === true;
  }

  async toggleFlash(): Promise<void> {
    if (this.isFlashOn()) {
      await this.turnFlashOff();
    } else {
      await this.turnFlashOn();
    }
  }

  async turnFlashOn(): Promise<void> {
    await this.setTorch(true);
  }

  async turnFlashOff(): Promise<void> {
    await this.setTorch(false);
  }

  private async setTorch(on: boolean): Promise<void> {
    const track = this.getVideoTrack();
    if (!track) {
      throw new Error('No active camera stream');
    }

    try {
      await track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
    } catch {
      throw new Error('Flash/torch is not supported on this device');
    }
  }

  /**
   * If the current camera lacks continuous autofocus (e.g. an ultrawide sensor
   * picked by facingMode: 'environment'), find a better camera with the same
   * facing mode and replace this.stream. Called before assigning to the video
   * element so the user never sees the wrong camera.
   */
  private async ensureBestCamera(): Promise<void> {
    if (this.facingMode !== 'environment' && this.facingMode !== 'user') {
      console.debug(
        '[QrScanner] ensureBestCamera: skipped (specific deviceId)',
      );
      return;
    }

    const track = this.getVideoTrack();
    if (!track) return;

    try {
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
        focusMode?: string[];
      };
      if (
        !capabilities.focusMode ||
        capabilities.focusMode.includes('continuous')
      ) {
        // focusMode not reported (e.g. Safari/iOS) or has autofocus — skip.
        // Only enter the candidate loop when the browser explicitly reports
        // focusMode without 'continuous' (e.g. S24 + Brave ultrawide).
        console.debug(
          `[QrScanner] ensureBestCamera: skipped (focusMode: ${JSON.stringify(capabilities.focusMode)})`,
        );
        return;
      }
      console.debug(
        `[QrScanner] ensureBestCamera: current camera lacks autofocus (focusMode: ${JSON.stringify(capabilities.focusMode)})`,
      );
    } catch {
      return;
    }

    // Current camera lacks continuous autofocus.
    // Enumerate devices while stream is active (ensures deviceIds are available).
    const currentDeviceId = track.getSettings().deviceId;

    let devices: MediaDeviceInfo[];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch {
      return;
    }
    if (!Array.isArray(devices)) return;

    const candidates = devices.filter(
      (d) => d.kind === 'videoinput' && d.deviceId !== currentDeviceId,
    );
    console.debug(
      `[QrScanner] ensureBestCamera: testing ${candidates.length} candidate camera(s)`,
    );
    if (candidates.length === 0) return;

    // Stop current stream — mobile devices only allow one active camera
    this.stop();

    for (const candidate of candidates) {
      const t = performance.now();
      let candidateStream: MediaStream;
      try {
        candidateStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: candidate.deviceId },
            width: this.resolution?.width ?? { ideal: 1920 },
            height: this.resolution?.height ?? { ideal: 1080 },
          },
          audio: false,
        });
        console.debug(
          `[QrScanner] ensureBestCamera: candidate ${candidate.label || candidate.deviceId.slice(0, 8)}: getUserMedia ${(performance.now() - t).toFixed(0)}ms`,
        );
      } catch {
        console.debug(
          `[QrScanner] ensureBestCamera: candidate ${candidate.label || candidate.deviceId.slice(0, 8)}: getUserMedia failed ${(performance.now() - t).toFixed(0)}ms`,
        );
        continue;
      }

      const candidateTrack = candidateStream.getVideoTracks()[0];
      if (!candidateTrack) {
        for (const t of candidateStream.getTracks()) t.stop();
        continue;
      }

      // Must match the desired facing mode
      const candidateSettings =
        candidateTrack.getSettings() as MediaTrackSettings & {
          facingMode?: string;
        };
      if (
        candidateSettings.facingMode &&
        candidateSettings.facingMode !== this.facingMode
      ) {
        for (const t of candidateStream.getTracks()) t.stop();
        continue;
      }

      // Check if this camera supports continuous autofocus
      try {
        const candidateCaps =
          candidateTrack.getCapabilities() as MediaTrackCapabilities & {
            focusMode?: string[];
          };
        if (candidateCaps.focusMode?.includes('continuous')) {
          this.stream = candidateStream;
          return;
        }
      } catch {
        // Can't check capabilities, skip
      }

      for (const t of candidateStream.getTracks()) t.stop();
    }

    // No better camera found — re-open the original
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined,
          width: this.resolution?.width ?? { ideal: 1920 },
          height: this.resolution?.height ?? { ideal: 1080 },
        },
        audio: false,
      });
    } catch {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(
          this.buildConstraints(),
        );
      } catch {
        // Could not recover camera
      }
    }
  }

  private getVideoTrack(): MediaStreamTrack | null {
    if (!this.stream) return null;
    const tracks = this.stream.getVideoTracks();
    return tracks[0] ?? null;
  }

  /**
   * Try getUserMedia with progressively simpler constraints.
   *
   * Some browsers (e.g. Brave on Samsung Galaxy S24) throw NotReadableError
   * when facingMode and resolution constraints are combined. Falling back to
   * fewer constraints lets us still open the camera on those browsers.
   */
  private async acquireStream(): Promise<MediaStream> {
    const labels: string[] = [];
    const attempts: MediaStreamConstraints[] = [];

    // If we've previously found a good camera for this facingMode, try it first
    if (this.facingMode === 'environment' || this.facingMode === 'user') {
      const cachedId = getCachedDeviceId(this.facingMode);
      if (cachedId) {
        labels.push('cached deviceId');
        const video: MediaTrackConstraints = {
          deviceId: { exact: cachedId },
        };
        if (this.resolution?.width) video.width = this.resolution.width;
        else video.width = { ideal: 1920 };
        if (this.resolution?.height) video.height = this.resolution.height;
        else video.height = { ideal: 1080 };
        attempts.push({ video, audio: false });
      }
    }

    // Standard fallback chain
    labels.push('full constraints', 'no resolution', 'bare minimum');
    attempts.push(
      // facingMode/deviceId + resolution
      this.buildConstraints(),
      // facingMode/deviceId only, no resolution
      this.buildConstraints(false),
      // Bare minimum
      { video: true, audio: false },
    );

    let lastError: unknown;
    for (let i = 0; i < attempts.length; i++) {
      const t = performance.now();
      try {
        const stream = await navigator.mediaDevices.getUserMedia(attempts[i]);
        console.debug(
          `[QrScanner] getUserMedia(${labels[i]}): ${(performance.now() - t).toFixed(0)}ms ✓`,
        );
        return stream;
      } catch (err) {
        console.debug(
          `[QrScanner] getUserMedia(${labels[i]}): ${(performance.now() - t).toFixed(0)}ms ✗ ${err instanceof DOMException ? err.name : err}`,
        );
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            throw new CameraPermissionError();
          }
          if (err.name === 'NotFoundError') {
            throw new CameraNotFoundError();
          }
          // NotReadableError or OverconstrainedError — try next fallback
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  private buildConstraints(includeResolution = true): MediaStreamConstraints {
    const video: MediaTrackConstraints = {};

    if (includeResolution) {
      video.width = this.resolution?.width ?? { ideal: 1920 };
      video.height = this.resolution?.height ?? { ideal: 1080 };
    }

    if (this.facingMode === 'environment' || this.facingMode === 'user') {
      video.facingMode = this.facingMode;
    } else {
      video.deviceId = { exact: this.facingMode };
    }

    return { video, audio: false };
  }

  static async hasCamera(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some((d) => d.kind === 'videoinput');
    } catch {
      return false;
    }
  }

  static async listCameras(requestLabels = false): Promise<Camera[]> {
    if (requestLabels) {
      // Requesting labels requires a temporary stream to trigger the permission prompt
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        for (const track of stream.getTracks()) {
          track.stop();
        }
      } catch {
        // Permission denied — fall through with empty labels
      }
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d) => ({
        id: d.deviceId,
        label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
      }));
  }
}
