import type { TaskRuntime } from '../tasks/runtime';
import type { TaskRecord } from '../tasks/state';

export type RemoteTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';

export type RemoteCancelResult =
  | { status: 'cancelled'; remoteRequestId: string }
  | { status: 'unsupported' }
  | { status: 'failed'; remoteRequestId?: string };

export type TaskRuntimeAdapter = {
  abort: (taskId: string) => boolean;
  cancel: (taskId: string) => ReturnType<TaskRuntime['cancel']>;
  cancelRemote: (task: TaskRecord) => Promise<RemoteCancelResult>;
  queryRemote: (task: TaskRecord) => Promise<RemoteTaskStatus>;
};

export type TaskRuntimeAdapterOptions = {
  runtime: TaskRuntime;
  controllers?: Map<string, AbortController>;
  generationControllers?: Map<string, Map<string, AbortController>>;
  cancelRemote?: (task: TaskRecord) => Promise<void>;
  queryRemote?: (task: TaskRecord) => Promise<RemoteTaskStatus>;
};

/** Bridges local task state with provider cancellation/query capabilities. */
export const createTaskRuntimeAdapter = (options: TaskRuntimeAdapterOptions): TaskRuntimeAdapter => {
  const abort = (taskId: string): boolean => {
    let aborted = false;
    const controller = options.controllers?.get(taskId);
    if (controller) {
      controller.abort();
      aborted = true;
    }
    const generation = options.generationControllers?.get(taskId);
    generation?.forEach((entry) => {
      entry.abort();
      aborted = true;
    });
    return aborted;
  };

  const cancel = (taskId: string): ReturnType<TaskRuntime['cancel']> => {
    abort(taskId);
    return options.runtime.cancel(taskId);
  };

  const cancelRemote = async (task: TaskRecord): Promise<RemoteCancelResult> => {
    if (!task.remoteRequestId || task.remoteSupportsCancellation !== true || !options.cancelRemote) return { status: 'unsupported' };
    try {
      await options.cancelRemote(task);
      return { status: 'cancelled', remoteRequestId: task.remoteRequestId };
    } catch {
      return { status: 'failed', remoteRequestId: task.remoteRequestId };
    }
  };

  const queryRemote = async (task: TaskRecord): Promise<RemoteTaskStatus> => {
    if (!task.remoteRequestId || task.remoteSupportsStatusQuery !== true || !options.queryRemote) return 'unknown';
    try {
      return await options.queryRemote(task);
    } catch {
      return 'unknown';
    }
  };

  return { abort, cancel, cancelRemote, queryRemote };
};
