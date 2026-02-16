import type { ReaderOptions } from 'zxing-wasm/reader';

export type ScanRegion = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type FacingMode = 'environment' | 'user';
export type DeviceId = string;

export type Camera = {
  id: DeviceId;
  label: string;
};

export type Point = {
  x: number;
  y: number;
};

export type ScanResult = {
  data: string;
  cornerPoints: Point[];
};

export type InversionMode = 'original' | 'invert' | 'both';

export type ScannerOptions = {
  onDecodeError?: (error: Error | string) => void;

  calculateScanRegion?: (video: HTMLVideoElement) => ScanRegion;

  preferredCamera?: FacingMode | DeviceId;

  maxScansPerSecond?: number;

  highlightScanRegion?: boolean;

  highlightCodeOutline?: boolean;

  overlay?: HTMLDivElement;

  cameraResolution?: {
    width?: MediaTrackConstraintSet['width'];
    height?: MediaTrackConstraintSet['height'];
  };

  decoderOptions?: Partial<ReaderOptions>;
};

export type WorkerRequest =
  | { type: 'configure'; options: Partial<ReaderOptions> }
  | { type: 'decode'; imageData: ImageData };

export type WorkerResponse =
  | { type: 'result'; results: ScanResult[] }
  | { type: 'error'; message: string }
  | { type: 'ready' };
