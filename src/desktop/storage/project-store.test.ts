import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createProjectStore } from './project-store';
import { createWorkspace, openWorkspace } from './workspace-store';

const withWorkspace = async (run: (parentDirectory: string, workspaceDirectory: string) => Promise<void>): Promise<void> => {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'designhub-project-store-'));
  const workspace = await createWorkspace({ parentDirectory, name: 'workspace' });
  const workspaceDirectory = workspace.workspace.directory;
  workspace.close();
  try {
    await run(parentDirectory, workspaceDirectory);
  } finally {
    await rm(parentDirectory, { recursive: true, force: true });
  }
};

it('lists active project metadata after creating a project', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const workspace = await openWorkspace(workspaceDirectory);
    try {
      const store = createProjectStore(workspace);
      expect(await store.listActiveProjects()).toEqual([]);
      const created = await store.createProjectContainer({
        workspaceId: workspace.workspace.workspaceId,
        operationId: 'manual-create-1',
        name: 'Persisted project',
      });
      await expect(store.listActiveProjects()).resolves.toEqual([
        { projectId: created.projectId, name: 'Persisted project' },
      ]);
    } finally {
      workspace.close();
    }
  });
});

it('lists projects again after reopening the workspace', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const first = await openWorkspace(workspaceDirectory);
    const projectId = (await createProjectStore(first).createProjectContainer({
      workspaceId: first.workspace.workspaceId,
      operationId: 'manual-create-reload',
      name: 'Reload me',
    })).projectId;
    first.close();

    const reopened = await openWorkspace(workspaceDirectory);
    try {
      await expect(createProjectStore(reopened).listActiveProjects()).resolves.toEqual([
        { projectId, name: 'Reload me' },
      ]);
    } finally {
      reopened.close();
    }
  });
});
