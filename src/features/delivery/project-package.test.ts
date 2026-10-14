// @vitest-environment node

import { expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { decodeProjectPackage } from './project-package';

it('decodes a project package with a validated manifest', async () => {
  const encoded = zipSync({
    'designhub.package.json': new TextEncoder().encode(JSON.stringify({ packageId: 'pkg-zip', projectId: 'project-zip', readOnly: false, entries: ['manifest.json', 'outputs/poster.png'] })),
    'manifest.json': new TextEncoder().encode('{"ok":true}'),
    'outputs/poster.png': new Uint8Array([1, 2, 3]),
  });
  const decoded = await decodeProjectPackage(encoded);
  expect(decoded.manifest).toEqual({ packageId: 'pkg-zip', projectId: 'project-zip', readOnly: false, entries: ['manifest.json', 'outputs/poster.png'] });
  expect(Array.from(decoded.files['outputs/poster.png'])).toEqual([1, 2, 3]);
});

it('rejects ZIP entries that are not declared in the package manifest', async () => {
  const encoded = zipSync({
    'designhub.package.json': new TextEncoder().encode(JSON.stringify({ packageId: 'pkg-invalid', projectId: 'project-invalid', readOnly: false, entries: ['declared.txt'] })),
    'declared.txt': new Uint8Array([1]),
    'extra.txt': new Uint8Array([2]),
  });
  await expect(decodeProjectPackage(encoded)).rejects.toThrow('INVALID_PACKAGE');
});

it('rejects duplicate paths in package manifests', async () => {
  const encoded = zipSync({
    'designhub.package.json': new TextEncoder().encode(JSON.stringify({ packageId: 'pkg-duplicate', projectId: 'project-duplicate', readOnly: false, entries: ['declared.txt', 'declared.txt'] })),
    'declared.txt': new Uint8Array([1]),
  });
  await expect(decodeProjectPackage(encoded)).rejects.toThrow('INVALID_PACKAGE');
});
