# Spec: @agicash/qr-scanner

A high-performance QR code scanner for the web, powered by ZXing-C++ WebAssembly. Drop-in replacement for [nimiq/qr-scanner](https://github.com/nimiq/qr-scanner) with significantly better decoding of dense QR codes.

## Motivation

Existing open-source web QR scanners (qr-scanner, html5-qrcode, jsQR) downscale video frames to ~400px before decoding. Dense QR codes (version 25+, 117×117 modules) get ~3.4 pixels per module at that resolution — often insufficient with real-world blur, noise, and perspective distortion. Native camera apps handle the same codes easily because they use full sensor resolution with hardware-accelerated ML.

This library closes that gap by:

1. **No forced downscale** — feeds high-resolution frames to the decoder (720–1080px+ depending on device)
2. **WASM decoder** — ZXing-C++ compiled to WebAssembly, ~2× faster than pure-JS decoders
3. **Web Worker** — decoding runs off the main thread, keeping UI at 60fps
4. **`tryHarder` mode** — additional processing passes specifically for hard-to-read codes

## Package details

- **Name:** `@agicash/qr-scanner` (or whatever is available on npm)
- **Language:** TypeScript
- **Module format:** ESM and CJS
- **Target:** Modern browsers (Chrome 80+, Safari 16+, Firefox 80+, Edge 80+)
- **Dependency:** `zxing-wasm` (peer or bundled — see [WASM loading](#wasm-loading) section)
- **License:** MIT
- **Package manager:** bun
- **Build tool:** tsup or similar (ESM + CJS + .d.ts)

## API design

The API mirrors [nimiq/qr-scanner](https://github.com/nimiq/qr-scanner) where it makes sense, so migration is straightforward. Differences are noted inline.

### Constructor and core lifecycle

```ts
import QrScanner from '@agicash/qr-scanner';

const scanner = new QrScanner(videoElement, (result) => {
  console.log(result.data);          // decoded string
  console.log(result.cornerPoints);  // QR code corner positions
}, {
  // All options are optional
  onDecodeError: (error) => {},
  calculateScanRegion: (video) => ({ x, y, width, height }),
  preferredCamera: 'environment',
  maxScansPerSecond: 15,
  highlightScanRegion: true,
  highlightCodeOutline: true,
  overlay: document.getElementById('my-overlay'),
});

await scanner.start();  // Request camera, start scanning
scanner.stop();         // Stop scanning, release camera
scanner.destroy();      // Stop + clean up all resources
await scanner.pause();  // Pause scanning, optionally keep stream
```

### Options

```ts
type ScannerOptions = {
  /**
   * Called when a QR code is successfully decoded.
   * Same as qr-scanner's onDecode with returnDetailedScanResult: true.
   */
  // (passed as second constructor arg, not in options — matches qr-scanner API)

  /**
   * Called when a frame is scanned but no QR code is found, or decoding fails.
   * @default silent (no-op)
   */
  onDecodeError?: (error: Error | string) => void;

  /**
   * Define the scan region within the video frame.
   * Receives the video element (use videoWidth/videoHeight for actual resolution).
   * Return value defines the crop area sent to the decoder.
   *
   * Unlike qr-scanner, there are no downScaledWidth/downScaledHeight fields —
   * the cropped region is sent at full resolution to the WASM decoder.
   *
   * @default Centered square covering 2/3 of the smaller video dimension
   */
  calculateScanRegion?: (video: HTMLVideoElement) => ScanRegion;

  /**
   * Which camera to prefer.
   * @default 'environment' (back camera on mobile)
   */
  preferredCamera?: FacingMode | DeviceId;

  /**
   * Maximum number of decode attempts per second.
   * The actual rate may be lower if decoding takes longer than the interval.
   * @default 15
   */
  maxScansPerSecond?: number;

  /**
   * Show the default scan region overlay (semi-transparent with cutout).
   * @default false
   */
  highlightScanRegion?: boolean;

  /**
   * Highlight detected QR code outlines.
   * @default false
   */
  highlightCodeOutline?: boolean;

  /**
   * Provide a custom overlay element instead of the built-in one.
   * The scanner will position it over the video.
   */
  overlay?: HTMLDivElement;

  /**
   * Camera resolution preferences. The browser will try to match these
   * but may fall back to lower resolution (e.g., iOS Safari caps at 720p).
   * @default { width: { ideal: 1920 }, height: { ideal: 1080 } }
   */
  cameraResolution?: {
    width?: MediaTrackConstraintSet['width'];
    height?: MediaTrackConstraintSet['height'];
  };

  /**
   * zxing-wasm ReaderOptions passed directly to the decoder.
   * Useful for enabling tryDenoise, changing binarizer, etc.
   * Format is always locked to QRCode.
   */
  decoderOptions?: Partial<ZxingReaderOptions>;
};
```

### Types

```ts
type ScanRegion = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Note: no downScaledWidth/downScaledHeight — full resolution is used
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
```

### Instance methods

```ts
class QrScanner {
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
}
```

### Static methods

```ts
class QrScanner {
  /** Check if the device has at least one camera. */
  static hasCamera(): Promise<boolean>;

  /** List available cameras. Pass true to request labels (triggers permission prompt). */
  static listCameras(requestLabels?: boolean): Promise<Camera[]>;

  /**
   * Scan a single image (not a video stream).
   * Accepts an image element, canvas, blob, file, or URL.
   */
  static scanImage(
    source: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas |
            ImageBitmap | File | Blob | URL | string,
    options?: {
      scanRegion?: ScanRegion | null;
      canvas?: HTMLCanvasElement | null;
      decoderOptions?: Partial<ZxingReaderOptions>;
    },
  ): Promise<ScanResult>;
}
```

### API differences from qr-scanner

| Feature | qr-scanner (nimiq) | @agicash/qr-scanner |
|---------|-------------------|-----------------|
| Decoder | JS worker + BarcodeDetector API | zxing-wasm (WASM) in Web Worker |
| Frame resolution | Downscaled to 400×400 | Full scan region resolution |
| `ScanRegion.downScaledWidth/Height` | Supported | **Removed** — no downscaling |
| `returnDetailedScanResult` option | Required for ScanResult | **Always returns ScanResult** (no legacy string mode) |
| `cameraResolution` option | Not available | New — configure ideal camera resolution |
| `decoderOptions` option | Not available | New — pass-through to zxing-wasm |
| Legacy constructor overloads | 4 overloads | **Single constructor** (no deprecated forms) |
| `DEFAULT_CANVAS_SIZE` | 400 | **Removed** — no canvas downscale |
| `createQrEngine()` | Public static | **Removed** — engine is internal |
| `setGrayscaleWeights()` | Supported | **Removed** — handled by WASM internally |

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  QrScanner instance                                        │
│                                                            │
│  ┌──────────┐    ┌──────────────────┐                      │
│  │  <video>  │───▶│  OffscreenCanvas  │                     │
│  │  stream   │    │  crop scan region │                     │
│  └──────────┘    │  extract ImageData │                     │
│                  └────────┬─────────┘                      │
│                           │ transferable                   │
│                  ┌────────▼─────────┐                      │
│                  │  Web Worker       │                      │
│                  │  zxing-wasm       │                      │
│                  │  readBarcodes()   │                      │
│                  └────────┬─────────┘                      │
│                           │                                │
│                  ┌────────▼─────────┐   ┌───────────────┐  │
│                  │  Result mapping   │──▶│  onDecode()    │  │
│                  │  + overlay update │   │  callback      │  │
│                  └──────────────────┘   └───────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Camera layer

Request the highest available resolution via `getUserMedia`. iOS Safari caps at 720p for the back camera — this is a hard platform limit that even paid scanner libraries cannot bypass.

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: preferredCamera,
    width: { ideal: 1920 },   // configurable via cameraResolution option
    height: { ideal: 1080 },
  },
  audio: false,
});
```

### Frame extraction loop

Driven by `requestAnimationFrame`. Uses backpressure — only sends a new frame to the worker when the previous decode completes. This naturally adapts to device capability.

```
rAF tick → is worker idle? → yes → draw video to canvas → crop scan region → get ImageData → transfer to worker
                           → no  → skip this frame
```

The frame rate is also capped by `maxScansPerSecond` (default 15). Between backpressure and the rate cap, the loop self-tunes without manual FPS management.

### Web Worker

The worker:
1. Initializes `zxing-wasm/reader` (loads the ~919 KB WASM binary once)
2. Receives `ImageData` via `postMessage` (use `Transferable` to avoid copy)
3. Calls `readBarcodes(imageData, readerOptions)`
4. Posts the result (decoded text + corner points, or null) back

```ts
// Pseudocode for worker internals
import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';

const defaultOptions: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryInvert: true,
  tryRotate: true,
  tryDenoise: false,
  maxNumberOfSymbols: 1,
};

