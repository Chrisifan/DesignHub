import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { initializeProjectLibrary, openProjectLibrary } from '../../src/desktop/storage/project-library-store';

export type TemporaryProjectLibrary = {
  directory: string;
  workspace: Awaited<ReturnType<typeof initializeProjectLibrary>>;
  cleanup: () => Promise<void>;
};

/** Creates an isolated real project library for integration tests. */
export const createTemporaryProjectLibrary = async (prefix = 'designhub-library-'): Promise<TemporaryProjectLibrary> => {
  const parentDirectory = await mkdtemp(join(tmpdir(), prefix));
  const workspace = await initializeProjectLibrary(parentDirectory);
  let closed = false;
  return {
    directory: parentDirectory,
    workspace,
    cleanup: async () => {
      if (closed) return;
      closed = true;
      workspace.close();
      await rm(parentDirectory, { recursive: true, force: true });
    },
  };
};

export const reopenProjectLibrary = async (directory: string) => openProjectLibrary(directory);
