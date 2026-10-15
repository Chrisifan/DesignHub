// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

it('retains image-tool project design output metadata for retry after restart', async () => {
  const library = await createTemporaryLibrary();
  const libraryId = library.library.libraryId;
  const task: TaskRecord = {
    id: 'task-image-tool',
    requestId: 'request-image-tool',
    requestText: 'Remove the background',
    state: 'failed',
    cancelRequested: false,
    attempt: 1,
    source: { kind: 'project', id: 'project-one' },
    sourceAssetId: 'asset-source',
    sourceDesignId: 'design-source',
    providerId: 'openai-compatible',
    capability: 'image-editing',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
    projectDesignOutput: {
      sourceConversationTaskId: 'conversation-source',
      width: 800,
      height: 600,
      title: 'Background removed',
    },
    errorCode: 'PROVIDER_UNAVAILABLE',
  };

  try {
    await saveTaskState(library, libraryId, [task]);
  } finally {
    library.close();
  }

  const reopened = await openProjectLibrary(library.library.directory);
  try {
    await expect(loadTaskState(reopened, libraryId)).resolves.toEqual([task]);
  } finally {
    reopened.close();
  }
});

it('keeps the design context library identity across repeated task-state saves', async () => {
  const library = await createTemporaryLibrary();
  const libraryId = library.library.libraryId;
  const task: TaskRecord = {
    id: 'task-conversation',
    requestId: 'request-conversation',
    state: 'completed',
    cancelRequested: false,
    attempt: 1,
    source: { kind: 'project', id: 'project-one' },
    capability: 'conversation',
    designContext: {
      version: 1,
      libraryId,
      projectId: 'project-one',
      brief: 'Launch poster',
      canvas: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds: [],
      userMessage: 'Create a launch poster',
      baseRevisionId: null,
    },
  };

  try {
    await saveTaskState(library, libraryId, [task]);
    const firstLoad = await loadTaskState(library, libraryId);
    expect(firstLoad[0]?.designContext?.libraryId).toBe(libraryId);
    await saveTaskState(library, libraryId, firstLoad);
    await expect(loadTaskState(library, libraryId)).resolves.toEqual([task]);
  } finally {
    library.close();
  }
});

it('recovers task contexts affected by the missing-library-identity persistence bug without rewriting the source file', async () => {
  const library = await createTemporaryLibrary();
  const libraryId = library.library.libraryId;
  const tasksPath = join(library.library.directory, '.designhub', 'tasks.json');
  const affectedTask = {
    id: 'task-affected',
    requestId: 'request-affected',
    state: 'failed',
    cancelRequested: false,
    attempt: 1,
    source: { kind: 'project', id: 'project-one' },
    capability: 'conversation',
    errorCode: 'PROVIDER_REQUEST_FAILED',
    designContext: {
      version: 1,
      projectId: 'project-one',
      brief: 'Launch poster',
      canvas: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds: [],
      userMessage: 'Create a launch poster',
      baseRevisionId: null,
    },
  };
  await writeFile(tasksPath, `${JSON.stringify([affectedTask], null, 2)}\n`, 'utf8');

  try {
    const before = await readFile(tasksPath);
    await expect(loadTaskState(library, libraryId)).resolves.toEqual([{
      ...affectedTask,
      designContext: { ...affectedTask.designContext, libraryId },
    }]);
    expect(await readFile(tasksPath)).toEqual(before);
  } finally {
    library.close();
  }
});

it('rejects a task context bound to a different project library', async () => {
  const library = await createTemporaryLibrary();
  const libraryId = library.library.libraryId;
  const tasksPath = join(library.library.directory, '.designhub', 'tasks.json');
  const mismatchedTask = {
    id: 'task-mismatched',
    requestId: 'request-mismatched',
    state: 'failed',
    cancelRequested: false,
    attempt: 1,
    designContext: {
      version: 1,
      workspaceId: 'different-library',
      projectId: 'project-one',
      brief: '',
      canvas: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds: [],
      userMessage: 'Create a launch poster',
      baseRevisionId: null,
    },
  };
  await writeFile(tasksPath, `${JSON.stringify([mismatchedTask], null, 2)}\n`, 'utf8');

  try {
    await expect(loadTaskState(library, libraryId)).rejects.toThrow('INVALID_TASK_STATE');
  } finally {
    library.close();
  }
});

it('rejects legacy document-bound task records without modifying task history', async () => {
  const library = await createTemporaryLibrary();
  const libraryId = library.library.libraryId;
  const tasksPath = join(library.library.directory, '.designhub', 'tasks.json');
  const fixture = await readFile(new URL('../fixtures/migrations/legacy-document-task.json', import.meta.url), 'utf8');
  const legacyTask = JSON.parse(fixture.replaceAll('__LIBRARY_ID__', libraryId)) as Record<string, unknown>;
  await writeFile(tasksPath, `${JSON.stringify([legacyTask])}\n`, 'utf8');

  try {
    const before = await readFile(tasksPath);
    await expect(loadTaskState(library, libraryId)).rejects.toThrow('DOCUMENT_SCHEMA_REMOVED');
    expect(await readFile(tasksPath)).toEqual(before);
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
