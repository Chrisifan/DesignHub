import { describe, expect, it, vi } from 'vitest';

import { mergePolledTasks, startTaskPolling, type TaskPollingScheduler } from './task-polling';
import type { TaskRecord } from '../../features/tasks/state';

const createScheduler = (): TaskPollingScheduler & { tick: () => void; delay?: number } => {
  let callback: (() => void) | null = null;
  const scheduler: TaskPollingScheduler & { tick: () => void; delay?: number } = {
    setInterval: (next, delay) => { callback = next; scheduler.delay = delay; return 1; },
    clearInterval: vi.fn(),
    tick: () => callback?.(),
  };
  return scheduler;
};

describe('startTaskPolling', () => {
  it('refreshes immediately and on the configured cadence', () => {
    const scheduler = createScheduler();
    const refresh = vi.fn();
    const stop = startTaskPolling(refresh, 250, scheduler);

    expect(refresh).toHaveBeenCalledOnce();
    expect(scheduler.delay).toBe(250);
    scheduler.tick();
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
    expect(scheduler.clearInterval).toHaveBeenCalledWith(1);
    scheduler.tick();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps cleanup idempotent', () => {
    const scheduler = createScheduler();
    const stop = startTaskPolling(() => undefined, 2_000, scheduler);

    stop();
    stop();

    expect(scheduler.clearInterval).toHaveBeenCalledOnce();
  });
});

describe('mergePolledTasks', () => {
  const task = (id: string, state: TaskRecord['state']): TaskRecord => ({
    id,
    requestId: `request-${id}`,
    state,
    cancelRequested: false,
    attempt: 1,
  });

  it('keeps a newly submitted active task until polling observes it', () => {
    expect(mergePolledTasks(
      [task('conversation', 'completed'), task('local-generation', 'running')],
      [task('conversation', 'completed')],
    )).toEqual([
      task('conversation', 'completed'),
      task('local-generation', 'running'),
    ]);
  });

  it('uses the polled record once the submitted task is persisted', () => {
    expect(mergePolledTasks(
      [task('local-generation', 'running')],
      [task('local-generation', 'completed')],
    )).toEqual([task('local-generation', 'completed')]);
  });
});
