import { ReaderOptions } from 'zxing-wasm/reader';

type ScanRegion = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};
type FacingMode = 'environment' | 'user';
type DeviceId = string;
type Camera = {
    id: DeviceId;
    label: string;
};
type Point = {
    x: number;
    y: number;
};
type ScanResult = {
    data: string;
    cornerPoints: Point[];
};
type InversionMode = 'original' | 'invert' | 'both';
type ScannerOptions = {
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

declare class CameraPermissionError extends Error {
    constructor(message?: string);
}
declare class CameraNotFoundError extends Error {
    constructor(message?: string);
}

/**
 * High-performance QR code scanner for the web, powered by ZXing-C++ WebAssembly.
 */
declare class QrScanner {
    private scanner;
    constructor(videoElement: HTMLVideoElement, onDecode: (result: ScanResult) => void, options?: ScannerOptions);
    /** Start camera and begin scanning. Resolves when camera is ready. */
    start(): Promise<void>;
    /** Stop scanning and release the camera stream. */
    stop(): void;
    /** Stop scanning, release camera, terminate worker, clean up DOM. */
    destroy(): void;
    /** Pause scanning. If stopStreamImmediately is false, camera stays on. */
    pause(stopStreamImmediately?: boolean): Promise<boolean>;
    /** Switch to a different camera by facing mode or device ID. */
    setCamera(facingModeOrDeviceId: FacingMode | DeviceId): Promise<void>;
    /** Check if the current camera supports flash/torch. */
    hasFlash(): Promise<boolean>;
    /** Whether flash is currently on. */
    isFlashOn(): boolean;
    /** Toggle flash on/off. */
    toggleFlash(): Promise<void>;
    /** Turn flash on. */
    turnFlashOn(): Promise<void>;
    /** Turn flash off. */
    turnFlashOff(): Promise<void>;
    /** Set the inversion mode for detecting inverted QR codes. */
    setInversionMode(mode: InversionMode): void;
    /** Check if the device has at least one camera. */
    static hasCamera(): Promise<boolean>;
    /** List available cameras. Pass true to request labels (triggers permission prompt). */
    static listCameras(requestLabels?: boolean): Promise<Camera[]>;
    /**
     * Pre-load the WASM binary so it's ready when the scanner starts.
     * Call this early (e.g., on app init) to avoid delay on first scan.
     */
    static preload(): Promise<void>;
    /**
     * Configure WASM loading. Call before creating any scanner instance.
     * @example
     * QrScanner.configureWasm({ locateFile: (filename) => `/wasm/${filename}` });
     */
    static configureWasm(overrides: Partial<EmscriptenModule>): void;
    /**
     * Set a custom URL for the worker script. Call before creating any scanner.
     * Needed for CJS consumers or non-standard bundler setups.
     * By default, the worker URL is resolved via `new URL('./worker.js', import.meta.url)`,
     * which works with Vite, webpack 5, Parcel, and other modern bundlers.
     * @example
     * QrScanner.setWorkerUrl('/assets/qr-scanner-worker.js');
     */
    static setWorkerUrl(url: string | URL): void;
    /** Scan a single image (not a video stream). */
    static scanImage(source: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap | ImageData | Blob | ArrayBuffer | Uint8Array | File | URL | string, options?: {
        scanRegion?: ScanRegion | null;
        canvas?: HTMLCanvasElement | null;
        decoderOptions?: Partial<ReaderOptions>;
    }): Promise<ScanResult>;
}

export { type Camera, CameraNotFoundError, CameraPermissionError, type DeviceId, type FacingMode, type InversionMode, type Point, type ScanRegion, type ScanResult, type ScannerOptions, QrScanner as default };
