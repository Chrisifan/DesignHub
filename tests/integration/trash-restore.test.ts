// @vitest-environment node

import { existsSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { cp, mkdtemp, mkdir, readFile, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';

import { createProjectStore, projectManifestName, workspaceProjectIndexName } from '../../src/desktop/storage/project-store';
import { initializeProjectLibrary, openProjectLibrary } from '../../src/desktop/storage/project-library-store';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-trash-store-'));
  temporaryDirectories.push(directory);
  return directory;
};

const createWritableStore = async () => {
  const directory = await createTemporaryDirectory();
  const workspace = await initializeProjectLibrary(directory);
  return { directory, workspace, store: createProjectStore(workspace) };
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

it('retains project identity, original location, and deletion time across reopen and restore', async () => {
  const { workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'trash-reopen', name: 'Trash reopen' });
  const originalRelativePath = `projects/${created.projectId}`;
  const originalPath = join(workspace.library.directory, originalRelativePath);
  const manifestBeforeTrash = await readFile(join(originalPath, projectManifestName), 'utf8');

  try {
    const trashed = await store.moveProjectToTrash({ workspaceId: workspace.library.libraryId, projectId: created.projectId });
    expect(trashed).toMatchObject({ projectId: created.projectId, originalRelativePath, deletedAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(trashed.deletedAt))).toBe(false);
    expect(existsSync(originalPath)).toBe(false);

    workspace.close();
    const reopened = await openProjectLibrary(workspace.library.directory);
    try {
      const reopenedStore = createProjectStore(reopened);
      await expect(reopenedStore.listTrashedProjects()).resolves.toEqual([trashed]);
      await expect(reopenedStore.restoreProjectFromTrash({ workspaceId: reopened.library.libraryId, projectId: created.projectId }))
        .resolves.toEqual({ projectId: created.projectId, restoredRelativePath: originalRelativePath });
      await expect(readFile(join(reopened.library.directory, originalRelativePath, projectManifestName), 'utf8')).resolves.toBe(manifestBeforeTrash);
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
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'trash-conflict', name: 'Trash conflict' });
  const originalRelativePath = `projects/${created.projectId}`;
  const originalPath = join(workspace.library.directory, originalRelativePath);

  try {
    await store.moveProjectToTrash({ workspaceId: workspace.library.libraryId, projectId: created.projectId });
    await mkdir(originalPath);
    await writeFile(join(originalPath, 'user-file.txt'), 'keep me');

    const restored = await store.restoreProjectFromTrash({ workspaceId: workspace.library.libraryId, projectId: created.projectId });
    expect(restored).toMatchObject({ projectId: created.projectId });
    expect(restored.restoredRelativePath).not.toBe(originalRelativePath);
    await expect(readFile(join(originalPath, 'user-file.txt'), 'utf8')).resolves.toBe('keep me');
    await expect(readFile(join(workspace.library.directory, restored.restoredRelativePath, projectManifestName), 'utf8')).resolves.toContain(created.projectId);
  } finally {
    workspace.close();
  }
});

it('rechecks live references during purge and leaves external source paths untouched', async () => {
  const { directory, workspace } = await createWritableStore();
  let liveReferences = 0;
  const store = createProjectStore(workspace, { getLiveReferenceCount: () => liveReferences });
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'trash-purge', name: 'Trash purge' });
  const externalSource = join(directory, 'external-draft.psd');

  try {
    await writeFile(externalSource, 'external source stays outside managed trash');
    await store.moveProjectToTrash({ workspaceId: workspace.library.libraryId, projectId: created.projectId });
    liveReferences = 1;
    await expect(store.purgeProjectFromTrash({ workspaceId: workspace.library.libraryId, projectId: created.projectId })).rejects.toThrow('PROJECT_HAS_LIVE_REFERENCES');
    await expect(readFile(externalSource, 'utf8')).resolves.toBe('external source stays outside managed trash');

    liveReferences = 0;
    await expect(store.purgeProjectFromTrash({ workspaceId: workspace.library.libraryId, projectId: created.projectId })).resolves.toBeUndefined();
    await expect(store.listTrashedProjects()).resolves.toEqual([]);
    await expect(readFile(externalSource, 'utf8')).resolves.toBe('external source stays outside managed trash');
  } finally {
    workspace.close();
  }
});

