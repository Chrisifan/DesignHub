import { expect, it } from 'vitest';

import { importAssets } from '../../src/features/assets/import-assets';

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

it('returns one outcome per item and preserves valid imports when another item fails', async () => {
  const saved: Array<{ bytes: Uint8Array; metadata: unknown }> = [];
  const results = await importAssets([
    { name: 'logo.svg', mimeType: 'image/svg+xml', data: bytes('<svg />') },
    { name: '../unsafe.svg', mimeType: 'image/svg+xml', data: bytes('<svg />') },
  ], {
    saveOriginal: async (original, metadata) => { saved.push({ bytes: original, metadata }); },
    decode: async () => ({ width: 640, height: 240, animated: false }),
  });

  expect(results).toHaveLength(2);
  expect(results[0].status).toBe('success');
  if (results[0].status !== 'success') throw new Error('expected successful import');
  expect(results[0].asset.originalBytes).toEqual(bytes('<svg />'));
  expect(results[0].asset.decode).toEqual({ width: 640, height: 240, animated: false });
  expect(saved[0].bytes).toEqual(bytes('<svg />'));
  expect(results[1]).toMatchObject({ status: 'error', error: 'UNSAFE_PATH' });
});

it('deduplicates identical content and marks external references until converted', async () => {
  const first = await importAssets([
    { name: 'one.svg', mimeType: 'image/svg+xml', data: bytes('<svg />') },
  ]);
  const second = await importAssets([
    { name: 'renamed.svg', mimeType: 'image/svg+xml', data: bytes('<svg />') },
    { name: 'remote.svg', mimeType: 'image/svg+xml', externalReference: 'https://example.com/remote.svg' },
  ], { existingAssets: first.flatMap((result) => result.status === 'success' ? [result.asset] : []) });

  expect(second[0].status).toBe('success');
  if (first[0].status !== 'success' || second[0].status !== 'success') throw new Error('expected successful imports');
  expect(second[0].asset.id).toBe(first[0].asset.id);
  expect(second[1]).toMatchObject({ status: 'success', external: true });
  if (second[1].status !== 'success') throw new Error('expected external marker');
  expect(second[1].asset.managed).toBe(false);
});
