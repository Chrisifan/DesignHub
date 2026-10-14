import { describe, expect, it, vi } from 'vitest';
import { createProjectPackageService } from './project-package-service';

const workspace = {
  library: { libraryId: 'library-1', directory: '/tmp/designhub', openMode: 'writable' },
} as never;

describe('project package service', () => {
  it('returns null before importing an archive when selection is cancelled', async () => {
    const importArchive = vi.fn();
    const service = createProjectPackageService({
      getWindow: () => ({}) as never,
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
      importArchive,
    });

    await expect(service.importPackage(workspace)).resolves.toBeNull();
    expect(importArchive).not.toHaveBeenCalled();
  });

  it('passes the selected archive path to the streaming importer', async () => {
    const importArchive = vi.fn(async () => ({ projectId: 'project-imported' }));
    const service = createProjectPackageService({
      getWindow: () => ({}) as never,
      showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: ['/tmp/project.designhub.zip'] })),
      importArchive,
    });

    await expect(service.importPackage(workspace)).resolves.toEqual({ projectId: 'project-imported' });
    expect(importArchive).toHaveBeenCalledOnce();
    expect(importArchive).toHaveBeenCalledWith(workspace, expect.objectContaining({
      archivePath: '/tmp/project.designhub.zip',
      libraryId: 'library-1',
      operationId: expect.any(String),
    }));
  });
});
