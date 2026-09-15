import { expect, it } from 'vitest';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createNodeCodec } from './node-codec';

const transparentPng = async (): Promise<Uint8Array> => new Uint8Array(await sharp({
  create: { width: 3, height: 2, channels: 4, background: { r: 220, g: 30, b: 80, alpha: 0 } },
}).png().toBuffer());

it('converts a real transparent PNG to JPEG with an explicit background', async () => {
  const codec = createNodeCodec();
  const output = await codec.encode(await transparentPng(), { format: 'jpeg', background: '#ffffff' });
  const metadata = await codec.inspect(output);

  expect(metadata.format).toBe('jpeg');
  expect(metadata.width).toBe(3);
  expect(metadata.height).toBe(2);
  expect(metadata.hasAlpha).toBe(false);
  expect(metadata.colorSpace).toBe('srgb');
  expect(output[0]).toBe(0xff);
  expect(output[1]).toBe(0xd8);
});

it('rejects transparent JPEG conversion without a background choice', async () => {
  const codec = createNodeCodec();
  await expect(codec.encode(await transparentPng(), { format: 'jpeg' })).rejects.toThrow('BACKGROUND_REQUIRED');
});

it('encodes real PNG, JPEG, and WebP output with dimensions preserved', async () => {
  const codec = createNodeCodec();
  const source = await transparentPng();
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    const output = await codec.encode(source, { format, background: '#ffffff' });
    const metadata = await codec.inspect(output);
    expect(metadata.format).toBe(format);
    expect(metadata.width).toBe(3);
    expect(metadata.height).toBe(2);
  }
});

it('generates a standard PDF page from a real PNG', async () => {
  const codec = createNodeCodec();
  const pdf = await codec.toPdf(await transparentPng());
  expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(100);
  const document = await PDFDocument.load(pdf);
  const page = document.getPage(0);
  expect(page.getWidth()).toBe(3);
  expect(page.getHeight()).toBe(2);
});

it('generates a standard PDF page from a real WebP', async () => {
  const codec = createNodeCodec();
  const source = await transparentPng();
  const webp = await codec.encode(source, { format: 'webp' });
  const pdf = await codec.toPdf(webp);
  const document = await PDFDocument.load(pdf);
  expect(document.getPageCount()).toBe(1);
});

it('rejects unsupported image formats instead of relabeling them as JPEG', async () => {
  const codec = createNodeCodec();
  const gif = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#000000' } }).gif().toBuffer();
  await expect(codec.inspect(new Uint8Array(gif))).rejects.toThrow('UNSUPPORTED_IMAGE_FORMAT');
});
