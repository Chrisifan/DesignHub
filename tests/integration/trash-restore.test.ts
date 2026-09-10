// @vitest-environment node

import { existsSync, writeFileSync } from 'node:fs';
import { cp, mkdtemp, mkdir, readFile, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';

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

it('rejects a symlinked active container without touching the external project', async () => {
  const { directory, workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'trash-symlink', name: 'Trash symlink' });
  const managedProject = join(workspace.workspace.directory, 'projects', created.projectId);
  const externalProject = join(directory, 'external-project');

  try {
    await rename(managedProject, externalProject);
    await symlink(externalProject, managedProject);

    await expect(store.moveProjectToTrash({ workspaceId: workspace.workspace.workspaceId, projectId: created.projectId })).rejects.toThrow('UNMANAGED_PROJECT_DIRECTORY');
    expect(existsSync(join(externalProject, '.designhub-trash.json'))).toBe(false);
    await expect(readFile(join(externalProject, projectManifestName), 'utf8')).resolves.toContain(created.projectId);
  } finally {
    workspace.close();
  }
});

it('rejects a symlinked trash container before touching the external project or index', async () => {
  const { directory, workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'restore-symlink', name: 'Restore symlink' });
  const input = { workspaceId: workspace.workspace.workspaceId, projectId: created.projectId };
  const managedTrash = join(workspace.workspace.directory, 'trash', created.projectId);
  const externalTrash = join(directory, 'external-trash-project');
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);

  try {
    await store.moveProjectToTrash(input);
    await rename(managedTrash, externalTrash);
    await symlink(externalTrash, managedTrash);

    await expect(store.restoreProjectFromTrash(input)).rejects.toThrow('UNMANAGED_PROJECT_DIRECTORY');
    await expect(readFile(join(externalTrash, projectManifestName), 'utf8')).resolves.toContain(created.projectId);
    expect(existsSync(join(externalTrash, '.designhub-trash.json'))).toBe(true);

    const index = new Database(indexPath, { readonly: true, fileMustExist: true });
    try {
      expect(index.prepare('SELECT COUNT(*) AS count FROM trash_entries WHERE project_id = ?').get(created.projectId)).toEqual({ count: 1 });
    } finally {
      index.close();
    }
  } finally {
    workspace.close();
  }
});

it('does not overwrite a destination entry created after restore reservation', async () => {
  const { workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'trash-race', name: 'Trash race' });
  const input = { workspaceId: workspace.workspace.workspaceId, projectId: created.projectId };
  let reservedDirectory = '';
  const racingStore = createProjectStore(workspace, {
    onRestoreDestinationReserved: (directory) => {
      reservedDirectory = directory;
      writeFileSync(join(directory, projectManifestName), 'user content wins');
    },
  });

  try {
    await store.moveProjectToTrash(input);
    await expect(racingStore.restoreProjectFromTrash(input)).rejects.toThrow();
    await expect(racingStore.listTrashedProjects()).resolves.toMatchObject([{ projectId: created.projectId }]);
    await expect(readFile(join(reservedDirectory, projectManifestName), 'utf8')).resolves.toBe('user content wins');
    const restored = await store.restoreProjectFromTrash(input);
    expect(restored.projectId).toBe(created.projectId);
    expect(restored.restoredRelativePath).not.toBe(`projects/${created.projectId}`);
  } finally {
    workspace.close();
  }
});

it('fails closed when reconstruction finds duplicate active project identities', async () => {
  const { workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'trash-duplicate-active', name: 'Trash duplicate active' });
  const projectsDirectory = join(workspace.workspace.directory, 'projects');
  const duplicateDirectory = join(projectsDirectory, `${created.projectId}-restored-${randomUUID()}`);
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);

  try {
    await cp(join(projectsDirectory, created.projectId), duplicateDirectory, { recursive: true });
    workspace.close();
    await unlink(indexPath);

    const reopened = await openWorkspace(workspace.workspace.directory);
    try {
      await expect(createProjectStore(reopened).listTrashedProjects()).rejects.toThrow('DUPLICATE_PROJECT_IDENTITY');
    } finally {
      reopened.close();
    }
  } finally {
    workspace.close();
  }
});

it('fails closed instead of purging or reactivating an active and trashed identity collision', async () => {
  const { workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'trash-duplicate-roots', name: 'Trash duplicate roots' });
  const input = { workspaceId: workspace.workspace.workspaceId, projectId: created.projectId };
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);

  try {
    await store.moveProjectToTrash(input);
    await cp(join(workspace.workspace.directory, 'trash', created.projectId), join(workspace.workspace.directory, 'projects', created.projectId), { recursive: true });
    workspace.close();
    await unlink(indexPath);

    let reopened = await openWorkspace(workspace.workspace.directory);
    try {
      const reopenedStore = createProjectStore(reopened, { getLiveReferenceCount: () => 0 });
      await expect(reopenedStore.purgeProjectFromTrash({ workspaceId: reopened.workspace.workspaceId, projectId: created.projectId })).rejects.toThrow('DUPLICATE_PROJECT_IDENTITY');
      await expect(reopenedStore.listTrashedProjects()).rejects.toThrow('DUPLICATE_PROJECT_IDENTITY');
      reopened.close();
      reopened = await openWorkspace(workspace.workspace.directory);
      await expect(createProjectStore(reopened).listTrashedProjects()).rejects.toThrow('DUPLICATE_PROJECT_IDENTITY');
    } finally {
      reopened.close();
    }
  } finally {
    workspace.close();
  }
});

