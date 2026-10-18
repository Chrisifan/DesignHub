import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import * as expandImage from './expand-image';

const { buildExpandPrompt, prepareExpandedImage } = expandImage;

const pixelAt = async (bytes: Uint8Array, x: number, y: number): Promise<number[]> => {
  const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return [...data.subarray(offset, offset + info.channels)];
};

describe('expand image preparation', () => {
  it('uses distinct preservation rules for the two expansion modes', () => {
    const originalScene = buildExpandPrompt('original-scene');
    const atmospheric = buildExpandPrompt('atmospheric');

    expect(originalScene).toContain('Do not add new subjects');
    expect(atmospheric).toContain('atmospheric details');
    expect(originalScene).not.toBe(atmospheric);
    expect(originalScene).toContain('Do not redraw or alter any pixel inside the original image bounds');
    expect(atmospheric).toContain('Do not redraw or alter any pixel inside the original image bounds');
  });

  it('creates a target-sized transparent canvas and an edge-only edit mask', async () => {
    const source = new Uint8Array(await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#3366ffff' },
    }).png().toBuffer());

    const prepared = await prepareExpandedImage(source, {
      mode: 'original-scene', top: 1, right: 2, bottom: 1, left: 1,
    });

    expect(prepared).toMatchObject({ width: 5, height: 4, size: '5x4' });
    await expect(sharp(Buffer.from(prepared.imageBytes)).metadata()).resolves.toMatchObject({ width: 5, height: 4, hasAlpha: true });
    await expect(sharp(Buffer.from(prepared.maskBytes)).metadata()).resolves.toMatchObject({ width: 5, height: 4, hasAlpha: true });
    expect(await pixelAt(prepared.maskBytes, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(await pixelAt(prepared.maskBytes, 1, 1)).toEqual([255, 255, 255, 255]);
  });
});

describe('expand image result ownership', () => {
  it('does not expose local provider-result compositing', () => {
    expect(expandImage).not.toHaveProperty('finalizeExpandedImage');
  });

  it('normalizes the complete provider result with a centered cover crop', async () => {
    const normalize = (expandImage as unknown as {
      normalizeExpandedImageResult?: (bytes: Uint8Array, width: number, height: number) => Promise<Uint8Array>;
    }).normalizeExpandedImageResult;
    expect(normalize).toBeTypeOf('function');
    if (!normalize) return;

    const pixels = Buffer.alloc(4 * 4 * 3);
    const colors = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
    ];
    for (let y = 0; y < 4; y += 1) {
      colors.forEach((color, x) => {
        pixels.set(color, (y * 4 + x) * 3);
      });
    }
    const providerResult = new Uint8Array(await sharp(pixels, { raw: { width: 4, height: 4, channels: 3 } }).png().toBuffer());

    const normalized = await normalize(providerResult, 2, 4);
    const { data, info } = await sharp(Buffer.from(normalized)).raw().toBuffer({ resolveWithObject: true });

    expect(info).toMatchObject({ width: 2, height: 4 });
    expect([...data.subarray(0, 6)]).toEqual([0, 255, 0, 0, 0, 255]);
  });

  it('keeps an already exact provider result byte-for-byte', async () => {
    const normalize = (expandImage as unknown as {
      normalizeExpandedImageResult?: (bytes: Uint8Array, width: number, height: number) => Promise<Uint8Array>;
    }).normalizeExpandedImageResult;
    expect(normalize).toBeTypeOf('function');
    if (!normalize) return;
    const providerResult = new Uint8Array(await sharp({
      create: { width: 3, height: 2, channels: 3, background: '#336699' },
    }).jpeg().toBuffer());

    const normalized = await normalize(providerResult, 3, 2);

    expect(normalized).toEqual(providerResult);
  });
});
