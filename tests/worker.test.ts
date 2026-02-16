// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import sharp from 'sharp';

/**
 * Tests for the Web Worker decoding logic.
 * Since the worker.ts runs in a Web Worker context (self.onmessage),
 * we test the same zxing-wasm readBarcodes + mapPosition logic directly.
 */

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

const defaultOptions: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryInvert: true,
  tryRotate: true,
  tryDenoise: false,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

function mapPosition(position: {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}) {
  return [
    position.topLeft,
    position.topRight,
    position.bottomRight,
    position.bottomLeft,
  ];
}

async function loadFixtureAsImageData(filename: string): Promise<ImageData> {
  const buffer = readFileSync(join(FIXTURES_DIR, filename));
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('Worker decoding logic', { timeout: 30_000 }, () => {
  it('decodes a valid QR code from ImageData and returns { data, cornerPoints }', async () => {
    const imageData = await loadFixtureAsImageData('simple.png');
    const results = await readBarcodes(imageData, defaultOptions);

    const valid = results.filter((r) => r.isValid);
    expect(valid.length).toBeGreaterThan(0);

    const mapped = valid.map((r) => ({
      data: r.text,
      cornerPoints: mapPosition(r.position),
    }));

    expect(mapped[0].data).toBe('hello');
    expect(mapped[0].cornerPoints).toHaveLength(4);
    expect(mapped[0].cornerPoints[0]).toHaveProperty('x');
    expect(mapped[0].cornerPoints[0]).toHaveProperty('y');
  });

  it('returns empty results when no QR code is found', async () => {
    // Create a blank white image
    const { data, info } = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const imageData: ImageData = {
      data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      width: info.width,
      height: info.height,
      colorSpace: 'srgb',
    } as ImageData;

    const results = await readBarcodes(imageData, defaultOptions);
    const valid = results.filter((r) => r.isValid);
    expect(valid).toHaveLength(0);
  });

  it('accepts custom decoder options via configure-style merge', async () => {
    const imageData = await loadFixtureAsImageData('simple.png');

    // Merge custom options like the worker does on "configure" message
    const customOptions: ReaderOptions = {
      ...defaultOptions,
      tryHarder: false,
      tryDenoise: true,
      formats: ['QRCode'], // Always locked to QRCode
    };

    const results = await readBarcodes(imageData, customOptions);
    const valid = results.filter((r) => r.isValid);
    expect(valid.length).toBeGreaterThan(0);
    expect(valid[0].text).toBe('hello');
  });

  it('handles invalid ImageData gracefully', async () => {
    // Pass a very small/corrupt ImageData — readBarcodes should not crash
    const tinyData: ImageData = {
      data: new Uint8ClampedArray(4), // 1x1 pixel
      width: 1,
      height: 1,
      colorSpace: 'srgb',
    } as ImageData;

    // Should not throw — just return empty results
    const results = await readBarcodes(tinyData, defaultOptions);
    const valid = results.filter((r) => r.isValid);
    expect(valid).toHaveLength(0);
  });
});
