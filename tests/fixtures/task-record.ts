import type { TaskRecord } from '../../src/features/tasks/state';

export const createTaskRecordFixture = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'task-fixture',
  requestId: 'request-fixture',
  requestText: 'fixture task',
  state: 'queued',
  cancelRequested: false,
  attempt: 1,
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
  ...overrides,
});
