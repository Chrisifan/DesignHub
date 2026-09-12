import { describe, expect, it } from 'vitest';
import { mayTransition, createTaskState, requestCancellation, completeTask } from './state';

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
});
