import type { TaskRecord } from '../../features/tasks/state';

export type TaskPollingScheduler = {
  setInterval: (callback: () => void, delay: number) => number;
  clearInterval: (id: number) => void;
};

const isActiveTask = (task: TaskRecord): boolean => task.state === 'queued' || task.state === 'running';

/** Keeps optimistic active tasks until the persisted snapshot has observed them. */
export const mergePolledTasks = (current: readonly TaskRecord[], persisted: readonly TaskRecord[]): TaskRecord[] => {
  const persistedIds = new Set(persisted.map((task) => task.id));
  return [
    ...persisted,
    ...current.filter((task) => isActiveTask(task) && !persistedIds.has(task.id)),
  ];
};

/**
 * Starts an immediate task refresh followed by a bounded interval refresh.
 * The returned disposer is idempotent and prevents refreshes after cleanup.
 */
export const startTaskPolling = (
  refresh: () => void,
  intervalMs: number,
  scheduler: TaskPollingScheduler,
): (() => void) => {
  let active = true;
  const run = (): void => {
    if (active) refresh();
  };
  run();
  const intervalId = scheduler.setInterval(run, intervalMs);
  return (): void => {
    if (!active) return;
    active = false;
    scheduler.clearInterval(intervalId);
  };
};
