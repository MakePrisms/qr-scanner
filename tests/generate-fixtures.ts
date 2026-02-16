/**
 * Generate QR code test fixture images.
 * Run with: bun tests/generate-fixtures.ts
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');
mkdirSync(FIXTURES_DIR, { recursive: true });

// Generate a random alphanumeric string
function randomAlphanumeric(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateFixtures() {
  // Simple QR (version ~1, 21x21)
  const simpleBuffer = await QRCode.toBuffer('hello', {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  writeFileSync(join(FIXTURES_DIR, 'simple.png'), simpleBuffer);
  console.log('Generated simple.png');

  // Dense v25 QR (~1000 char alphanumeric)
  const denseV25Content = randomAlphanumeric(1000);
  const denseV25Buffer = await QRCode.toBuffer(denseV25Content, {
    type: 'png',
    width: 800,
    margin: 2,
    errorCorrectionLevel: 'L',
  });
  writeFileSync(join(FIXTURES_DIR, 'dense-v25.png'), denseV25Buffer);
  writeFileSync(join(FIXTURES_DIR, 'dense-v25-content.txt'), denseV25Content);
  console.log('Generated dense-v25.png');

  // Dense v40 QR (~2500 char alphanumeric)
  const denseV40Content = randomAlphanumeric(2500);
  const denseV40Buffer = await QRCode.toBuffer(denseV40Content, {
    type: 'png',
    width: 1200,
    margin: 2,
    errorCorrectionLevel: 'L',
  });
  writeFileSync(join(FIXTURES_DIR, 'dense-v40.png'), denseV40Buffer);
  writeFileSync(join(FIXTURES_DIR, 'dense-v40-content.txt'), denseV40Content);
  console.log('Generated dense-v40.png');

  // Inverted QR (white on black)
  const invertedBuffer = await QRCode.toBuffer('hello', {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#FFFFFF',
      light: '#000000',
    },
  });
  writeFileSync(join(FIXTURES_DIR, 'inverted.png'), invertedBuffer);
  console.log('Generated inverted.png');

  // Rotated QR (90 degrees)
  const rotatedBase = await QRCode.toBuffer('hello', {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  const rotatedBuffer = await sharp(rotatedBase).rotate(90).toBuffer();
  writeFileSync(join(FIXTURES_DIR, 'rotated.png'), rotatedBuffer);
  console.log('Generated rotated.png');

  console.log('All fixtures generated!');
}

generateFixtures().catch(console.error);