it('accepts only the live writable handle and reconciles trashed metadata after index reconstruction', async () => {
  const { directory, workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'trash-reconcile', name: 'Trash reconcile' });
  const input = { workspaceId: workspace.library.libraryId, projectId: created.projectId };
  const indexPath = join(workspace.library.directory, '.designhub', workspaceProjectIndexName);

  try {
    await expect(createProjectStore({ library: workspace.library, close: workspace.close } as never).moveProjectToTrash(input)).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
    await store.moveProjectToTrash(input);
    workspace.close();
    await unlink(indexPath);

    const reopened = await openProjectLibrary(workspace.library.directory);
    try {
      const reopenedStore = createProjectStore(reopened);
      await expect(reopenedStore.listTrashedProjects()).resolves.toMatchObject([{ projectId: created.projectId, originalRelativePath: `projects/${created.projectId}` }]);
      await expect(reopenedStore.restoreProjectFromTrash({ workspaceId: reopened.library.libraryId, projectId: created.projectId })).resolves.toEqual({ projectId: created.projectId, restoredRelativePath: `projects/${created.projectId}` });
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
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'trash-symlink', name: 'Trash symlink' });
  const managedProject = join(workspace.library.directory, 'projects', created.projectId);
  const externalProject = join(directory, 'external-project');

  try {
    await rename(managedProject, externalProject);
    await symlink(externalProject, managedProject);

    await expect(store.moveProjectToTrash({ workspaceId: workspace.library.libraryId, projectId: created.projectId })).rejects.toThrow('UNMANAGED_PROJECT_DIRECTORY');
    expect(existsSync(join(externalProject, '.designhub-trash.json'))).toBe(false);
    await expect(readFile(join(externalProject, projectManifestName), 'utf8')).resolves.toContain(created.projectId);
  } finally {
    workspace.close();
  }
});

it('rejects a symlinked trash container before touching the external project or index', async () => {
  const { directory, workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'restore-symlink', name: 'Restore symlink' });
  const input = { workspaceId: workspace.library.libraryId, projectId: created.projectId };
  const managedTrash = join(workspace.library.directory, 'trash', created.projectId);
  const externalTrash = join(directory, 'external-trash-project');
  const indexPath = join(workspace.library.directory, '.designhub', workspaceProjectIndexName);

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
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'trash-race', name: 'Trash race' });
  const input = { workspaceId: workspace.library.libraryId, projectId: created.projectId };
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

it('rejects a restore destination replaced by an external symlink before copying or deleting trash', async () => {
  const { directory, workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'restore-destination-symlink', name: 'Restore destination symlink' });
  const input = { workspaceId: workspace.library.libraryId, projectId: created.projectId };
  const trashDirectory = join(workspace.library.directory, 'trash', created.projectId);
  const externalDirectory = join(directory, 'external-restore-target');
  let reservedDirectory = '';

  try {
    await mkdir(externalDirectory);
    await writeFile(join(externalDirectory, 'keep.txt'), 'external content stays');
    await store.moveProjectToTrash(input);
    const replacingStore = createProjectStore(workspace, {
      onRestoreDestinationReserved: (directory) => {
        reservedDirectory = directory;
        rmSync(directory, { recursive: true, force: false });
        symlinkSync(externalDirectory, directory, 'dir');
      },
    });

    await expect(replacingStore.restoreProjectFromTrash(input)).rejects.toThrow('UNMANAGED_PROJECT_DIRECTORY');
    await expect(readFile(join(externalDirectory, 'keep.txt'), 'utf8')).resolves.toBe('external content stays');
    expect(existsSync(join(externalDirectory, projectManifestName))).toBe(false);
    expect(existsSync(join(trashDirectory, projectManifestName))).toBe(true);
    await expect(replacingStore.listTrashedProjects()).rejects.toThrow('UNMANAGED_PROJECT_DIRECTORY');

    await unlink(reservedDirectory);
    await expect(store.listTrashedProjects()).resolves.toMatchObject([{ projectId: created.projectId }]);
    await expect(store.restoreProjectFromTrash(input)).resolves.toEqual({
      projectId: created.projectId,
      restoredRelativePath: `projects/${created.projectId}`,
    });
  } finally {
    workspace.close();
  }
});

