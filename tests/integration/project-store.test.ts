// @vitest-environment node

import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';

import { createProjectStore, projectContentManifestName, projectDatabaseName, projectManifestName, workspaceProjectIndexName } from '../../src/desktop/storage/project-store';
import { createWorkspace } from '../../src/desktop/storage/workspace-store';

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
  return { directory, workspace, store: createProjectStore(workspace.workspace) };
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
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'create-fault', name: 'Fault recovery' };
  const projectsDirectory = join(workspace.workspace.directory, 'projects');

  try {
    await expect(createProjectStore(workspace.workspace, { failAt: 'database-write' }).createProjectContainer(input)).rejects.toThrow('INJECTED_DATABASE_WRITE_FAILURE');
    await expect(createProjectStore(workspace.workspace, { failAt: 'publish' }).createProjectContainer(input)).rejects.toThrow('INJECTED_PUBLISH_FAILURE');
    expect((await readFile(join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName), 'utf8')).length).toBeGreaterThan(0);
    await expect(readdir(projectsDirectory)).resolves.toEqual([]);

    const retried = await createProjectStore(workspace.workspace).createProjectContainer(input);
    expect(existsSync(join(projectsDirectory, retried.projectId))).toBe(true);
  } finally {
    workspace.close();
  }
});

it('recovers a published project after index update failure and rebuilds a corrupt index without losing projects', async () => {
  const { workspace } = await createWritableStore();
  const input = { workspaceId: workspace.workspace.workspaceId, operationId: 'create-index-fault', name: 'Index recovery' };
  const indexPath = join(workspace.workspace.directory, '.designhub', workspaceProjectIndexName);

  try {
    await expect(createProjectStore(workspace.workspace, { failAt: 'index-update' }).createProjectContainer(input)).rejects.toThrow('INJECTED_INDEX_UPDATE_FAILURE');
    const recovered = await createProjectStore(workspace.workspace).createProjectContainer(input);
    expect(existsSync(join(workspace.workspace.directory, 'projects', recovered.projectId))).toBe(true);

    await writeFile(indexPath, 'not sqlite');
    const second = await createProjectStore(workspace.workspace).createProjectContainer({ ...input, operationId: 'create-after-index-rebuild', name: 'After index rebuild' });
    expect(second.projectId).not.toBe(recovered.projectId);
    expect(existsSync(join(workspace.workspace.directory, 'projects', recovered.projectId))).toBe(true);
    expect(existsSync(join(workspace.workspace.directory, 'projects', second.projectId))).toBe(true);
  } finally {
    workspace.close();
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
    await expect(createProjectStore({ ...workspace.workspace, directory: join(directory, 'outside') }).createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'wrong-path', name: 'Wrong path' })).rejects.toThrow('INVALID_WORKSPACE_MANIFEST');
    await expect(createProjectStore({ ...workspace.workspace, openMode: 'read-only' }).createProjectContainer({ workspaceId: workspace.workspace.workspaceId, operationId: 'read-only', name: 'Read only' })).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
  } finally {
    workspace.close();
  }
});
