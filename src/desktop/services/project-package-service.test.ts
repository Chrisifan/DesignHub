import { describe, expect, it, vi } from 'vitest';
import { createProjectPackageService } from './project-package-service';

const workspace = {
  library: { libraryId: 'library-1', directory: '/tmp/designhub', openMode: 'writable' },
} as never;

describe('project package service', () => {
  it('returns null before reading an archive when import is cancelled', async () => {
    const readArchive = vi.fn();
    const service = createProjectPackageService({
      getWindow: () => ({}) as never,
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
      readArchive,
    });

    await expect(service.importPackage(workspace)).resolves.toBeNull();
    expect(readArchive).not.toHaveBeenCalled();
  });
});
