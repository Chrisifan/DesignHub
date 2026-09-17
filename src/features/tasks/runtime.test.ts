import { expect, it, vi } from 'vitest';

import { createTaskRuntime } from './runtime';
import type { TaskRecord } from './state';
import type { RevisionStore } from '../revisions/commit-revision';

const baseTask: TaskRecord = {
  id: 'task-1',
  requestId: 'request-1',
  state: 'running',
  cancelRequested: false,
  attempt: 1,
  source: { kind: 'project', id: 'project-1' },
};

it('hydrates persisted tasks and exposes a cloned list', () => {
  const runtime = createTaskRuntime({ initialTasks: [baseTask] });
  const listed = runtime.list();
  listed[0]!.state = 'failed';
  expect(runtime.get('task-1')?.state).toBe('failed');
  expect(runtime.get('task-1')?.errorCode).toBe('RESULT_UNKNOWN_AFTER_RESTART');
});

it('persists restart recovery so an interrupted task can be explicitly retried', async () => {
  const writes: Array<readonly TaskRecord[]> = [];
  const runtime = createTaskRuntime({ initialTasks: [baseTask], persist: async (tasks) => { writes.push(tasks); } });
  await runtime.flush();
  expect(writes.at(-1)?.[0]).toMatchObject({ state: 'failed', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' });
  const retried = runtime.retry('task-1');
  expect(retried).toMatchObject({ state: 'queued', attempt: 2 });
});

it('serializes mutations through one persistence queue', async () => {
  const writes: Array<readonly TaskRecord[]> = [];
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const runtime = createTaskRuntime({
    persist: async (tasks) => {
      writes.push(tasks);
      if (writes.length === 1) await firstWrite;
    },
  });
  runtime.start(baseTask);
  runtime.cancel('task-1');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(writes).toHaveLength(1);
  releaseFirst();
  await runtime.flush();
  expect(writes).toHaveLength(2);
  expect(writes[1]![0]!.cancelRequested).toBe(true);
});

it('completes text tasks without creating an image revision', async () => {
  const runtime = createTaskRuntime();
  runtime.start({ ...baseTask, documentId: undefined });
  const completed = await runtime.complete('task-1', { text: 'drafted brief' });
  expect(completed.state).toBe('completed');
  expect(completed.result).toEqual({ text: 'drafted brief' });
});

it('marks provider failures and keeps a retryable task record', async () => {
  const runtime = createTaskRuntime();
  runtime.start(baseTask);
  const failed = await runtime.fail('task-1', 'PROVIDER_UNAVAILABLE');
  expect(failed.state).toBe('failed');
  expect(failed.errorCode).toBe('PROVIDER_UNAVAILABLE');
});

it('persists a safe analysis diagnostic on failure and clears it on retry', async () => {
  const runtime = createTaskRuntime();
  runtime.start(baseTask);
  await runtime.fail(
    'task-1',
    'VISION_ANALYSIS_INVALID_RESPONSE',
    undefined,
    'candidate.styleDna.signals.contrast.invalid_percentage',
  );
  expect(runtime.get('task-1')?.analysisDiagnostic).toBe(
    'candidate.styleDna.signals.contrast.invalid_percentage',
  );
  const retried = runtime.retry('task-1');
  expect(retried?.analysisDiagnostic).toBeUndefined();
});

it('creates a new queued attempt when a failed task is explicitly retried', async () => {
  const runtime = createTaskRuntime();
  runtime.start(baseTask);
  await runtime.fail('task-1', 'PROVIDER_UNAVAILABLE');
  const retried = runtime.retry('task-1');
  expect(retried).toBeDefined();
  if (!retried) throw new Error('expected retry task');
  expect(retried.id).not.toBe('task-1');
  expect(retried.state).toBe('queued');
  expect(retried.attempt).toBe(2);
  expect(runtime.get('task-1')?.state).toBe('failed');
  expect(runtime.get(retried.id)?.requestId).toBe('request-1');
});

it('does not commit a hydrated completed task again after restart', async () => {
  const completedTask: TaskRecord = {
    ...baseTask,
    documentId: 'doc-1',
    state: 'completed',
    result: { sceneAssetId: 'scene-1', assetIds: ['asset-1'] },
  };
  const revisionStore = { commitRevision: vi.fn(async () => ({ revisionId: 'revision-duplicate' })) };
  const runtime = createTaskRuntime({ initialTasks: [completedTask] });

  const result = await runtime.finish('task-1', { sceneAssetId: 'scene-1', assetIds: ['asset-1'] }, revisionStore as unknown as RevisionStore);

  expect(result.state).toBe('completed');
  expect(revisionStore.commitRevision).not.toHaveBeenCalled();
});
