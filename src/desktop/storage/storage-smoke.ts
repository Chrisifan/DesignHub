import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createProjectStore } from './project-store';
import { createWorkspace } from './workspace-store';

export const runStorageSmoke = async (resultPath: string): Promise<void> => {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'designhub-storage-smoke-'));
  const workspace = await createWorkspace({ parentDirectory, name: 'workspace' });
  try {
    const result = await createProjectStore(workspace).createProjectContainer({
      workspaceId: workspace.workspace.workspaceId,
      operationId: 'electron-storage-smoke',
      name: 'Electron storage smoke',
    });
    await writeFile(resultPath, `${JSON.stringify(result)}\n`, 'utf8');
  } finally {
    workspace.close();
    await rm(parentDirectory, { recursive: true, force: true });
  }
};
