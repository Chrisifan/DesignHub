import { expect, it } from 'vitest';

import {
  completeTaskRecord,
  createRunningTask,
  failTaskRecord,
  retryTaskRecord,
  transitionTaskRecord,
} from './task-state-machine';

const input = {
  id: 'task-1',
  requestId: 'request-1',
  providerId: 'connection-1',
  capability: 'conversation',
  requestText: 'hello',
  createdAt: '2026-10-06T00:00:00.000Z',
} as const;

it('creates a running task and applies legal state transitions', () => {
  const task = createRunningTask(input);
  expect(task).toMatchObject({ state: 'running', cancelRequested: false, attempt: 1 });
  expect(transitionTaskRecord(task, 'completed')).toMatchObject({ state: 'completed' });
  expect(transitionTaskRecord(task, 'unknown')).toMatchObject({ state: 'running' });
});

it('keeps terminal failures terminal and retries with a new queued identity', () => {
  const task = createRunningTask(input);
  const failed = failTaskRecord(task, 'PROVIDER_FAILED');
  expect(failed).toMatchObject({ state: 'failed', errorCode: 'PROVIDER_FAILED' });
  expect(completeTaskRecord(failed)).toMatchObject({ state: 'failed' });
  expect(retryTaskRecord(failed, 'task-1-retry')).toMatchObject({
    id: 'task-1-retry',
    state: 'queued',
    cancelRequested: false,
    attempt: 2,
  });
});
