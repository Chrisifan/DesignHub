import { expect, it } from 'vitest';

import { convertExternalReference, importAssets } from './import-assets';

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

it('rejects unsafe metadata and mismatched declared formats per item', async () => {
  const results = await importAssets([
    { name: 'ok.png', mimeType: 'image/png', data: bytes('png') },
    { name: 'wrong.png', mimeType: 'image/jpeg', data: bytes('jpeg') },
    { name: 'unsafe.png', mimeType: 'image/png', data: bytes('png'), metadata: { label: '\u0000hidden' } },
  ]);

  expect(results[0]?.status).toBe('success');
  expect(results[1]).toMatchObject({ status: 'error', error: 'UNSUPPORTED_FORMAT' });
  expect(results[2]).toMatchObject({ status: 'error', error: 'INVALID_METADATA' });
});

it('converts an external reference into a managed asset while preserving bytes', async () => {
  const external = await importAssets([{
    name: 'remote.svg',
    mimeType: 'image/svg+xml',
    externalReference: 'https://example.com/remote.svg',
  }]);
  const asset = external[0];
  if (asset.status === 'error') throw new Error(asset.error);

  const converted = await convertExternalReference(asset.asset, bytes('<svg />'));

  expect(converted.managed).toBe(true);
  expect(converted.externalReference).toBeUndefined();
  expect(converted.originalBytes).toEqual(bytes('<svg />'));
});
