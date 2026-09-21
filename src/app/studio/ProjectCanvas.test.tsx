import { describe, expect, it } from 'vitest';

import { getAnalysisHistory, getLatestConversationTask } from './ProjectCanvas';
import type { TaskRecord } from '../../features/tasks/state';

const conversation = (input: Partial<TaskRecord> & Pick<TaskRecord, 'id' | 'createdAt'>): TaskRecord => ({
  id: input.id,
  requestId: `${input.id}-request`,
  requestText: input.requestText ?? input.id,
  state: input.state ?? 'completed',
  cancelRequested: false,
  attempt: 1,
  capability: 'conversation',
  analysisThreadId: input.analysisThreadId ?? 'thread-1',
  createdAt: input.createdAt,
});

describe('getAnalysisHistory', () => {
  it('includes the displayed analysis, orders newest first, and counts every conversation in the thread', () => {
    const older = conversation({ id: 'older', createdAt: '2026-09-20T10:00:00.000Z' });
    const displayed = conversation({ id: 'latest', createdAt: '2026-09-21T10:00:00.000Z' });
    const middle = conversation({ id: 'middle', createdAt: '2026-09-20T12:00:00.000Z' });
    const unrelated = conversation({ id: 'other-thread', analysisThreadId: 'thread-2', createdAt: '2026-09-22T10:00:00.000Z' });

    const history = getAnalysisHistory([older, middle, unrelated], 'thread-1', displayed);

    expect(history.map((task) => task.id)).toEqual(['latest', 'middle', 'older']);
    expect(history).toHaveLength(3);
  });

  it('does not duplicate the displayed task when it is already in the task list', () => {
    const displayed = conversation({ id: 'latest', createdAt: '2026-09-21T10:00:00.000Z' });

    expect(getAnalysisHistory([displayed], 'thread-1', displayed).map((task) => task.id)).toEqual(['latest']);
  });
});

describe('getLatestConversationTask', () => {
  it('returns the newest persisted conversation task', () => {
    const older = conversation({ id: 'older', createdAt: '2026-09-20T10:00:00.000Z' });
    const latest = conversation({ id: 'latest', createdAt: '2026-09-21T10:00:00.000Z' });
    const generation = { ...latest, id: 'generation', capability: 'design-generation' };

    expect(getLatestConversationTask([older, generation, latest])?.id).toBe('latest');
  });
});
