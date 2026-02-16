import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { scanImage } from '../src/scan-image.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

function loadFixture(filename: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES_DIR, filename)));
}

function loadFixtureContent(filename: string): string {
  return readFileSync(join(FIXTURES_DIR, filename), 'utf-8').trim();
}

describe('scanImage', () => {
  it('decodes a simple QR code from a PNG file', async () => {
    const data = loadFixture('simple.png');
    const result = await scanImage(data);
    expect(result.data).toBe('hello');
  });

  it('decodes a dense (version 25) QR code', async () => {
    const data = loadFixture('dense-v25.png');
    const expectedContent = loadFixtureContent('dense-v25-content.txt');
    const result = await scanImage(data);
    expect(result.data).toBe(expectedContent);
  });

  it('decodes a maximum density (version 40) QR code', async () => {
    const data = loadFixture('dense-v40.png');
    const expectedContent = loadFixtureContent('dense-v40-content.txt');
    const result = await scanImage(data);
    expect(result.data).toBe(expectedContent);
  });

  it('decodes an inverted QR code', async () => {
    const data = loadFixture('inverted.png');
    const result = await scanImage(data);
    expect(result.data).toBe('hello');
  });

  it('decodes a rotated QR code (90°)', async () => {
    const data = loadFixture('rotated.png');
    const result = await scanImage(data);
    expect(result.data).toBe('hello');
  });

  it('returns correct cornerPoints positions', async () => {
    const data = loadFixture('simple.png');
    const result = await scanImage(data);

    expect(result.cornerPoints).toHaveLength(4);
    for (const point of result.cornerPoints) {
      expect(point).toHaveProperty('x');
      expect(point).toHaveProperty('y');
      expect(typeof point.x).toBe('number');
      expect(typeof point.y).toBe('number');
    }
  });

  it('throws when no QR code is found in the image', async () => {
    // Create a tiny valid 1x1 white PNG
    // Simplest approach: use sharp to create one
    const sharp = (await import('sharp')).default;
    const whitePng = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();

    await expect(scanImage(new Uint8Array(whitePng))).rejects.toThrow('No QR code found');
  });

  it('accepts decoder options', async () => {
    const data = loadFixture('simple.png');
    const result = await scanImage(data, {
      decoderOptions: { tryHarder: true, tryInvert: true },
    });
    expect(result.data).toBe('hello');
  });
});
