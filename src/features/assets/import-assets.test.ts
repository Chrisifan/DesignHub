import { expect, it, vi } from 'vitest';

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

it('rejects unknown MIME types and extensions when a format is declared', async () => {
  const results = await importAssets([
    { name: 'image.png', mimeType: 'image/bmp', data: bytes('bmp') },
    { name: 'image.bmp', mimeType: 'image/png', data: bytes('png') },
  ]);

  expect(results).toEqual([
    expect.objectContaining({ status: 'error', error: 'UNSUPPORTED_FORMAT' }),
    expect.objectContaining({ status: 'error', error: 'UNSUPPORTED_FORMAT' }),
  ]);
});

it('does not substitute a weak hash when WebCrypto is unavailable', async () => {
  const originalCrypto = globalThis.crypto;
  vi.stubGlobal('crypto', undefined);
  try {
    const [result] = await importAssets([{ name: 'image.png', mimeType: 'image/png', data: bytes('png') }]);
    expect(result).toMatchObject({ status: 'error', error: 'HASH_UNAVAILABLE' });
  } finally {
    vi.stubGlobal('crypto', originalCrypto);
  }
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

it('reuses a managed asset when converting identical external content', async () => {
  const [managed] = await importAssets([{ name: 'local.svg', mimeType: 'image/svg+xml', data: bytes('<svg />') }]);
  const [external] = await importAssets([{
    name: 'remote.svg',
    mimeType: 'image/svg+xml',
    externalReference: 'https://example.com/remote.svg',
  }]);
  if (managed.status === 'error' || external.status === 'error') throw new Error('expected imports');

  const saveOriginal = vi.fn();
  const converted = await convertExternalReference(external.asset, bytes('<svg />'), {
    existingAssets: [managed.asset],
    saveOriginal,
  });

  expect(converted).toEqual(managed.asset);
  expect(saveOriginal).not.toHaveBeenCalled();
});
