# @agicash/qr-scanner

High-performance QR code scanner for the web, powered by ZXing-C++ WebAssembly. Drop-in replacement for [nimiq/qr-scanner](https://github.com/nimiq/qr-scanner) with significantly better decoding of dense QR codes.

## Features

- **No forced downscale** - feeds high-resolution frames to the decoder (720-1080px+)
- **WASM decoder** - ZXing-C++ compiled to WebAssembly, ~2x faster than pure-JS decoders
- **Web Worker** - decoding runs off the main thread, keeping UI at 60fps
- **`tryHarder` mode** - additional processing passes for hard-to-read codes

## Installation

```bash
bun add @agicash/qr-scanner
# or
npm install @agicash/qr-scanner
```

## Quick Start

### Live Camera Scanner

```ts
import QrScanner from '@agicash/qr-scanner';

const scanner = new QrScanner(videoElement, (result) => {
  console.log(result.data);          // decoded string
  console.log(result.cornerPoints);  // QR code corner positions
}, {
  highlightScanRegion: true,
  highlightCodeOutline: true,
});

await scanner.start();

// Later...
scanner.destroy();
```

### Scan a Single Image

```ts
import QrScanner from '@agicash/qr-scanner';

const result = await QrScanner.scanImage(fileOrBlobOrUrl);
console.log(result.data);
```

## API

### Constructor

```ts
new QrScanner(videoElement, onDecode, options?)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onDecodeError` | `(error) => void` | no-op | Called when no QR code found |
| `calculateScanRegion` | `(video) => ScanRegion` | centered 2/3 square | Define the scan crop area |
| `preferredCamera` | `'environment' \| 'user' \| string` | `'environment'` | Camera to use |
| `maxScansPerSecond` | `number` | `15` | Max decode attempts per second |
| `highlightScanRegion` | `boolean` | `false` | Show scan region overlay |
| `highlightCodeOutline` | `boolean` | `false` | Highlight detected QR code |
| `overlay` | `HTMLDivElement` | - | Custom overlay element |
| `cameraResolution` | `object` | `{ width: { ideal: 1920 }, height: { ideal: 1080 } }` | Camera resolution |
| `decoderOptions` | `Partial<ReaderOptions>` | - | zxing-wasm reader options |

### Instance Methods

```ts
scanner.start(): Promise<void>
scanner.stop(): void
scanner.destroy(): void
scanner.pause(stopStreamImmediately?): Promise<boolean>
scanner.setCamera(facingModeOrDeviceId): Promise<void>
scanner.hasFlash(): Promise<boolean>
scanner.isFlashOn(): boolean
scanner.toggleFlash(): Promise<void>
scanner.turnFlashOn(): Promise<void>
scanner.turnFlashOff(): Promise<void>
scanner.setInversionMode(mode): void
```

### Static Methods

```ts
QrScanner.hasCamera(): Promise<boolean>
QrScanner.listCameras(requestLabels?): Promise<Camera[]>
QrScanner.scanImage(source, options?): Promise<ScanResult>
QrScanner.preload(): Promise<void>
QrScanner.configureWasm(overrides): void
QrScanner.setWorkerUrl(url): void
```

## Worker Loading

The library uses a Web Worker for off-thread QR decoding. The worker script (`dist/worker.js`) is resolved automatically by modern bundlers (Vite, webpack 5, Parcel) via `new URL('./worker.js', import.meta.url)`.

For CJS consumers or non-standard setups, set the worker URL manually:

```ts
QrScanner.setWorkerUrl('/assets/@agicash/qr-scanner/dist/worker.js');
```

## WASM Loading

By default, the WASM binary (~919 KB) loads from jsDelivr CDN. To self-host:

```ts
QrScanner.configureWasm({
  locateFile: (filename) => `/wasm/${filename}`,
});
```

## Migration from qr-scanner

| qr-scanner | @agicash/qr-scanner |
|------------|-----------------|
| `returnDetailedScanResult: true` | Always returns `ScanResult` |
| `ScanRegion.downScaledWidth/Height` | Removed - no downscaling |
| `createQrEngine()` | Removed - engine is internal |
| `setGrayscaleWeights()` | Removed - handled by WASM |
| `DEFAULT_CANVAS_SIZE` | Removed - no canvas downscale |
| Multiple constructor overloads | Single constructor |

## Browser Support

Chrome 80+, Safari 16+, Firefox 80+, Edge 80+

## License

MIT
