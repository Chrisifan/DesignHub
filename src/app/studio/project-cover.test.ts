import { expect, it } from 'vitest';

import {
  defaultProjectCoverUrl,
  maxProjectCoverBytes,
  readProjectCoverFile,
  validateProjectCoverFile,
} from './project-cover';

it('accepts supported raster covers and preserves their bytes', async () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'cover.webp', { type: 'image/webp' });

  expect(validateProjectCoverFile(file)).toBeNull();
  await expect(readProjectCoverFile(file)).resolves.toEqual({
    name: 'cover.webp',
    mimeType: 'image/webp',
    bytes: new Uint8Array([1, 2, 3]),
  });
});

it('rejects empty, unsupported, and oversized covers', () => {
  expect(validateProjectCoverFile(new File([], 'empty.png', { type: 'image/png' }))).toBe('EMPTY_FILE');
  expect(validateProjectCoverFile(new File(['svg'], 'cover.svg', { type: 'image/svg+xml' }))).toBe('UNSUPPORTED_TYPE');
  const oversized = new File([new Uint8Array(maxProjectCoverBytes + 1)], 'large.png', { type: 'image/png' });
  expect(validateProjectCoverFile(oversized)).toBe('FILE_TOO_LARGE');
});

it('uses the bundled project cover as the stable fallback', () => {
  expect(defaultProjectCoverUrl).toBe('/project-default-cover.png');
});
