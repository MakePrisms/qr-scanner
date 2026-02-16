# Spec: High-Performance QR Scanner

**Goal:** Build a custom QR scanner library for web apps similar to `qr-scanner` (nimiq) library. The library should be built on `zxing-wasm` to maximize QR decoding performance for dense codes.

## Why the current scanner is slow

The `qr-scanner` library downscales every video frame to **400×400 pixels** before decoding. A dense QR code (version 25+) has 117×117 modules — at 400px that's ~3.4 pixels per module. With blur/noise/perspective, that's often insufficient.

On iOS Safari, the BarcodeDetector API is unavailable (broken on iOS 18), so it always falls back to a pure-JS web worker decoder — the weakest path.

## Architecture

Replace the entire `qr-scanner` library with:

1. **Camera layer** — `getUserMedia` requesting highest available resolution
2. **Frame extraction** — `requestAnimationFrame` loop drawing video to a canvas, extracting `ImageData`
3. **WASM decoder** — `zxing-wasm/reader` (ZXing-C++ compiled to WebAssembly) running in a **Web Worker**

```
┌─────────────────────────────────────────────────┐
│  QRScanner component                            │
│                                                 │
│  ┌──────────┐    ┌──────────────┐               │
│  │  <video>  │───▶│  <canvas>    │  (offscreen)  │
│  │          │    │  extract     │               │
│  └──────────┘    │  ImageData   │               │
│                  └──────┬───────┘               │
│                         │                       │
│                  ┌──────▼───────┐               │
│                  │  Web Worker  │               │
│                  │  zxing-wasm  │               │
│                  │  /reader     │               │
│                  └──────┬───────┘               │
│                         │                       │
│                  ┌──────▼───────┐               │
│                  │  onDecode()  │               │
│                  └──────────────┘               │
└─────────────────────────────────────────────────┘
```

### Why zxing-wasm

- ZXing-C++ is a mature, actively maintained barcode library used across the industry
- WASM runs ~2× faster than pure-JS decoders (benchmarked at 29ms vs 47ms/frame)
- `tryHarder` mode does additional processing passes for hard-to-read codes
- `tryDenoise` option attempts denoising for 2D codes
- Full control over downscaling behavior (configurable threshold and factor)
- Reader-only subpath (`zxing-wasm/reader`) keeps binary size minimal

### WASM loading

The `zxing-wasm` library fetches its WASM binary from jsDelivr CDN by default. We should self-host the WASM binary instead — copy it to `public/` and configure `prepareZXingModule()` with a custom `locateFile` to load from our origin. This avoids CDN dependency and ensures the binary is cached by our service worker.

## Component interface

The public interface of `QRScanner` stays **identical** — consumers (`ReceiveScanner`, `SendScanner`) don't change:

```tsx
type QRScannerProps = {
  onDecode: (decoded: string) => void;
};

export const QRScanner = ({ onDecode }: QRScannerProps) => { ... };
```

## Key design decisions

### Camera resolution

Request the highest available resolution. iOS Safari caps at 720p regardless, but Android Chrome supports 1080p+.

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: 'environment',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
});
```

### Scan region

Crop a centered square from the video frame before sending to the decoder. Use **the full square** — don't downscale. For a 1080p stream the scan region square is 1080×1080; for 720p it's 720×720. This is the single biggest improvement over the current 400×400.

The scan region should be configurable but default to a centered square covering 2/3 of the smaller video dimension (matching the current UX).

### Frame extraction loop

Use `requestAnimationFrame` to drive the loop. Only send a new frame to the worker when the previous decode has completed (backpressure). This naturally throttles based on device capability.

```
requestAnimationFrame → draw video to canvas → get ImageData → postMessage to worker → wait for result → repeat
```

### Web Worker

The worker:
1. Receives `ImageData` via `postMessage` (transferred, not copied)
2. Calls `readBarcodes(imageData, readerOptions)`
3. Posts the result back

```ts
// worker.ts
import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';

const readerOptions: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryInvert: true,
  tryRotate: true,
  tryDenoise: false, // enable if perf allows
  maxNumberOfSymbols: 1,
};

