import { expect, it } from 'vitest';
import { createProjectPackage } from '../../src/features/delivery/project-package';

it('excludes credentials and conversations from a read-only delivery package', async () => {
  const pack = await createProjectPackage({
    packageId: 'pkg-2', projectId: 'project-2', readOnly: true,
    entries: [
      { path: 'poster.png', bytes: new Uint8Array([1]), kind: 'output' },
      { path: 'conversation.json', bytes: new Uint8Array([2]), kind: 'conversation' },
      { path: 'key.txt', bytes: new Uint8Array([3]), kind: 'credential' },
    ],
  });
  expect(pack.manifest.entries).toEqual(['poster.png']);
});
