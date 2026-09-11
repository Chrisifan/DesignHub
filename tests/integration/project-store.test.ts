// @vitest-environment node

import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';

import { createProjectStore, projectContentManifestName, projectDatabaseName, projectManifestName, workspaceProjectIndexName } from '../../src/desktop/storage/project-store';
import { createWorkspace, openWorkspace, workspaceManifestName } from '../../src/desktop/storage/workspace-store';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-project-store-'));
  temporaryDirectories.push(directory);
  return directory;
};

const createWritableStore = async (): Promise<{
  directory: string;
  workspace: Awaited<ReturnType<typeof createWorkspace>>;
  store: ReturnType<typeof createProjectStore>;
}> => {
  const directory = await createTemporaryDirectory();
  const workspace = await createWorkspace({ parentDirectory: directory, name: 'workspace' });
  return { directory, workspace, store: createProjectStore(workspace) };
};

const readIndexedOperation = (indexPath: string, operationId: string): { projectId: string; state: string } => {
  const index = new Database(indexPath, { readonly: true });
  try {
    return index.prepare('SELECT project_id as projectId, state FROM project_operations WHERE operation_id = ?').get(operationId) as { projectId: string; state: string };
  } finally {
    index.close();
  }
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

it('publishes a versioned project database and content manifest exactly once per operation', async () => {
  const { workspace, store } = await createWritableStore();
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'create-1', name: 'Spring campaign' };

  const created = await store.createProjectContainer(input);
  const retried = await store.createProjectContainer(input);
  const projectDirectory = join(workspace.workspace.directory, 'projects', created.projectId);
  const projectManifest = JSON.parse(await readFile(join(projectDirectory, projectManifestName), 'utf8')) as Record<string, unknown>;
  const contentManifest = JSON.parse(await readFile(join(projectDirectory, projectContentManifestName), 'utf8')) as Record<string, unknown>;
  const projectDatabase = new Database(join(projectDirectory, projectDatabaseName), { readonly: true });

  try {
    expect(retried).toEqual(created);
    expect(projectManifest).toMatchObject({ kind: 'designhub-project', projectId: created.projectId, name: input.name, formatVersion: 1 });
    expect(contentManifest).toEqual({ formatVersion: 1, projectId: created.projectId, assets: [] });
    expect(projectDatabase.pragma('user_version', { simple: true })).toBe(1);
  } finally {
    projectDatabase.close();
    workspace.close();
  }
});

it('cleans only its temporary content when database initialization or publish fails, then retries without a duplicate', async () => {
  const { workspace } = await createWritableStore();
  let activeWorkspace = workspace;
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'create-fault', name: 'Fault recovery' };
  const projectsDirectory = join(workspace.workspace.directory, 'projects');
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);

  try {
    await expect(createProjectStore(activeWorkspace, { failAt: 'database-write' }).createProjectContainer(input)).rejects.toThrow('INJECTED_DATABASE_WRITE_FAILURE');
    const databaseFailure = readIndexedOperation(indexPath, input.operationId);
    expect(databaseFailure.state).toBe('pending');
    await expect(readdir(projectsDirectory)).resolves.toEqual([]);

    activeWorkspace.close();
    activeWorkspace = await openWorkspace(workspace.workspace.directory);
    await expect(createProjectStore(activeWorkspace, { failAt: 'publish' }).createProjectContainer(input)).rejects.toThrow('INJECTED_PUBLISH_FAILURE');
    expect(readIndexedOperation(indexPath, input.operationId)).toEqual(databaseFailure);
    await expect(readdir(projectsDirectory)).resolves.toEqual([]);

    activeWorkspace.close();
    activeWorkspace = await openWorkspace(workspace.workspace.directory);
    const retried = await createProjectStore(activeWorkspace).createProjectContainer(input);
    expect(retried.projectId).toBe(databaseFailure.projectId);
    expect(existsSync(join(projectsDirectory, retried.projectId))).toBe(true);
    expect(readIndexedOperation(indexPath, input.operationId)).toEqual({ projectId: retried.projectId, state: 'published' });
    await expect(readdir(projectsDirectory)).resolves.toEqual([retried.projectId]);
  } finally {
    activeWorkspace.close();
  }
});

