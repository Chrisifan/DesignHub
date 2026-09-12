import { expect, it } from 'vitest';
import { createProjectPackage, importProjectPackage } from './project-package';

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