it('recovers or fails closed across injected trash, restore, and purge transition gaps', async () => {
  const { workspace } = await createWritableStore();
  let activeWorkspace = workspace;
  const create = async (operationId: string) => createProjectStore(activeWorkspace).createProjectContainer({ workspaceId: activeWorkspace.workspace.workspaceId, operationId, name: operationId });
  const reopen = async () => {
    activeWorkspace.close();
    activeWorkspace = await openWorkspace(workspace.workspace.directory);
    return createProjectStore(activeWorkspace);
  };

  try {
    const beforeRename = await create('gap-before-rename');
    const beforeRenameInput = { workspaceId: activeWorkspace.workspace.workspaceId, projectId: beforeRename.projectId };
    await expect(createProjectStore(activeWorkspace, { failAt: 'trash-after-metadata' }).moveProjectToTrash(beforeRenameInput)).rejects.toThrow('INJECTED_TRASH_AFTER_METADATA');
    let recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).resolves.toEqual([]);
    await expect(recoveredStore.moveProjectToTrash({ workspaceId: activeWorkspace.workspace.workspaceId, projectId: beforeRename.projectId })).resolves.toMatchObject({ projectId: beforeRename.projectId });

    const afterRename = await create('gap-after-rename');
    const afterRenameInput = { workspaceId: activeWorkspace.workspace.workspaceId, projectId: afterRename.projectId };
    await expect(createProjectStore(activeWorkspace, { failAt: 'trash-after-rename' }).moveProjectToTrash(afterRenameInput)).rejects.toThrow('INJECTED_TRASH_AFTER_RENAME');
    recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).resolves.toMatchObject([{ projectId: beforeRename.projectId }, { projectId: afterRename.projectId }]);

    const reservation = await create('gap-restore-reservation');
    const reservationInput = { workspaceId: activeWorkspace.workspace.workspaceId, projectId: reservation.projectId };
    await recoveredStore.moveProjectToTrash(reservationInput);
    await expect(createProjectStore(activeWorkspace, { failAt: 'restore-after-reservation' }).restoreProjectFromTrash(reservationInput)).rejects.toThrow('INJECTED_RESTORE_AFTER_RESERVATION');
    recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).resolves.toMatchObject([{ projectId: beforeRename.projectId }, { projectId: afterRename.projectId }, { projectId: reservation.projectId }]);

    await expect(createProjectStore(activeWorkspace, { failAt: 'restore-after-copy' }).restoreProjectFromTrash(reservationInput)).rejects.toThrow('INJECTED_RESTORE_AFTER_COPY');
    recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).rejects.toThrow('DUPLICATE_PROJECT_IDENTITY');
  } finally {
    activeWorkspace.close();
  }
});

it('reconciles restore source deletion and purge index-cleanup gaps after restart', async () => {
  const { workspace } = await createWritableStore();
  let activeWorkspace = workspace;
  const reopen = async () => {
    activeWorkspace.close();
    activeWorkspace = await openWorkspace(workspace.workspace.directory);
    return createProjectStore(activeWorkspace, { getLiveReferenceCount: () => 0 });
  };

  try {
    const restoreStore = createProjectStore(activeWorkspace);
    const restored = await restoreStore.createProjectContainer({ workspaceId: activeWorkspace.workspace.workspaceId, operationId: 'gap-after-source-delete', name: 'gap-after-source-delete' });
    const restoredInput = { workspaceId: activeWorkspace.workspace.workspaceId, projectId: restored.projectId };
    await restoreStore.moveProjectToTrash(restoredInput);
    await expect(createProjectStore(activeWorkspace, { failAt: 'restore-after-source-delete' }).restoreProjectFromTrash(restoredInput)).rejects.toThrow('INJECTED_RESTORE_AFTER_SOURCE_DELETE');
    let recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).resolves.toEqual([]);
    await expect(recoveredStore.moveProjectToTrash({ workspaceId: activeWorkspace.workspace.workspaceId, projectId: restored.projectId })).resolves.toMatchObject({ projectId: restored.projectId });

    const purged = await recoveredStore.createProjectContainer({ workspaceId: activeWorkspace.workspace.workspaceId, operationId: 'gap-after-purge-delete', name: 'gap-after-purge-delete' });
    const purgedInput = { workspaceId: activeWorkspace.workspace.workspaceId, projectId: purged.projectId };
    await recoveredStore.moveProjectToTrash(purgedInput);
    await expect(createProjectStore(activeWorkspace, { getLiveReferenceCount: () => 0, failAt: 'purge-after-delete' }).purgeProjectFromTrash(purgedInput)).rejects.toThrow('INJECTED_PURGE_AFTER_DELETE');
    recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).resolves.toMatchObject([{ projectId: restored.projectId }]);
    expect(existsSync(join(activeWorkspace.workspace.directory, 'projects', purged.projectId))).toBe(false);
    expect(existsSync(join(activeWorkspace.workspace.directory, 'trash', purged.projectId))).toBe(false);
  } finally {
    activeWorkspace.close();
  }
});