it('recovers a published project after index update failure and rebuilds a corrupt index without losing projects', async () => {
  const { workspace } = await createWritableStore();
  let activeWorkspace = workspace;
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'create-index-fault', name: 'Index recovery' };
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);

  try {
    await expect(createProjectStore(activeWorkspace, { failAt: 'index-update' }).createProjectContainer(input)).rejects.toThrow('INJECTED_INDEX_UPDATE_FAILURE');
    const pending = readIndexedOperation(indexPath, input.operationId);
    expect(pending.state).toBe('pending');
    expect(existsSync(join(workspace.workspace.directory, 'projects', pending.projectId))).toBe(true);

    activeWorkspace.close();
    activeWorkspace = await openWorkspace(workspace.workspace.directory);
    const recovered = await createProjectStore(activeWorkspace).createProjectContainer(input);
    expect(recovered.projectId).toBe(pending.projectId);
    expect(readIndexedOperation(indexPath, input.operationId)).toEqual({ projectId: recovered.projectId, state: 'published' });
    expect(existsSync(join(workspace.workspace.directory, 'projects', recovered.projectId))).toBe(true);

    await writeFile(indexPath, 'not sqlite');
    const second = await createProjectStore(activeWorkspace).createProjectContainer({ ...input, operationId: 'create-after-index-rebuild', name: 'After index rebuild' });
    expect(second.projectId).not.toBe(recovered.projectId);
    expect(existsSync(join(workspace.workspace.directory, 'projects', recovered.projectId))).toBe(true);
    expect(existsSync(join(workspace.workspace.directory, 'projects', second.projectId))).toBe(true);
  } finally {
    activeWorkspace.close();
  }
});

it('gives same display names separate safe directories and rejects invalid workspace relationships', async () => {
  const { directory, workspace, store } = await createWritableStore();

  try {
    const first = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'same-name-1', name: 'Same name' });
    const second = await store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'same-name-2', name: 'Same name' });
    expect(first.projectId).not.toBe(second.projectId);
    expect(existsSync(join(workspace.workspace.directory, 'projects', first.projectId))).toBe(true);
    expect(existsSync(join(workspace.workspace.directory, 'projects', second.projectId))).toBe(true);

    await expect(store.createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'traversal', name: '../escape' })).rejects.toThrow('INVALID_PROJECT_NAME');
    await expect(store.createProjectContainer({ workspaceId: '00000000-0000-4000-8000-000000000000', operationId: 'wrong-id', name: 'Wrong identity' })).rejects.toThrow('WORKSPACE_IDENTITY_MISMATCH');
    await mkdir(join(directory, 'outside'));
    await expect(createProjectStore({ workspace: { ...workspace.workspace, directory: join(directory, 'outside') }, close: workspace.close } as never).createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'wrong-path', name: 'Wrong path' })).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
    await expect(createProjectStore({ workspace: { ...workspace.workspace, openMode: 'read-only' }, close: workspace.close } as never).createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'read-only', name: 'Read only' })).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
  } finally {
    workspace.close();
  }
});

it('rejects a store after its writer handle closes and permits a newly opened writer handle', async () => {
  const { workspace } = await createWritableStore();
  const staleInput = { workspaceId: workspace.workspace.workspaceId, operationId: 'stale-writer', name: 'Stale writer' };

  workspace.close();
  await expect(createProjectStore(workspace).createProjectContainer(staleInput)).rejects.toThrow('WORKSPACE_NOT_WRITABLE');

  const reopened = await openWorkspace(workspace.workspace.directory);
  try {
    await expect(createProjectStore(reopened).createProjectContainer({ ...staleInput, operationId: 'reopened-writer' })).resolves.toMatchObject({ projectId: expect.any(String) });
  } finally {
    reopened.close();
  }
});

