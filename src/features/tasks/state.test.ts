import { describe, expect, it } from 'vitest';
import { mayTransition, createTaskState, requestCancellation, completeTask, retryTask } from './state';

describe('task state transitions', () => {
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