self.onmessage = async (e: MessageEvent<ImageData>) => {
  const results = await readBarcodes(e.data, readerOptions);
  const text = results.length > 0 && results[0].isValid ? results[0].text : null;
  self.postMessage(text);
};
```

### zxing-wasm decoder options

Key options and their rationale:

| Option | Value | Rationale |
|--------|-------|-----------|
| `formats` | `['QRCode']` | We only scan QR codes — skip other format checks |
| `tryHarder` | `true` | Extra processing passes for dense/blurry codes |
| `tryInvert` | `true` | Handle inverted (light-on-dark) QR codes |
| `tryRotate` | `true` | Handle rotated codes |
| `tryDenoise` | `false` | Start disabled — enable after perf testing |
| `tryDownscale` | `true` (default) | Fallback scan at lower res if full-res fails |
| `downscaleThreshold` | `500` (default) | Skip downscale for images under 500px |
| `maxNumberOfSymbols` | `1` | We only need one QR code per frame |

### Animated QR (BC-UR) support

The existing `useAnimatedQRDecoder` hook is **independent** of the scanner library — it takes a string fragment and accumulates BC-UR parts. It stays unchanged. The scanner component detects `ur:` prefix in decoded text and routes to the animated decoder, exactly as it does today.

### Scan region overlay

Replace the `qr-scanner` library's SVG overlay with a custom implementation:

- Semi-transparent dark overlay covering the video
- Transparent cutout in the center (the scan region)
- Corner markers on the cutout
- White outline highlight when a QR code is detected

Implement using an absolutely-positioned `<div>` with CSS `clip-path` or a canvas overlay. Keep the existing `qr-scanner.css` class names for consistency, or replace with Tailwind utilities.

### Throttling

Keep the existing 3-second decode cooldown (`DECODE_COOLDOWN_MS = 3000`) using `useThrottle` for the `onDecode` callback. This prevents repeated firing on the same QR code. The frame extraction loop runs continuously underneath — only the callback delivery is throttled.

### Error handling

- **Camera permission denied**: Catch `NotAllowedError` from `getUserMedia`, show a user-friendly message
- **No camera available**: Catch `NotFoundError`, show appropriate UI
- **WASM load failure**: Catch and surface — e.g., if the binary fails to download
- **Decode errors**: Silent (no QR found is normal), only surface BC-UR fragment errors via toast (existing behavior)

### Cleanup

On unmount:
- Stop all video tracks (`stream.getTracks().forEach(t => t.stop())`)
- Cancel the `requestAnimationFrame`
- Terminate the web worker

## Bundle size impact

| | JS bundle | Async loaded | Total |
|---|---|---|---|
| **Current** (`qr-scanner`) | ~16 KB gzipped | ~55 KB worker | ~71 KB |
| **New** (`zxing-wasm/reader`) | ~3 KB (glue code) | **~919 KB** WASM binary | ~922 KB |

The WASM binary is loaded **asynchronously when the scanner page opens**, not in the main app bundle. Initial page load is unaffected. The binary is cacheable — only downloaded once.

~920 KB on first scanner visit adds ~1-2s on fast 4G. This is a meaningful trade-off for significantly better decode performance.

### Mitigation

- Self-host and cache the WASM binary (service worker / long cache headers)
- Consider showing a brief loading state while WASM initializes on first use
- Preload the WASM when navigating to send/receive (before scanner page) if possible

## Browser compatibility

All required APIs have broad support:

| API | Support |
|-----|---------|
| WebAssembly | 97%+ (all modern browsers) |
| getUserMedia | 96%+ (all modern browsers) |
| Web Workers | 98%+ (all modern browsers) |
| OffscreenCanvas | 95%+ (Safari 16.4+, Chrome 69+) |
| requestAnimationFrame | 98%+ |

### Known platform limits

- **iOS Safari**: `getUserMedia` is capped at **720p** for the back camera. This is a hard platform limit. Even paid scanner libraries face the same constraint. The native camera app bypasses this by using Apple's Vision framework with direct sensor access.
- **Android Chrome**: Supports 1080p+ depending on device hardware. Our improvement will be most noticeable here.

## Files to create/modify

| File | Action | Description |
|------|--------|-------------|
| `app/components/qr-scanner/qr-scanner.tsx` | **Rewrite** | Replace qr-scanner lib with custom camera + zxing-wasm |
| `app/components/qr-scanner/qr-scanner-worker.ts` | **Create** | Web Worker that runs zxing-wasm decoding |
| `app/components/qr-scanner/use-camera.ts` | **Create** | Hook for getUserMedia camera management |
| `app/components/qr-scanner/use-qr-decoder.ts` | **Create** | Hook for Web Worker lifecycle and frame loop |
| `app/components/qr-scanner/scan-overlay.tsx` | **Create** | Scan region overlay component |
| `app/components/qr-scanner/qr-scanner.css` | **Modify** | Update overlay styles |
| `public/zxing_reader.wasm` | **Create** | Self-hosted WASM binary |
| `package.json` | **Modify** | Add `zxing-wasm`, remove `qr-scanner` |

**No changes needed:**
- `app/features/receive/receive-scanner.tsx` — uses `<QRScanner onDecode={...} />` (unchanged interface)
- `app/features/send/send-scanner.tsx` — same
- `app/lib/cashu/animated-qr-code/use-animated-qr-decoder.tsx` — independent of scanner lib

## Implementation plan

### Phase 1: Core scanner (MVP)

Replace the decoder and camera handling. Get a working scanner without overlay UI.

1. Install `zxing-wasm` dependency
2. Create `qr-scanner-worker.ts` — Web Worker that imports `zxing-wasm/reader`, receives `ImageData`, returns decoded text
3. Create `use-camera.ts` — hook that calls `getUserMedia` with high-res constraints, attaches stream to a `<video>` element, handles cleanup and errors
4. Create `use-qr-decoder.ts` — hook that manages the Web Worker lifecycle and the `requestAnimationFrame` → canvas → `ImageData` → worker → result loop with backpressure
5. Rewrite `qr-scanner.tsx` — compose the hooks, keep `onDecode` interface identical, keep animated QR (BC-UR) routing logic, keep throttle behavior
6. Configure WASM loading — copy binary to `public/`, set up `prepareZXingModule()` with custom `locateFile`
7. Verify: scan a static QR code on both iOS Safari and Android Chrome

**Done when:** Static QR codes scan successfully with the new scanner. No overlay yet — just raw video + decoding.

### Phase 2: Scan region overlay

Add the visual scan region indicator and code highlight.

1. Create `scan-overlay.tsx` — dark overlay with transparent cutout, corner markers
2. Add code outline highlight — when a QR code is detected, briefly highlight its position (use `ReadResult.position` which contains corner coordinates)
3. Update `qr-scanner.css` with new overlay styles
4. Verify: overlay renders correctly on mobile (full screen) and desktop (400×400 square)

**Done when:** Scanner looks and feels similar to the current one, with scan region and code highlighting.

### Phase 3: Performance tuning

Optimize for dense QR codes — the whole point of this work.

1. Test with dense QR codes (long cashu tokens, v25+ QR codes)
2. Experiment with scan region size — try full video dimension vs 2/3 crop
3. Experiment with `tryDenoise: true` — measure decode rate improvement vs frame rate cost
4. Tune frame rate — if the device is slow, reduce scan frequency (e.g., skip every other frame)
5. Compare before/after: create a set of test QR codes at various densities, measure success rate

**Done when:** Dense QR codes that previously failed now scan reliably.

### Phase 4: Cleanup and polish

1. Remove `qr-scanner` package dependency
2. Delete `qr-scanner.css` classes that are no longer used
3. Add WASM loading state — show brief spinner/skeleton while WASM initializes on first use
4. Test edge cases: camera permission denied, no camera, switching tabs, app backgrounding
5. Run `bun run fix:all`
6. Manual testing on iOS Safari, Android Chrome, desktop Chrome/Firefox

**Done when:** No regressions, `qr-scanner` fully removed, all edge cases handled.