it('rejects project writes when the opened workspace path is replaced by another directory', async () => {
  const { directory, workspace, store } = await createWritableStore();
  const originalDirectory = workspace.workspace.directory;
  const movedDirectory = join(directory, 'moved-workspace');
  const replacementDirectory = join(directory, 'replacement-workspace');
  const replacementStaging = join(replacementDirectory, 'projects', '.unrelated-temp');
  const manifest = await readFile(join(originalDirectory, 'designhub.workspace.json'), 'utf8');

  try {
    await rename(originalDirectory, movedDirectory);
    await mkdir(replacementDirectory);
    await Promise.all([
      mkdir(join(replacementDirectory, '.designhub')),
      mkdir(join(replacementDirectory, 'projects')),
      mkdir(join(replacementDirectory, 'shared-assets')),
      mkdir(join(replacementDirectory, 'trash')),
    ]);
    await writeFile(join(replacementDirectory, 'designhub.workspace.json'), manifest);
    await mkdir(replacementStaging);
    await symlink(replacementDirectory, originalDirectory, 'dir');

    await expect(store.createProjectContainer({
      workspaceId: workspace.workspace.workspaceId,
      operationId: 'replaced-path',
      name: 'Replaced path',
    })).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
    await expect(readdir(join(replacementDirectory, 'projects'))).resolves.toEqual(['.unrelated-temp']);
    expect(existsSync(join(replacementDirectory, '.designhub', workspaceProjectIndexName))).toBe(false);
  } finally {
    workspace.close();
  }
});

it('rejects project writes when the opened workspace path is replaced by a new real directory', async () => {
  const { directory, workspace, store } = await createWritableStore();
  const originalDirectory = workspace.workspace.directory;
  const movedDirectory = join(directory, 'moved-real-workspace');
  const replacementStaging = join(originalDirectory, 'projects', '.unrelated-temp');
  const manifestPath = join(originalDirectory, workspaceManifestName);
  const manifest = await readFile(manifestPath, 'utf8');

  try {
    await rename(originalDirectory, movedDirectory);
    await mkdir(originalDirectory);
    await Promise.all([
      mkdir(join(originalDirectory, '.designhub')),
      cp(join(movedDirectory, 'projects'), join(originalDirectory, 'projects'), { recursive: true }),
      cp(join(movedDirectory, 'shared-assets'), join(originalDirectory, 'shared-assets'), { recursive: true }),
      cp(join(movedDirectory, 'trash'), join(originalDirectory, 'trash'), { recursive: true }),
    ]);
    await writeFile(manifestPath, manifest);
    await mkdir(replacementStaging);

    await expect(store.createProjectContainer({
      workspaceId: workspace.workspace.workspaceId,
      operationId: 'replaced-real-path',
      name: 'Replaced real path',
    })).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
    await expect(readdir(join(originalDirectory, 'projects'))).resolves.toEqual(['.unrelated-temp']);
    expect(existsSync(join(originalDirectory, '.designhub', workspaceProjectIndexName))).toBe(false);
  } finally {
    workspace.close();
  }
});

it('reconciles missing and valid empty indexes from published manifests before retrying an operation', async () => {
  const { workspace, store } = await createWritableStore();
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'reconcile-index', name: 'Reconcile index' };
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);

  try {
    const created = await store.createProjectContainer(input);
    workspace.close();
    await unlink(indexPath);
    const reopened = await openWorkspace(workspace.workspace.directory);
    const retriedAfterMissingIndex = await createProjectStore(reopened).createProjectContainer(input);
    expect(retriedAfterMissingIndex).toEqual(created);
    reopened.close();

    const emptyIndex = new Database(indexPath);
    emptyIndex.close();
    const reopenedAgain = await openWorkspace(workspace.workspace.directory);
    try {
      await expect(createProjectStore(reopenedAgain).createProjectContainer(input)).resolves.toEqual(created);
      const rebuiltIndex = new Database(indexPath, { readonly: true });
      try {
        expect(rebuiltIndex.prepare('SELECT state FROM project_operations WHERE operation_id = ?').get(input.operationId)).toEqual({ state: 'published' });
        expect(rebuiltIndex.prepare('SELECT display_name FROM projects WHERE project_id = ?').get(created.projectId)).toEqual({ display_name: input.name });
      } finally {
        rebuiltIndex.close();
      }
    } finally {
      reopenedAgain.close();
    }
  } finally {
    workspace.close();
  }
});

