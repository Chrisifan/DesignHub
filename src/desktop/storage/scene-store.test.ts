// @vitest-environment node

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createScene, type DesignScene } from '../../features/canvas/scene';
import { createProjectStore } from './project-store';
import { sceneFileName, loadDocumentScene, saveDocumentScene } from './scene-store';
import { initializeProjectLibrary, openProjectLibrary } from './project-library-store';

const temporaryDirectories: string[] = [];

const createTemporaryWorkspace = async () => {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'designhub-scene-store-'));
  temporaryDirectories.push(parentDirectory);
  return initializeProjectLibrary(parentDirectory);
};

const createProject = async (workspace: Awaited<ReturnType<typeof createTemporaryWorkspace>>) => {
  const result = await createProjectStore(workspace).createProjectContainer({
    workspaceId: workspace.library.libraryId,
    operationId: 'scene-project',
    name: 'Scene project',
  });
  return result.projectId;
};

const scene: DesignScene = createScene({ id: 'scene-1', width: 1080, height: 1440, layers: [] });

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('persists and reloads a validated document scene across workspace reopen', async () => {
  const workspace = await createTemporaryWorkspace();
  const projectId = await createProject(workspace);

  await expect(saveDocumentScene(workspace, workspace.library.libraryId, projectId, 'doc-1', scene)).resolves.toBe(true);
  const path = join(workspace.library.directory, 'projects', projectId, 'documents', sceneFileName('doc-1'));
  expect(existsSync(path)).toBe(true);
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(scene);
  workspace.close();

  const reopened = await openProjectLibrary(workspace.library.directory);
  try {
    await expect(loadDocumentScene(reopened, reopened.library.libraryId, projectId, 'doc-1')).resolves.toEqual(scene);
  } finally {
    reopened.close();
  }
});

it('does not expose malformed scenes and refuses writes in read-only or invalid targets', async () => {
  const workspace = await createTemporaryWorkspace();
  const projectId = await createProject(workspace);
  await saveDocumentScene(workspace, workspace.library.libraryId, projectId, 'doc-1', scene);
  const path = join(workspace.library.directory, 'projects', projectId, 'documents', sceneFileName('doc-1'));
  await writeFile(path, '{bad json', 'utf8');
  await expect(loadDocumentScene(workspace, workspace.library.libraryId, projectId, 'doc-1')).resolves.toBeNull();
  expect(() => sceneFileName('../escape')).toThrow('INVALID_DOCUMENT_ID');
  await expect(saveDocumentScene(workspace, workspace.library.libraryId, projectId, '../escape', scene)).rejects.toThrow('INVALID_DOCUMENT_ID');
  await expect(loadDocumentScene(workspace, workspace.library.libraryId, '00000000-0000-4000-8000-000000000000', 'doc-1')).resolves.toBeNull();

  const reopened = await openProjectLibrary(workspace.library.directory);
  try {
    await expect(saveDocumentScene(reopened, reopened.library.libraryId, projectId, 'doc-1', scene)).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
  } finally {
    reopened.close();
  }
});