self.onmessage = async (e: MessageEvent) => {
  if (e.data.type === 'configure') {
    Object.assign(defaultOptions, e.data.options);
    return;
  }
  const results = await readBarcodes(e.data.imageData, defaultOptions);
  // Map zxing-wasm ReadResult to our ScanResult format
  const mapped = results
    .filter(r => r.isValid)
    .map(r => ({ data: r.text, cornerPoints: mapPosition(r.position) }));
  self.postMessage({ results: mapped });
};
```

### zxing-wasm decoder defaults

| Option | Default | Rationale |
|--------|---------|-----------|
| `formats` | `['QRCode']` | Only QR codes — skip other format checks for speed |
| `tryHarder` | `true` | Extra processing passes for dense/blurry codes |
| `tryInvert` | `true` | Handle inverted (light-on-dark) QR codes |
| `tryRotate` | `true` | Handle rotated codes |
| `tryDenoise` | `false` | Disabled by default for speed — users can enable via `decoderOptions` |
| `tryDownscale` | `true` | Fallback scan at lower res if full-res fails |
| `maxNumberOfSymbols` | `1` | One QR code per frame is the common case |

All defaults can be overridden via the `decoderOptions` constructor option.

### Scan region overlay

Built-in overlay (when `highlightScanRegion: true`):
- Semi-transparent dark mask covering the full video
- Transparent cutout in the center (matching the scan region)
- Rounded corner markers on the cutout
- Animated white outline around detected QR code (when `highlightCodeOutline: true`), positioned using `cornerPoints` from the decode result

Implemented as an absolutely-positioned `<div>` with an SVG child, injected as a sibling to the `<video>` element. The scanner expects the video's parent element to have `position: relative`.

Users can provide their own overlay element via the `overlay` option, or skip the built-in one entirely and use `cornerPoints` from `ScanResult` to render custom highlights.

### WASM loading

The `zxing-wasm` reader WASM binary (~919 KB) is loaded asynchronously on first use. The library must support these loading strategies:

1. **CDN (default):** Load from jsDelivr (zxing-wasm's default behavior). Zero config.
2. **Self-hosted:** Users call a static config method before creating a scanner to point to their own hosted binary:
   ```ts
   QrScanner.configureWasm({ locateFile: (filename) => `/wasm/${filename}` });
   ```
3. **Bundler integration:** For bundlers that handle `.wasm` files (Vite, webpack with experiments.asyncWebAssembly), the WASM file can be imported and provided directly.

## Bundle size

| | JS (gzipped) | Async WASM | Total |
|---|---|---|---|
| **qr-scanner** (current) | ~16 KB | ~55 KB worker | ~71 KB |
| **@agicash/qr-scanner** | ~5-8 KB | ~919 KB WASM | ~925 KB |

The WASM binary is loaded **asynchronously on first scanner use**, not in the main bundle. Initial page load is unaffected. The binary is cacheable with long TTL — only downloaded once per user.

~920 KB extra on first scanner use adds ~1-2s on fast 4G. Mitigations:
- Show a brief loading indicator while WASM initializes
- Expose a static `QrScanner.preload()` method to warm up the WASM before the scanner is needed
- Cacheable by service workers and browser HTTP cache

## Browser compatibility

| API | Required support |
|-----|---------|
| WebAssembly | Chrome 57+, Safari 11+, Firefox 52+, Edge 16+ |
| getUserMedia | Chrome 53+, Safari 11+, Firefox 36+, Edge 12+ |
| Web Workers | All modern browsers |
| OffscreenCanvas | Chrome 69+, Safari 16.4+, Firefox 105+ |
| requestAnimationFrame | All modern browsers |

**Minimum target:** Chrome 80+, Safari 16+, Firefox 80+, Edge 80+.

**OffscreenCanvas fallback:** If `OffscreenCanvas` is unavailable, fall back to a regular `<canvas>` element (hidden, appended to the DOM). This only affects Safari < 16.4.

### Known platform limits

- **iOS Safari**: `getUserMedia` caps at **720p** for the back camera. This is a hard platform limit. Native camera apps bypass it by using Apple's Vision framework with direct sensor access. No web-based scanner (free or paid) can exceed this.
- **Android Chrome**: Supports 1080p+ depending on device. The performance improvement is most noticeable here.

## Development commands

Use **bun** as the package manager. Never use npm, npx, yarn, or pnpm.

```bash
bun install              # Install dependencies
bun run build            # Build the library (tsup)
bun run test             # Run tests (vitest)
bun run dev              # Start demo dev server (cd demo && vite)
bun run lint             # Lint (if configured)
bun run typecheck        # Type check (tsc --noEmit)
```

## Project structure

```
@agicash/qr-scanner/
├── src/
│   ├── index.ts                 # Main entry point, QrScanner class
│   ├── scanner.ts               # Core scanner logic (camera, frame loop, lifecycle)
│   ├── worker.ts                # Web Worker entry point (zxing-wasm decoding)
│   ├── camera.ts                # Camera access (getUserMedia, stream management, flash)
│   ├── frame-extractor.ts       # rAF loop, canvas crop, ImageData extraction
│   ├── overlay.ts               # Built-in scan region overlay + code outline
│   ├── scan-region.ts           # Default scan region calculation
│   ├── types.ts                 # Public type definitions
│   └── utils.ts                 # Shared utilities
├── demo/
│   ├── src/
│   │   ├── App.tsx              # Demo React app
│   │   ├── main.tsx             # Entry point
│   │   └── Scanner.tsx          # Scanner demo component
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── tests/
│   ├── scanner.test.ts          # Integration tests
│   ├── worker.test.ts           # Worker unit tests
│   ├── camera.test.ts           # Camera mock tests
│   ├── frame-extractor.test.ts  # Frame extraction tests
│   ├── scan-region.test.ts      # Scan region calculation tests
│   ├── scan-image.test.ts       # Static scanImage tests
│   └── fixtures/                # Test QR code images at various densities
│       ├── simple.png           # Low-density QR (short text)
│       ├── dense-v25.png        # Dense QR (version 25, 117×117)
│       ├── dense-v40.png        # Maximum density QR (version 40, 177×177)
│       ├── inverted.png         # Light-on-dark QR
│       └── rotated.png          # 90° rotated QR
├── package.json                 # bun workspace root
├── bun.lock                     # bun lockfile (text format)
├── tsconfig.json
├── tsup.config.ts               # Build config (ESM + CJS + .d.ts)
├── vitest.config.ts
├── README.md
└── LICENSE
```

## Tests

Use **Vitest** (run via `bun run test`) for all tests. Tests are split into unit tests (mocked dependencies) and integration tests (real WASM decoder).

### Unit tests

**`scan-region.test.ts`** — Default scan region calculation:
- Returns centered square of 2/3 of smaller dimension for landscape video (1920×1080 → 720×720 centered)
- Returns centered square of 2/3 of smaller dimension for portrait video (1080×1920 → 720×720 centered)
- Returns centered square of 2/3 for square video (1080×1080 → 720×720 centered)
- Handles very small video dimensions without error
- Custom `calculateScanRegion` callback overrides the default

**`camera.test.ts`** — Camera management (mock `getUserMedia`):
- Requests environment-facing camera by default
- Applies `cameraResolution` option to constraints
- Stops all tracks on cleanup
- Throws descriptive error on permission denied (`NotAllowedError`)
- Throws descriptive error when no camera found (`NotFoundError`)
- `setCamera()` stops old stream and starts new one
- `hasCamera()` returns true/false based on `enumerateDevices`
- `listCameras()` returns camera list with IDs and labels
- Flash methods use the camera track's `torch` capability

**`frame-extractor.test.ts`** — Frame extraction loop:
- Extracts ImageData from the scan region of a video frame
- Respects `maxScansPerSecond` rate limit
- Implements backpressure — skips frames while worker is busy
- Stops extraction when `stop()` is called
- Cancels `requestAnimationFrame` on destroy

**`worker.test.ts`** — Web Worker:
- Decodes a valid QR code from ImageData and returns `{ data, cornerPoints }`
- Returns null when no QR code is found
- Accepts custom decoder options via configure message
- Handles WASM initialization errors gracefully

### Integration tests (real WASM decoder)

**`scan-image.test.ts`** — `QrScanner.scanImage()` static method:
- Decodes a simple QR code from a PNG file
- Decodes a dense (version 25) QR code from a PNG file
- Decodes a maximum density (version 40) QR code from a PNG file
- Decodes an inverted QR code
- Decodes a rotated QR code (90°)
- Returns correct `cornerPoints` positions
- Throws when no QR code is found in the image
- Respects `scanRegion` option — only decodes within the specified region

**`scanner.test.ts`** — Full scanner lifecycle (mock camera, real WASM):
- `start()` resolves once camera stream is active
- `stop()` releases camera stream
- `destroy()` terminates worker and releases all resources
- `pause()` / `start()` cycle works without re-initializing worker
- Calls `onDecode` when a QR code is detected in the video stream
- Calls `onDecodeError` when no QR code is found (if callback provided)
- Does not call `onDecode` more than `maxScansPerSecond` times per second
- Multiple `start()` calls don't create multiple camera streams

### Test fixtures

Generate QR code test images programmatically in a test setup script using a QR generator (e.g., `qrcode` package):

| Fixture | Content | QR Version | Modules |
|---------|---------|-----------|---------|
| `simple.png` | `hello` | ~1 | 21×21 |
| `dense-v25.png` | 1000-char random alphanumeric | ~25 | 117×117 |
| `dense-v40.png` | 2500-char random alphanumeric | ~40 | 177×177 |
| `inverted.png` | `hello` (white on black) | ~1 | 21×21 |
| `rotated.png` | `hello` (rotated 90°) | ~1 | 21×21 |

## Demo app

A minimal React app using Vite, deployable to Vercel with zero config.

### Features

1. **Live camera scanner** — full-screen camera view with scan region overlay, decoded text displayed below
2. **Image upload scanner** — drag-and-drop or file picker, uses `QrScanner.scanImage()`
3. **Camera controls** — switch front/back camera, toggle flash
4. **Result display** — shows decoded text, QR version, corner points
5. **Dense QR test** — generates QR codes at various densities on-page for testing with a second device

### Setup

```
demo/
├── src/
│   ├── App.tsx              # Tab layout: Live Scanner | Image Upload | Generate Test QRs
│   ├── main.tsx
│   ├── LiveScanner.tsx      # Camera scanner with all options
│   ├── ImageScanner.tsx     # Drag-and-drop image scanning
│   ├── TestQRCodes.tsx      # Generates QR codes at v1, v10, v25, v40 densities
│   └── ResultDisplay.tsx    # Shows scan result details
├── index.html
├── package.json             # Dependencies: react, react-dom, @agicash/qr-scanner, qrcode.react (managed with bun)
├── tsconfig.json
└── vite.config.ts
```

### Deployment

The demo app should be deployable to Vercel by running:

```bash
cd demo
bun install
bun run build  # vite build
```

Vercel auto-detects Vite projects. Include a `demo/vercel.json` if needed:

```json
{
  "installCommand": "bun install",
  "buildCommand": "bun run build",
  "outputDirectory": "dist"
}
```

The demo should use the library from the parent directory via a bun workspace link or relative path import during development, and from npm in production.

### HTTPS requirement

`getUserMedia` requires HTTPS (or localhost). The Vite dev server supports HTTPS via `@vitejs/plugin-basic-ssl`. The demo's `vite.config.ts` should include this plugin so the camera works during local development.

## Implementation plan

Each phase produces a working, testable artifact. Phases can be shipped as separate PRs.

### Phase 1: Project setup and Web Worker decoder

Set up the repo, build pipeline, and the core decoding capability.

1. Initialize repo with `bun init`, set up `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
2. Create `src/types.ts` with all public type definitions
3. Create `src/worker.ts` — Web Worker that imports `zxing-wasm/reader`, handles `configure` and `decode` messages
4. Create `src/scan-region.ts` — default scan region calculation (centered 2/3 square)
5. Create test fixtures (generate QR code PNGs at various densities)
6. Write and pass: `scan-region.test.ts`, `worker.test.ts`
7. Implement `QrScanner.scanImage()` static method (no camera — just decodes an image)
8. Write and pass: `scan-image.test.ts` (integration tests with real WASM)

