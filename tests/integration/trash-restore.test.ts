// @vitest-environment node

import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createProjectStore, projectManifestName, workspaceProjectIndexName } from '../../src/desktop/storage/project-store';
import { createWorkspace, openWorkspace } from '../../src/desktop/storage/workspace-store';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-trash-store-'));
  temporaryDirectories.push(directory);
  return directory;
};

const createWritableStore = async () => {
  const directory = await createTemporaryDirectory();
  const workspace = await createWorkspace({ parentDirectory: directory, name: 'workspace' });
  return { directory, workspace, store: createProjectStore(workspace) };
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

it('retains project identity, original location, and deletion time across reopen and restore', async () => {
  const { workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'trash-reopen', name: 'Trash reopen' });
  const originalRelativePath = `projects/${created.projectId}`;
  const originalPath = join(workspace.workspace.directory, originalRelativePath);
  const manifestBeforeTrash = await readFile(join(originalPath, projectManifestName), 'utf8');

  try {
    const trashed = await store.moveProjectToTrash({ workspaceId: workspace.workspace.workspaceId, projectId: created.projectId });
    expect(trashed).toMatchObject({ projectId: created.projectId, originalRelativePath, deletedAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(trashed.deletedAt))).toBe(false);
    expect(existsSync(originalPath)).toBe(false);

    workspace.close();
    const reopened = await openWorkspace(workspace.workspace.directory);
    try {
      const reopenedStore = createProjectStore(reopened);
      await expect(reopenedStore.listTrashedProjects()).resolves.toEqual([trashed]);
      await expect(reopenedStore.restoreProjectFromTrash({ workspaceId: reopened.workspace.workspaceId, projectId: created.projectId }))
        .resolves.toEqual({ projectId: created.projectId, restoredRelativePath: originalRelativePath });
      await expect(readFile(join(reopened.workspace.directory, originalRelativePath, projectManifestName), 'utf8')).resolves.toBe(manifestBeforeTrash);
      await expect(reopenedStore.listTrashedProjects()).resolves.toEqual([]);
    } finally {
      reopened.close();
    }
  } finally {
    workspace.close();
  }
});

it('restores conflicts to a managed sibling without overwriting user content', async () => {
  const { workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'trash-conflict', name: 'Trash conflict' });
  const originalRelativePath = `projects/${created.projectId}`;
  const originalPath = join(workspace.workspace.directory, originalRelativePath);

  try {
    await store.moveProjectToTrash({ workspaceId: workspace.workspace.workspaceId, projectId: created.projectId });
    await mkdir(originalPath);
    await writeFile(join(originalPath, 'user-file.txt'), 'keep me');

    const restored = await store.restoreProjectFromTrash({ workspaceId: workspace.workspace.workspaceId, projectId: created.projectId });
    expect(restored).toMatchObject({ projectId: created.projectId });
    expect(restored.restoredRelativePath).not.toBe(originalRelativePath);
    await expect(readFile(join(originalPath, 'user-file.txt'), 'utf8')).resolves.toBe('keep me');
    await expect(readFile(join(workspace.workspace.directory, restored.restoredRelativePath, projectManifestName), 'utf8')).resolves.toContain(created.projectId);
  } finally {
    workspace.close();
  }
});

it('rechecks live references during purge and leaves external source paths untouched', async () => {
  const { directory, workspace } = await createWritableStore();
  let liveReferences = 0;
  const store = createProjectStore(workspace, { getLiveReferenceCount: () => liveReferences });
  const created = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'trash-purge', name: 'Trash purge' });
  const externalSource = join(directory, 'external-draft.psd');

  try {
    await writeFile(externalSource, 'external source stays outside managed trash');
    await store.moveProjectToTrash({ workspaceId: workspace.workspace.workspaceId, projectId: created.projectId });
    liveReferences = 1;
    await expect(store.purgeProjectFromTrash({ workspaceId: workspace.workspace.workspaceId, projectId: created.projectId })).rejects.toThrow('PROJECT_HAS_LIVE_REFERENCES');
    await expect(readFile(externalSource, 'utf8')).resolves.toBe('external source stays outside managed trash');

    liveReferences = 0;
    await expect(store.purgeProjectFromTrash({ workspaceId: workspace.workspace.workspaceId, projectId: created.projectId })).resolves.toBeUndefined();
    await expect(store.listTrashedProjects()).resolves.toEqual([]);
    await expect(readFile(externalSource, 'utf8')).resolves.toBe('external source stays outside managed trash');
  } finally {
    workspace.close();
  }
});

it('accepts only the live writable handle and reconciles trashed metadata after index reconstruction', async () => {
  const { directory, workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'trash-reconcile', name: 'Trash reconcile' });
  const input = { workspaceId: workspace.workspace.workspaceId, projectId: created.projectId };
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);

  try {
    await expect(createProjectStore({ workspace: workspace.workspace, close: workspace.close } as never).moveProjectToTrash(input)).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
    await store.moveProjectToTrash(input);
    workspace.close();
    await unlink(indexPath);

    const reopened = await openWorkspace(workspace.workspace.directory);
    try {
      const reopenedStore = createProjectStore(reopened);
      await expect(reopenedStore.listTrashedProjects()).resolves.toMatchObject([{ projectId: created.projectId, originalRelativePath: `projects/${created.projectId}` }]);
      await expect(reopenedStore.restoreProjectFromTrash({ workspaceId: reopened.workspace.workspaceId, projectId: created.projectId })).resolves.toEqual({ projectId: created.projectId, restoredRelativePath: `projects/${created.projectId}` });
      await expect(reopenedStore.moveProjectToTrash(input)).resolves.toMatchObject({ projectId: created.projectId });
    } finally {
      reopened.close();
    }

    await expect(createProjectStore(workspace).listTrashedProjects()).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
    await expect(readFile(join(directory, 'workspace', 'projects', created.projectId, projectManifestName), 'utf8')).rejects.toThrow('ENOENT');
  } finally {
    workspace.close();
  }
});