it('fails closed when reconstruction finds duplicate active project identities', async () => {
  const { workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'trash-duplicate-active', name: 'Trash duplicate active' });
  const projectsDirectory = join(workspace.library.directory, 'projects');
  const duplicateDirectory = join(projectsDirectory, `${created.projectId}-restored-${randomUUID()}`);
  const indexPath = join(workspace.library.directory, '.designhub', workspaceProjectIndexName);

  try {
    await cp(join(projectsDirectory, created.projectId), duplicateDirectory, { recursive: true });
    workspace.close();
    await unlink(indexPath);

    const reopened = await openProjectLibrary(workspace.library.directory);
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
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'trash-duplicate-roots', name: 'Trash duplicate roots' });
  const input = { workspaceId: workspace.library.libraryId, projectId: created.projectId };
  const indexPath = join(workspace.library.directory, '.designhub', workspaceProjectIndexName);

  try {
    await store.moveProjectToTrash(input);
    await cp(join(workspace.library.directory, 'trash', created.projectId), join(workspace.library.directory, 'projects', created.projectId), { recursive: true });
    workspace.close();
    await unlink(indexPath);

    let reopened = await openProjectLibrary(workspace.library.directory);
    try {
      const reopenedStore = createProjectStore(reopened, { getLiveReferenceCount: () => 0 });
      await expect(reopenedStore.purgeProjectFromTrash({ workspaceId: reopened.library.libraryId, projectId: created.projectId })).rejects.toThrow('DUPLICATE_PROJECT_IDENTITY');
      await expect(reopenedStore.listTrashedProjects()).rejects.toThrow('DUPLICATE_PROJECT_IDENTITY');
      reopened.close();
      reopened = await openProjectLibrary(workspace.library.directory);
      await expect(createProjectStore(reopened).listTrashedProjects()).rejects.toThrow('DUPLICATE_PROJECT_IDENTITY');
    } finally {
      reopened.close();
    }
  } finally {
    workspace.close();
  }
});

it.each(['missing', 'malformed'] as const)('fails closed for an active duplicate with %s trash metadata after index loss', async (metadataState) => {
  const { workspace, store } = await createWritableStore();
  const created = await store.createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: `trash-ambiguous-${metadataState}`, name: `Trash ambiguous ${metadataState}` });
  const input = { workspaceId: workspace.library.libraryId, projectId: created.projectId };
  const activeDirectory = join(workspace.library.directory, 'projects', created.projectId);
  const trashDirectory = join(workspace.library.directory, 'trash', created.projectId);
  const indexPath = join(workspace.library.directory, '.designhub', workspaceProjectIndexName);

  try {
    await store.moveProjectToTrash(input);
    await cp(trashDirectory, activeDirectory, { recursive: true });
    if (metadataState === 'missing') {
      await unlink(join(trashDirectory, '.designhub-trash.json'));
    } else {
      await writeFile(join(trashDirectory, '.designhub-trash.json'), '{not-json');
    }
    workspace.close();
    await unlink(indexPath);

    let reopened = await openProjectLibrary(workspace.library.directory);
    try {
      const reopenedStore = createProjectStore(reopened, { getLiveReferenceCount: () => 0 });
      await expect(reopenedStore.listTrashedProjects()).rejects.toThrow('INVALID_TRASH_PROJECT_METADATA');
      await expect(reopenedStore.purgeProjectFromTrash({ workspaceId: reopened.library.libraryId, projectId: created.projectId })).rejects.toThrow('INVALID_TRASH_PROJECT_METADATA');
      expect(existsSync(activeDirectory)).toBe(true);
      expect(existsSync(trashDirectory)).toBe(true);

      reopened.close();
      reopened = await openProjectLibrary(workspace.library.directory);
      await expect(createProjectStore(reopened).listTrashedProjects()).rejects.toThrow('INVALID_TRASH_PROJECT_METADATA');
      expect(existsSync(activeDirectory)).toBe(true);
      expect(existsSync(trashDirectory)).toBe(true);
    } finally {
      reopened.close();
    }
  } finally {
    workspace.close();
  }
});