**Done when:** `QrScanner.scanImage()` successfully decodes all test fixtures including dense QR codes.

### Phase 2: Camera and frame extraction

Add camera management and the video → canvas → worker pipeline.

1. Create `src/camera.ts` — `getUserMedia` wrapper with resolution config, stream lifecycle, flash, camera switching
2. Create `src/frame-extractor.ts` — `requestAnimationFrame` loop, canvas crop, `ImageData` extraction, backpressure, rate limiting
3. Create `src/scanner.ts` — compose camera + frame extractor + worker into the `QrScanner` class with full lifecycle (`start`, `stop`, `destroy`, `pause`)
4. Create `src/index.ts` — re-export `QrScanner` as default export + all types
5. Write and pass: `camera.test.ts`, `frame-extractor.test.ts`, `scanner.test.ts`

**Done when:** `new QrScanner(video, onDecode).start()` works and decodes QR codes from a camera stream. No overlay yet.

### Phase 3: Overlay and visual feedback

Add the scan region indicator and code outline highlighting.

1. Create `src/overlay.ts` — generates the overlay DOM (dark mask with cutout, corner markers, code outline SVG)
2. Integrate overlay into `scanner.ts` — create/position/update on scan, remove on destroy
3. Support `highlightScanRegion`, `highlightCodeOutline`, and custom `overlay` options
4. Add CSS that can be imported by consumers (`@agicash/qr-scanner/style.css` or injected automatically)