it('rebuilds corrupt indexes around junk without changing published metadata or deleting unrelated staging', async () => {
  const { workspace } = await createWritableStore();
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'published-metadata', name: 'Published name' };
  const projectsDirectory = join(workspace.workspace.directory, 'projects');
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);
  const crashStaging = join(projectsDirectory, '.00000000-0000-4000-8000-000000000000.creating-10000000-0000-4000-8000-000000000000');
  const unrelatedStaging = join(projectsDirectory, '.unrelated-temp');
  const invalidProjectId = randomUUID();
  const invalidProjectDirectory = join(projectsDirectory, invalidProjectId);

  try {
    await expect(createProjectStore(workspace, { failAt: 'index-update' }).createProjectContainer(input)).rejects.toThrow('INJECTED_INDEX_UPDATE_FAILURE');
    await mkdir(join(projectsDirectory, 'junk-directory'));
    await mkdir(crashStaging);
    await mkdir(unrelatedStaging);
    await mkdir(invalidProjectDirectory);
    await writeFile(join(invalidProjectDirectory, projectManifestName), `${JSON.stringify({
      kind: 'designhub-project',
      projectId: invalidProjectId,
      operationId: 'invalid-project',
      name: 'Invalid project',
      formatVersion: 1,
      createdAt: new Date().toISOString(),
    })}\n`);
    await writeFile(join(invalidProjectDirectory, projectDatabaseName), 'not sqlite');
    await writeFile(join(invalidProjectDirectory, projectContentManifestName), `${JSON.stringify({ formatVersion: 1, projectId: invalidProjectId, assets: [] })}\n`);
    await writeFile(indexPath, 'not sqlite');
    workspace.close();

    const reopened = await openWorkspace(workspace.workspace.directory);
    try {
      const retried = await createProjectStore(reopened).createProjectContainer({ ...input, name: 'Changed retry name' });
      const manifest = JSON.parse(await readFile(join(projectsDirectory, retried.projectId, projectManifestName), 'utf8')) as Record<string, unknown>;
      expect(manifest.name).toBe(input.name);
      expect(existsSync(crashStaging)).toBe(false);
      expect(existsSync(unrelatedStaging)).toBe(true);
      const index = new Database(indexPath, { readonly: true });
      try {
        expect(index.prepare('SELECT display_name FROM projects WHERE project_id = ?').get(retried.projectId)).toEqual({ display_name: input.name });
        expect(index.prepare('SELECT project_id FROM projects WHERE project_id = ?').get(invalidProjectId)).toBeUndefined();
      } finally {
        index.close();
      }
      expect((await readdir(join(workspace.workspace.directory, '.designhub'))).some((name) => name.startsWith(`${workspaceProjectIndexName}.corrupt-`))).toBe(true);
    } finally {
      reopened.close();
    }
  } finally {
    workspace.close();
  }
});

