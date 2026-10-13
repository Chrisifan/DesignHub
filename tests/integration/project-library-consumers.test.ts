// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';

import { initializeProjectLibrary, openProjectLibrary } from '../../src/desktop/storage/project-library-store';
import { createProjectStore } from '../../src/desktop/storage/project-store';
import { loadTaskState, saveTaskState } from '../../src/desktop/storage/task-store';
import type { TaskRecord } from '../../src/features/tasks/state';

const temporaryDirectories: string[] = [];

const createTemporaryLibrary = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-project-library-consumers-'));
  temporaryDirectories.push(directory);
  return initializeProjectLibrary(directory);
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

it('stores isolated projects and shared task history and trash in one library', async () => {
  const library = await createTemporaryLibrary();
  const libraryId = library.library.libraryId;
  const projects = createProjectStore(library);
  const task: TaskRecord = {
    id: 'task-project-one',
    requestId: 'request-project-one',
    state: 'completed',
    cancelRequested: false,
    attempt: 1,
    source: { kind: 'project', id: 'project-one' },
    providerId: 'provider-1',
    capability: 'conversation',
  };
  let secondProjectId = '';

  try {
    const first = await projects.createProjectContainer({ libraryId: libraryId, operationId: 'create-one', name: 'Project One' });
    const second = await projects.createProjectContainer({ libraryId: libraryId, operationId: 'create-two', name: 'Project Two' });
    secondProjectId = second.projectId;
    expect(first.projectId).not.toBe(second.projectId);
    await expect(projects.getProjectMetadata(first.projectId)).resolves.toMatchObject({ name: 'Project One' });
    await expect(projects.getProjectMetadata(second.projectId)).resolves.toMatchObject({ name: 'Project Two' });

    await saveTaskState(library, libraryId, [task]);
    await projects.moveProjectToTrash({ libraryId: libraryId, projectId: first.projectId });
    await expect(projects.listTrashedProjects()).resolves.toHaveLength(1);
    await expect(projects.listActiveProjects()).resolves.toHaveLength(1);
  } finally {
    library.close();
  }

  const reopened = await openProjectLibrary(library.library.directory);
  try {
    const store = createProjectStore(reopened);
    const activeProjects = await store.listActiveProjects();
    expect(activeProjects.map((project) => project.projectId)).toEqual([secondProjectId]);
    await expect(loadTaskState(reopened, libraryId)).resolves.toEqual([task]);
    await expect(store.listTrashedProjects()).resolves.toHaveLength(1);
    await expect(store.getProjectMetadata(activeProjects[0]!.projectId)).resolves.toMatchObject({ name: 'Project Two' });
  } finally {
    reopened.close();
  }
});

it('migrates legacy document-bound task records when loading task history', async () => {
  const library = await createTemporaryLibrary();
  const libraryId = library.library.libraryId;
  const tasksPath = join(library.library.directory, '.designhub', 'tasks.json');
  const legacyTask = {
    id: 'legacy-task',
    requestId: 'legacy-request',
    documentId: 'legacy-document',
    state: 'completed',
    cancelRequested: false,
    attempt: 1,
    source: { kind: 'project', id: 'project-one' },
    capability: 'conversation',
    designContext: {
      version: 1,
      workspaceId: libraryId,
      projectId: 'project-one',
      documentId: 'legacy-document',
      brief: 'Legacy brief',
      document: { width: 1080, height: 1440, currentImageAssetIds: ['asset-current'] },
      attachmentAssetIds: ['asset-reference'],
      userMessage: 'Legacy request',
      baseRevisionId: null,
    },
  };
  await writeFile(tasksPath, `${JSON.stringify([legacyTask])}\n`, 'utf8');

  try {
    await expect(loadTaskState(library, libraryId)).resolves.toEqual([expect.objectContaining({
      id: 'legacy-task',
      designContext: {
        version: 1,
        libraryId,
        projectId: 'project-one',
        brief: 'Legacy brief',
        canvas: { width: 1080, height: 1440, currentImageAssetIds: ['asset-current'] },
        attachmentAssetIds: ['asset-reference'],
        userMessage: 'Legacy request',
        baseRevisionId: null,
      },
    })]);
    const loaded = await loadTaskState(library, libraryId);
    expect(loaded[0]).not.toHaveProperty('documentId');
    expect(loaded[0]?.designContext).not.toHaveProperty('documentId');
  } finally {
    library.close();
  }
});

it('loads historical no-op expand tasks without allowing them as new submissions', async () => {
  const library = await createTemporaryLibrary();
  const libraryId = library.library.libraryId;
  const tasksPath = join(library.library.directory, '.designhub', 'tasks.json');
  const legacyTask = {
    id: 'legacy-expand-task',
    requestId: 'legacy-expand-request',
    requestText: 'Expand the image',
    state: 'failed',
    cancelRequested: false,
    attempt: 1,
    source: { kind: 'project', id: 'project-one' },
    sourceAssetId: 'asset-source',
    capability: 'image-editing',
    providerId: 'openai-compatible',
    tool: 'expand',
    toolParams: { mode: 'original-scene', top: 0, right: 0, bottom: 0, left: 0 },
    errorCode: 'RESULT_DIMENSIONS_INVALID',
  };
  await writeFile(tasksPath, `${JSON.stringify([legacyTask])}\n`, 'utf8');

  try {
    await expect(loadTaskState(library, libraryId)).resolves.toEqual([legacyTask]);
  } finally {
    library.close();
  }
});
