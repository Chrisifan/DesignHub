import type { TaskRuntime } from '../tasks/runtime';
import type { TaskRecord } from '../tasks/state';

export type TaskRecovery = {
  recoverOnStartup: () => Promise<void>;
  markUnknown: (taskId: string, reason?: string) => Promise<TaskRecord | undefined>;
  retryExplicitly: (taskId: string) => Promise<TaskRecord | undefined>;
};

export type TaskRecoveryOptions = {
  runtime: TaskRuntime;
  executeRetry?: (task: TaskRecord) => Promise<TaskRecord | undefined>;
};

/** Startup recovery is owned by TaskRuntime; this facade makes the policy explicit. */
export const createTaskRecovery = (options: TaskRecoveryOptions): TaskRecovery => ({
  recoverOnStartup: async () => {
    await options.runtime.flush();
  },

  markUnknown: async (taskId, reason = 'RESULT_UNKNOWN_AFTER_RESTART') => {
    const marked = options.runtime.markUnknown(taskId, reason);
    await options.runtime.flush();
    return marked;
  },

  retryExplicitly: async (taskId) => {
    const retried = options.runtime.retry(taskId);
    if (!retried) return undefined;
    return options.executeRetry ? options.executeRetry(retried) : retried;
  },
});