it('ignores an unrelated invalid directory in the managed trash root', async () => {
  const { workspace } = await createWritableStore();
  const junkDirectory = join(workspace.library.directory, 'trash', randomUUID());

  try {
    await mkdir(junkDirectory);
    await writeFile(join(junkDirectory, projectManifestName), '{not-json');
    workspace.close();

    const reopened = await openProjectLibrary(workspace.library.directory);
    try {
      await expect(createProjectStore(reopened).listTrashedProjects()).resolves.toEqual([]);
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
  const create = async (operationId: string) => createProjectStore(activeWorkspace).createProjectContainer({ workspaceId: activeWorkspace.library.libraryId, operationId, name: operationId });
  const reopen = async () => {
    activeWorkspace.close();
    activeWorkspace = await openProjectLibrary(workspace.library.directory);
    return createProjectStore(activeWorkspace);
  };

  try {
    const beforeRename = await create('gap-before-rename');
    const beforeRenameInput = { workspaceId: activeWorkspace.library.libraryId, projectId: beforeRename.projectId };
    await expect(createProjectStore(activeWorkspace, { failAt: 'trash-after-metadata' }).moveProjectToTrash(beforeRenameInput)).rejects.toThrow('INJECTED_TRASH_AFTER_METADATA');
    let recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).resolves.toEqual([]);
    await expect(recoveredStore.moveProjectToTrash({ workspaceId: activeWorkspace.library.libraryId, projectId: beforeRename.projectId })).resolves.toMatchObject({ projectId: beforeRename.projectId });

    const afterRename = await create('gap-after-rename');
    const afterRenameInput = { workspaceId: activeWorkspace.library.libraryId, projectId: afterRename.projectId };
    await expect(createProjectStore(activeWorkspace, { failAt: 'trash-after-rename' }).moveProjectToTrash(afterRenameInput)).rejects.toThrow('INJECTED_TRASH_AFTER_RENAME');
    recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).resolves.toMatchObject([{ projectId: beforeRename.projectId }, { projectId: afterRename.projectId }]);

    const reservation = await create('gap-restore-reservation');
    const reservationInput = { workspaceId: activeWorkspace.library.libraryId, projectId: reservation.projectId };
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
    activeWorkspace = await openProjectLibrary(workspace.library.directory);
    return createProjectStore(activeWorkspace, { getLiveReferenceCount: () => 0 });
  };

  try {
    const restoreStore = createProjectStore(activeWorkspace);
    const restored = await restoreStore.createProjectContainer({ workspaceId: activeWorkspace.library.libraryId, operationId: 'gap-after-source-delete', name: 'gap-after-source-delete' });
    const restoredInput = { workspaceId: activeWorkspace.library.libraryId, projectId: restored.projectId };
    await restoreStore.moveProjectToTrash(restoredInput);
    await expect(createProjectStore(activeWorkspace, { failAt: 'restore-after-source-delete' }).restoreProjectFromTrash(restoredInput)).rejects.toThrow('INJECTED_RESTORE_AFTER_SOURCE_DELETE');
    let recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).resolves.toEqual([]);
    await expect(recoveredStore.moveProjectToTrash({ workspaceId: activeWorkspace.library.libraryId, projectId: restored.projectId })).resolves.toMatchObject({ projectId: restored.projectId });

    const purged = await recoveredStore.createProjectContainer({ workspaceId: activeWorkspace.library.libraryId, operationId: 'gap-after-purge-delete', name: 'gap-after-purge-delete' });
    const purgedInput = { workspaceId: activeWorkspace.library.libraryId, projectId: purged.projectId };
    await recoveredStore.moveProjectToTrash(purgedInput);
    await expect(createProjectStore(activeWorkspace, { getLiveReferenceCount: () => 0, failAt: 'purge-after-delete' }).purgeProjectFromTrash(purgedInput)).rejects.toThrow('INJECTED_PURGE_AFTER_DELETE');
    recoveredStore = await reopen();
    await expect(recoveredStore.listTrashedProjects()).resolves.toMatchObject([{ projectId: restored.projectId }]);
    expect(existsSync(join(activeWorkspace.library.directory, 'projects', purged.projectId))).toBe(false);
    expect(existsSync(join(activeWorkspace.library.directory, 'trash', purged.projectId))).toBe(false);
  } finally {
    activeWorkspace.close();
  }
});
