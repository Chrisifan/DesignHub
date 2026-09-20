import { describe, expect, it } from 'vitest';
import {
  completeTask,
  createDesignGenerationSlots,
  createTaskState,
  designGenerationSlotIds,
  mayTransition,
  requestCancellation,
  retryTask,
  type TaskRecord,
} from './state';

describe('task state transitions', () => {
  it('creates the three trusted generation slots in stable order', () => {
    expect(designGenerationSlotIds).toEqual(['primary', 'composition', 'expressive']);
    expect(createDesignGenerationSlots()).toEqual([
      expect.objectContaining({ id: 'primary', state: 'queued', attempt: 1 }),
      expect.objectContaining({ id: 'composition', state: 'queued', attempt: 1 }),
      expect.objectContaining({ id: 'expressive', state: 'queued', attempt: 1 }),
    ]);
    const directions = createDesignGenerationSlots().map((slot) => slot.direction).join('\n');
    expect(directions).toContain('准确');
    expect(directions).toContain('构图');
    expect(directions).toContain('大胆');
  });

  it('keeps the historical single candidate result assignable', () => {
    const task: TaskRecord = {
      id: 'legacy',
      requestId: 'request-legacy',
      state: 'completed',
      cancelRequested: false,
      attempt: 1,
      result: {
        candidate: {
          id: 'candidate-legacy',
          baseRevisionId: null,
          assetIds: ['asset-legacy'],
          createdAt: '2026-09-20T00:00:00.000Z',
        },
      },
    };
    expect(task.result?.candidate?.id).toBe('candidate-legacy');
  });

  it('取消后迟到完成不能覆盖状态，终态不能自动重跑', () => {
    expect(mayTransition('cancelled', 'completed')).toBe(false);
    expect(mayTransition('completed', 'running')).toBe(false);
    expect(mayTransition('running', 'completed')).toBe(true);
  });

  it('cancellation is represented before a running task reaches its terminal state', () => {
    const task = createTaskState({ id: 'task-1', requestId: 'request-1' });
    const requested = requestCancellation(task);
    expect(requested.cancelRequested).toBe(true);
    expect(requested.state).toBe('running');
    expect(completeTask(requested).state).toBe('cancelled');
  });

  it('preserves design generation context when a task is retried', () => {
    const task = createTaskState({
      id: 'task-1',
      requestId: 'request-1',
      capability: 'design-generation',
      parentConversationTaskId: 'conversation-1',
      contextAssetIds: ['asset-1'],
      contextVersion: 1,
    });
    const failed = { ...task, state: 'failed' as const, errorCode: 'PROVIDER_REQUEST_FAILED' };
    const retried = retryTask(failed, 'task-2');
    expect(retried).toMatchObject({ parentConversationTaskId: 'conversation-1', contextAssetIds: ['asset-1'], contextVersion: 1 });
    expect(retried.generationSlots?.map((slot) => slot.id)).toEqual(['primary', 'composition', 'expressive']);
  });

  it('preserves analysis thread fields when a task is retried', () => {
    const task = createTaskState({
      id: 'task-1', requestId: 'request-1', capability: 'conversation',
      analysisThreadId: 'thread-1', conversationParentTaskId: 'task-0', progressText: 'partial',
    });
    const failed = { ...task, state: 'failed' as const, errorCode: 'PROVIDER_REQUEST_FAILED' };
    expect(retryTask(failed, 'task-2')).toMatchObject({ analysisThreadId: 'thread-1', conversationParentTaskId: 'task-0' });
  });
});