it('does not reuse a published project when its manifest belongs to another operation', async () => {
  const { workspace, store } = await createWritableStore();
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'manifest-operation', name: 'Manifest operation' };
  try {
    const created = await store.createProjectContainer(input);
    const manifestPath = join(workspace.workspace.directory, 'projects', created.projectId, projectManifestName);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, operationId: 'different-operation' }, null, 2)}\n`);

    await expect(store.createProjectContainer(input)).rejects.toThrow('INDEX_MANIFEST_CONFLICT');
  } finally {
    workspace.close();
  }
});

it('rejects published retries with an invalid project database or content manifest', async () => {
  const { workspace, store } = await createWritableStore();
  const databaseInput = { workspaceId: workspace.workspace.workspaceId, operationId: 'invalid-published-database', name: 'Invalid database' };
  const contentInput = { workspaceId: workspace.workspace.workspaceId, operationId: 'invalid-published-content', name: 'Invalid content' };
  try {
    const databaseProject = await store.createProjectContainer(databaseInput);
    const contentProject = await store.createProjectContainer(contentInput);
    const projectsDirectory = join(workspace.workspace.directory, 'projects');
    await writeFile(join(projectsDirectory, databaseProject.projectId, projectDatabaseName), 'not sqlite');
    await writeFile(join(projectsDirectory, contentProject.projectId, projectContentManifestName), `${JSON.stringify({ formatVersion: 1, projectId: databaseProject.projectId, assets: [] })}\n`);

    await expect(store.createProjectContainer(databaseInput)).rejects.toThrow('PUBLISHED_PROJECT_MISSING');
    await expect(store.createProjectContainer(contentInput)).rejects.toThrow('PUBLISHED_PROJECT_MISSING');
  } finally {
    workspace.close();
  }
});

it('rejects a published operation whose index directory is not its UUID directory', async () => {
  const { workspace, store } = await createWritableStore();
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'unsafe-directory', name: 'Unsafe directory' };
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);
  try {
    await expect(createProjectStore(workspace, { failAt: 'database-write' }).createProjectContainer(input)).rejects.toThrow('INJECTED_DATABASE_WRITE_FAILURE');
    const index = new Database(indexPath);
    try {
      index.prepare('UPDATE project_operations SET directory_name = ? WHERE operation_id = ?').run('../outside', input.operationId);
    } finally {
      index.close();
    }

    await expect(store.createProjectContainer(input)).rejects.toThrow('INVALID_PROJECT_INDEX');
  } finally {
    workspace.close();
  }
});

it('propagates a locked index without replacing it as corruption', async () => {
  const { workspace, store } = await createWritableStore();
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'locked-index', name: 'Locked index' };

  try {
    await store.createProjectContainer(input);
    const lockedIndex = new Database(indexPath, { fileMustExist: true, timeout: 0 });
    lockedIndex.pragma('journal_mode = DELETE');
    lockedIndex.pragma('locking_mode = EXCLUSIVE');
    lockedIndex.exec('BEGIN EXCLUSIVE');
    try {
      await expect(createProjectStore(workspace).createProjectContainer({ ...input, operationId: 'blocked-by-lock' })).rejects.toThrow('database is locked');
      expect((await readdir(join(workspace.workspace.directory, '.designhub'))).some((name) => name.startsWith(`${workspaceProjectIndexName}.corrupt-`))).toBe(false);
    } finally {
      lockedIndex.exec('ROLLBACK');
      lockedIndex.close();
    }
  } finally {
    workspace.close();
  }
});

it('propagates a locked published project database while reconciling a missing index', async () => {
  const { workspace, store } = await createWritableStore();
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'locked-project', name: 'Locked project' };
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);
  try {
    const created = await store.createProjectContainer(input);
    await unlink(indexPath);
    const projectDatabase = new Database(join(workspace.workspace.directory, 'projects', created.projectId, projectDatabaseName), { timeout: 0 });
    projectDatabase.pragma('journal_mode = DELETE');
    projectDatabase.pragma('locking_mode = EXCLUSIVE');
    projectDatabase.exec('BEGIN EXCLUSIVE');
    try {
      await expect(store.createProjectContainer(input)).rejects.toThrow('database is locked');
    } finally {
      projectDatabase.exec('ROLLBACK');
      projectDatabase.close();
    }

    await expect(store.createProjectContainer(input)).resolves.toEqual(created);
  } finally {
    workspace.close();
  }
});