**Done when:** Scanner shows a visual scan region and highlights detected QR codes.

### Phase 4: Demo app

Build the demo React app for testing and showcasing.

1. Set up `demo/` with Vite + React + TypeScript
2. Implement `LiveScanner.tsx` — camera scanner with controls (camera switch, flash toggle)
3. Implement `ImageScanner.tsx` — drag-and-drop / file picker image scanning
4. Implement `TestQRCodes.tsx` — generates QR codes at various densities using `qrcode.react`
5. Implement `ResultDisplay.tsx` — shows decoded data, corner points
6. Add HTTPS support for local dev (`@vitejs/plugin-basic-ssl`)
7. Add `vercel.json` for deployment
8. Test on iOS Safari and Android Chrome

**Done when:** Demo is deployed to Vercel and scanning works on mobile devices.

### Phase 5: Polish and publish

1. Performance tuning — test with dense QR codes, experiment with `tryDenoise`, measure decode rates on real devices
2. Write `README.md` with usage examples, API reference, migration guide from qr-scanner
3. Add `QrScanner.preload()` static method for eager WASM initialization
4. Configure WASM self-hosting docs and examples
5. Final edge-case testing: tab switching, app backgrounding, permission denied, no camera
6. Publish to npm

**Done when:** Package is published and installable via `bun add @agicash/qr-scanner` (or `npm install @agicash/qr-scanner`).
