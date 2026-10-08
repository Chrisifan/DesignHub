import { expect, it } from 'vitest';

import { listTasksHandler, publishCompositionCandidateHandler, resolveCompositionCandidateHandler, saveTasksHandler } from './tasks';
import { createScene } from '../../features/canvas/scene';
import type { TaskRecord } from '../../features/tasks/state';

const makeFixture = (url: string) => {
  const mainFrame = { url };
  const webContents = { mainFrame, getURL: () => url };
  return { event: { sender: webContents, senderFrame: mainFrame }, window: { webContents } };
};

const task: TaskRecord = {
  id: 'task-1', requestId: 'request-1', state: 'queued', cancelRequested: false, attempt: 1,
};

it('lists tasks only for the active trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  const list = listTasksHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async () => [task]);
  await expect(list(fixture.event, 'workspace-1')).resolves.toEqual([task]);
  await expect(list(fixture.event, 'workspace-2')).resolves.toBeNull();
  const altered = makeFixture('http://localhost:5173/?preview=2');
  await expect(list(altered.event, 'workspace-1')).resolves.toBeNull();
});

it('rejects malformed task writes before storage is called', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  let writes = 0;
  const save = saveTasksHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async () => { writes += 1; return true; });
  await expect(save(fixture.event, { libraryId: 'workspace-1', tasks: [{ ...task, attempt: 0 }] })).resolves.toBe(false);
  await expect(save(fixture.event, { libraryId: 'workspace-1', tasks: [{
    ...task,
    providerFailure: { kind: 'http', status: 400, message: 'private provider error' },
  }] })).resolves.toBe(false);
  await expect(save(fixture.event, { libraryId: 'workspace-1', tasks: [{
    ...task,
    providerMessage: 'private provider error',
  }] })).resolves.toBe(false);
  await expect(save(fixture.event, { libraryId: 'workspace-1', tasks: [{
    ...task,
    analysisDiagnostic: 'private response text',
  }] })).resolves.toBe(false);
  expect(writes).toBe(0);
  await expect(save(fixture.event, { libraryId: 'workspace-1', tasks: [{
    ...task,
    analysisDiagnostic: 'payload.invalid_json',
  }] })).resolves.toBe(true);
  await expect(save(fixture.event, { libraryId: 'workspace-1', tasks: [task] })).resolves.toBe(true);
  expect(writes).toBe(2);
});

it('publishes and resolves a validated local candidate only in the active writable library', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1', openMode: 'writable' } };
  const candidate = {
    id: 'candidate-local', sourceTaskId: 'local-task', mode: 'structured' as const, editable: true,
    scene: createScene({ id: 'candidate-scene', width: 1080, height: 1440, layers: [] }),
    assets: [{ assetId: 'asset-core', role: 'core' as const }], createdAt: '2026-10-01T00:00:00.000Z',
  };
  const publish = publishCompositionCandidateHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_library, input) => ({
    id: input.candidate.sourceTaskId, requestId: input.candidate.sourceTaskId, state: 'completed', cancelRequested: false, attempt: 1,
    source: { kind: 'project', id: input.projectId }, documentId: input.documentId, capability: 'local-composition', result: { compositionCandidate: input.candidate },
  }));
  await expect(publish(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', candidate })).resolves.toMatchObject({ state: 'completed' });
  await expect(publish(fixture.event, { libraryId: 'other', projectId: 'project-1', documentId: 'doc-1', candidate })).resolves.toBeNull();
  await expect(publish(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', candidate: { ...candidate, scene: { id: 'bad', layers: [] } } })).resolves.toBeNull();

  const resolve = resolveCompositionCandidateHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_library, taskId, resolution) => ({
    id: taskId, requestId: taskId, state: 'completed', cancelRequested: false, attempt: 1, candidateResolution: resolution,
  }));
  await expect(resolve(fixture.event, { libraryId: 'workspace-1', taskId: 'local-task', resolution: 'discarded' })).resolves.toMatchObject({ candidateResolution: 'discarded' });
});
