import { expect, it } from 'vitest';
import { exportProjectDesign } from './export-document';
import sharp from 'sharp';
import { createNodeCodec } from './node-codec';

it('exports the requested revision through a temporary file and records its hash', async () => {
  const writes: string[] = [];
  const target = {
    exists: async () => false,
    write: async (path: string) => { writes.push(path); },
  };
  const result = await exportProjectDesign({
    revisionId: 'revision-1',
    format: 'png',
    targetPath: '/exports/poster.png',
    target,
    render: async () => new Uint8Array([137, 80, 78, 71]),
  });
  expect(result.revisionId).toBe('revision-1');
  expect(result.sha256).toHaveLength(64);
  expect(writes).toEqual(['/exports/poster.png.tmp', '/exports/poster.png']);
});

it('does not overwrite an existing target', async () => {
  await expect(exportProjectDesign({
    revisionId: 'revision-1', format: 'png', targetPath: '/exports/poster.png',
    target: { exists: async () => true, write: async () => undefined },
    render: async () => new Uint8Array([137, 80, 78, 71]),
  })).rejects.toThrow('TARGET_EXISTS');
});

it('rechecks the destination after rendering so a late target cannot be overwritten', async () => {
  let checks = 0;
  const writes: string[] = [];
  await expect(exportProjectDesign({
    revisionId: 'revision-1', format: 'png', targetPath: '/exports/poster.png',
    target: {
      exists: async () => { checks += 1; return checks > 1; },
      write: async (path: string) => { writes.push(path); },
      rename: async () => { throw new Error('RENAME_SHOULD_NOT_RUN'); },
      remove: async () => undefined,
    },
    render: async () => new Uint8Array([137, 80, 78, 71]),
  })).rejects.toThrow('TARGET_EXISTS');
  expect(writes).toEqual([]);
});

it('publishes atomically and removes the temporary artifact when publishing fails', async () => {
  const writes: string[] = [];
  const removed: string[] = [];
  await expect(exportProjectDesign({
    revisionId: 'revision-1', format: 'png', targetPath: '/exports/poster.png',
    target: {
      exists: async () => false,
      write: async (path: string) => { writes.push(path); },
      rename: async () => { throw new Error('DISK_FULL'); },
      remove: async (path: string) => { removed.push(path); },
    },
    render: async () => new Uint8Array([137, 80, 78, 71]),
  })).rejects.toThrow('DISK_FULL');
  expect(writes).toEqual(['/exports/poster.png.tmp']);
  expect(removed).toEqual(['/exports/poster.png.tmp']);
});

it('rejects an encoded image whose dimensions do not match the requested export', async () => {
  await expect(exportProjectDesign({
    revisionId: 'revision-1', format: 'png', targetPath: '/exports/poster.png',
    target: { exists: async () => false, write: async () => undefined },
    render: async () => new Uint8Array([137, 80, 78, 71]),
    codec: {
      inspect: async () => ({ format: 'png', width: 2, height: 1, hasAlpha: false }),
      encode: async () => new Uint8Array(),
      toPdf: async () => new Uint8Array(),
    },
    expectedSize: { width: 3, height: 1 },
  })).rejects.toThrow('INVALID_SIZE');
});

it('rejects an encoded image with a non-sRGB color space', async () => {
  await expect(exportProjectDesign({
    revisionId: 'revision-color', format: 'png', targetPath: '/exports/color.png',
    target: { exists: async () => false, write: async () => undefined },
    render: async () => new Uint8Array([137, 80, 78, 71]),
    codec: {
      inspect: async () => ({ format: 'png', width: 1, height: 1, hasAlpha: false, colorSpace: 'display-p3' }),
      encode: async () => new Uint8Array(),
      toPdf: async () => new Uint8Array(),
    },
  })).rejects.toThrow('INVALID_COLOR_SPACE');
});

it('encodes a rendered PNG into the requested JPEG before writing', async () => {
  const source = new Uint8Array(await sharp({ create: { width: 2, height: 1, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer());
  let written: number[] = [];
  const result = await exportProjectDesign({
    revisionId: 'revision-1', format: 'jpeg', targetPath: '/exports/poster.jpg',
    target: { exists: async () => false, write: async (_path, bytes) => { written = [...bytes]; } },
    render: async () => source,
    codec: createNodeCodec(),
    background: '#ffffff',
  });
  expect(result.path).toBe('/exports/poster.jpg');
  expect(written[0]).toBe(0xff);
  expect(written[1]).toBe(0xd8);
});

it('keeps the external export when an optional archive copy fails', async () => {
  const result = await exportProjectDesign({
    revisionId: 'revision-archive',
    format: 'png',
    targetPath: '/exports/poster.png',
    target: { exists: async () => false, write: async () => undefined },
    render: async () => new Uint8Array([137, 80, 78, 71]),
    archiveCopy: async () => { throw new Error('TARGET_EXISTS'); },
  });
  expect(result).toMatchObject({ revisionId: 'revision-archive', path: '/exports/poster.png', archived: false, archiveError: 'TARGET_EXISTS' });
});
