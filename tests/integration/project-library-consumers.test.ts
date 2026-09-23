// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
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
    const first = await projects.createProjectContainer({ workspaceId: libraryId, operationId: 'create-one', name: 'Project One' });
    const second = await projects.createProjectContainer({ workspaceId: libraryId, operationId: 'create-two', name: 'Project Two' });
    secondProjectId = second.projectId;
    expect(first.projectId).not.toBe(second.projectId);
    await expect(projects.getProjectMetadata(first.projectId)).resolves.toMatchObject({ name: 'Project One' });
    await expect(projects.getProjectMetadata(second.projectId)).resolves.toMatchObject({ name: 'Project Two' });

    await saveTaskState(library, libraryId, [task]);
    await projects.moveProjectToTrash({ workspaceId: libraryId, projectId: first.projectId });
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
