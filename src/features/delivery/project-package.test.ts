// @vitest-environment node

import { expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { createProjectPackage, decodeProjectPackage, encodeProjectPackage, importProjectPackage } from './project-package';

it('creates an importable project package with manifest and source closure', async () => {
  const pack = await createProjectPackage({
    packageId: 'pkg-1', projectId: 'project-1', entries: [{ path: 'poster.png', bytes: new Uint8Array([1, 2, 3]), kind: 'output' }],
  });
  const imported = await importProjectPackage(pack, { existingProjectIds: [] });
  expect(imported.projectId).not.toBe('');
  expect(imported.entries).toEqual(['poster.png']);
});

it('does not overwrite a project with a duplicate package id', async () => {
  const pack = await createProjectPackage({ packageId: 'pkg-1', projectId: 'project-1', entries: [] });
  await expect(importProjectPackage(pack, { existingProjectIds: ['project-1'] })).rejects.toThrow('PROJECT_EXISTS');
});

it('round-trips a project package as a validated ZIP archive', async () => {
  const pack = await createProjectPackage({
    packageId: 'pkg-zip', projectId: 'project-zip', readOnly: true, entries: [
      { path: 'manifest.json', kind: 'manifest', bytes: new TextEncoder().encode('{"ok":true}') },
      { path: 'outputs/poster.png', kind: 'output', bytes: new Uint8Array([1, 2, 3]) },
      { path: 'conversation.json', kind: 'conversation', bytes: new Uint8Array([9]) },
    ],
  });
  const encoded = await encodeProjectPackage(pack);
  const decoded = await decodeProjectPackage(encoded);
  expect(decoded.manifest).toEqual(pack.manifest);
  expect(Array.from(decoded.files['outputs/poster.png'])).toEqual([1, 2, 3]);
  expect(decoded.files['conversation.json']).toBeUndefined();
});

it('rejects ZIP entries that are not declared in the package manifest', async () => {
  const encoded = zipSync({
    'designhub.package.json': new TextEncoder().encode(JSON.stringify({ packageId: 'pkg-invalid', projectId: 'project-invalid', readOnly: false, entries: ['declared.txt'] })),
    'declared.txt': new Uint8Array([1]),
    'extra.txt': new Uint8Array([2]),
  });
  await expect(decodeProjectPackage(encoded)).rejects.toThrow('INVALID_PACKAGE');
});
