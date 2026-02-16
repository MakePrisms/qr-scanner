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
