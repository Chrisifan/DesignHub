import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import * as taskServiceFactory from './task-service-factory';

const { expectedImageResultSize } = taskServiceFactory;

describe('image task result dimensions', () => {
  it('requires expanded results to match the finalized target canvas size', () => {
    expect(expectedImageResultSize({
      tool: 'expand',
      toolParams: { mode: 'original-scene', top: 100, right: 100, bottom: 100, left: 100 },
      projectDesign: { width: 4200, height: 3200 },
    }, { width: 2048, height: 1561 })).toEqual({ width: 4200, height: 3200 });
  });

  it('still verifies exact dimensions for tools that promise an exact raster size', () => {
    expect(expectedImageResultSize({
      tool: 'smart-crop',
      toolParams: { width: 1200, height: 800 },
    }, { width: 2048, height: 1561 })).toEqual({ width: 1200, height: 800 });
  });

  it('uses the frozen expansion size when retry input no longer has project design metadata', () => {
    expect(expectedImageResultSize({
      tool: 'expand',
      size: '1356x1718',
      toolParams: { mode: 'original-scene', top: 135, right: 135, bottom: 135, left: 135 },
    }, { width: 1356, height: 1718 })).toEqual({ width: 1356, height: 1718 });
  });

  it('normalizes only an expanded provider result to the frozen target size', async () => {
    const normalize = (taskServiceFactory as unknown as {
      normalizeProviderImageResults?: (
        input: { tool: string; size: string },
        images: Array<{ base64: string; mimeType: string }>,
        loader: (image: { base64: string; mimeType: string }) => Promise<{ bytes: Uint8Array; mimeType: string }>,
      ) => Promise<Array<{ base64?: string; mimeType?: string }>>;
    }).normalizeProviderImageResults;
    expect(normalize).toBeTypeOf('function');
    if (!normalize) return;
    const providerBytes = new Uint8Array(await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#336699' },
    }).jpeg().toBuffer());
    const original = { base64: Buffer.from(providerBytes).toString('base64'), mimeType: 'image/jpeg' };

    const normalized = await normalize(
      { tool: 'expand', size: '2x4' },
      [original],
      async () => ({ bytes: providerBytes, mimeType: 'image/jpeg' }),
    );

    expect(normalized[0]?.mimeType).toBe('image/png');
    const metadata = await sharp(Buffer.from(normalized[0]?.base64 ?? '', 'base64')).metadata();
    expect(metadata).toMatchObject({ width: 2, height: 4 });
  });
});
