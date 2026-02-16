import type { FacingMode, DeviceId, Camera } from './types.js';

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

    const constraints = this.buildConstraints();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          throw new Error(
            'Camera access denied. Please grant camera permission and try again.',
          );
        }
        if (err.name === 'NotFoundError') {
          throw new Error(
            'No camera found. Please connect a camera and try again.',
          );
        }
      }
      throw err;
    }

    // On some devices (e.g. Samsung S24 + Brave), facingMode: 'environment'
    // picks an ultrawide camera that lacks autofocus. Check and switch to a
    // better camera BEFORE showing on screen to avoid visible flicker.
    await this.ensureBestCamera();

    video.srcObject = this.stream;
    video.setAttribute('playsinline', 'true');
    await video.play();

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
      return;
    }

    const track = this.getVideoTrack();
    if (!track) return;

    try {
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
        focusMode?: string[];
      };
      if (capabilities.focusMode?.includes('continuous')) {
        return; // Current camera already has autofocus
      }
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
    if (candidates.length === 0) return;

    // Stop current stream — mobile devices only allow one active camera
    this.stop();

    for (const candidate of candidates) {
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
      } catch {
        continue;
      }

      const candidateTrack = candidateStream.getVideoTracks()[0];
      if (!candidateTrack) {
        for (const t of candidateStream.getTracks()) t.stop();
        continue;
      }

      // Must match the desired facing mode
      const candidateSettings = candidateTrack.getSettings() as MediaTrackSettings & {
        facingMode?: string;
      };
      if (candidateSettings.facingMode && candidateSettings.facingMode !== this.facingMode) {
        for (const t of candidateStream.getTracks()) t.stop();
        continue;
      }

      // Check if this camera supports continuous autofocus
      try {
        const candidateCaps = candidateTrack.getCapabilities() as MediaTrackCapabilities & {
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

  private buildConstraints(): MediaStreamConstraints {
    const video: MediaTrackConstraints = {
      width: this.resolution?.width ?? { ideal: 1920 },
      height: this.resolution?.height ?? { ideal: 1080 },
    };

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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
