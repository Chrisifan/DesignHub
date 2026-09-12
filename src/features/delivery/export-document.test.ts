import { expect, it } from 'vitest';
import { exportDocument } from './export-document';

it('exports the requested revision through a temporary file and records its hash', async () => {
  const writes: string[] = [];
  const target = {
    exists: async () => false,
    write: async (path: string) => { writes.push(path); },
  };
  const result = await exportDocument({
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
  await expect(exportDocument({
    revisionId: 'revision-1', format: 'png', targetPath: '/exports/poster.png',
    target: { exists: async () => true, write: async () => undefined },
    render: async () => new Uint8Array([137, 80, 78, 71]),
  })).rejects.toThrow('TARGET_EXISTS');
});
