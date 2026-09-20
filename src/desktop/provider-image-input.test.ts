import sharp from 'sharp';
import { expect, it } from 'vitest';

import { normalizeProviderImage } from './provider-image-input';

it('downscales oversized JPEG inputs before sending them to the provider', async () => {
  const source = new Uint8Array(await sharp({
    create: { width: 3072, height: 4096, channels: 3, background: '#7f634d' },
  }).jpeg({ quality: 95 }).toBuffer());

  const normalized = await normalizeProviderImage({ bytes: source, mimeType: 'image/jpeg' });
  const metadata = await sharp(Buffer.from(normalized.bytes)).metadata();

  expect(normalized.mimeType).toBe('image/jpeg');
  expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(2048);
  expect(normalized.bytes.byteLength).toBeLessThan(source.byteLength);
});

it('does not re-encode a small provider image', async () => {
  const source = new Uint8Array(await sharp({
    create: { width: 640, height: 480, channels: 3, background: '#334455' },
  }).jpeg({ quality: 80 }).toBuffer());

  const normalized = await normalizeProviderImage({ bytes: source, mimeType: 'image/jpeg' });

  expect(normalized.bytes).toEqual(source);
  expect(normalized.mimeType).toBe('image/jpeg');
});

it('preserves transparency when resizing PNG provider inputs', async () => {
  const source = new Uint8Array(await sharp({
    create: { width: 2300, height: 800, channels: 4, background: { r: 20, g: 30, b: 40, alpha: 0.35 } },
  }).png().toBuffer());

  const normalized = await normalizeProviderImage({ bytes: source, mimeType: 'image/png' });
  const metadata = await sharp(Buffer.from(normalized.bytes)).metadata();

  expect(normalized.mimeType).toBe('image/png');
  expect(metadata.width).toBe(2048);
  expect(metadata.hasAlpha).toBe(true);
});
