import { expect, it } from 'vitest';
import { exportDocument } from '../../src/features/delivery/export-document';

it('rejects bytes whose magic does not match the requested format', async () => {
  await expect(exportDocument({
    revisionId: 'revision-1', format: 'jpeg', targetPath: '/out.jpg',
    target: { exists: async () => false, write: async () => undefined },
    render: async () => new Uint8Array([137, 80, 78, 71]),
  })).rejects.toThrow('INVALID_OUTPUT');
});
