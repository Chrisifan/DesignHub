import { expect, it } from 'vitest';

import { createTaskRuntime } from './runtime';
import type { TaskRecord } from './state';

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
  expect(runtime.get('task-1')?.state).toBe('running');
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
