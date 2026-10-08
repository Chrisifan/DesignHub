import type { TaskRecord } from '../tasks/state';

export type ProviderExecutor = {
  kind: 'provider';
  connectionId: string;
  modelId?: string;
};

export type LocalExecutor = {
  kind: 'local';
  engine: string;
};

export type TaskExecutorDescriptor = ProviderExecutor | LocalExecutor;

export type TaskExecutionInput<TRequest = unknown> = {
  task?: TaskRecord;
  executor: TaskExecutorDescriptor;
  request: TRequest;
  signal?: AbortSignal;
};

export type TaskExecutionResult<TResult = unknown> = {
  value: TResult;
  remoteRequestId?: string;
  supportsRemoteCancellation?: boolean;
  supportsStatusQuery?: boolean;
};

export type TaskProviderExecutor = {
  execute: (request: unknown, signal: AbortSignal) => Promise<TaskExecutionResult | unknown>;
};

export type TaskLocalExecutor = {
  execute: (request: unknown, signal: AbortSignal) => Promise<TaskExecutionResult | unknown>;
};

export type TaskExecutorOptions = {
  resolveProvider: (connectionId: string) => Promise<TaskProviderExecutor>;
  resolveLocal?: (engine: string) => Promise<TaskLocalExecutor>;
  resolveFallback?: (connectionId: string) => Promise<TaskProviderExecutor>;
};

export type TaskExecutor = {
  execute: <TResult = unknown, TRequest = unknown>(input: TaskExecutionInput<TRequest>) => Promise<TaskExecutionResult<TResult>>;
};

const normalizeResult = <TResult>(value: TaskExecutionResult | TResult): TaskExecutionResult<TResult> => {
  if (value && typeof value === 'object' && 'value' in value) {
    const result = value as TaskExecutionResult<TResult>;
    return {
      value: result.value,
      ...(result.remoteRequestId ? { remoteRequestId: result.remoteRequestId } : {}),
      ...(result.supportsRemoteCancellation === undefined ? {} : { supportsRemoteCancellation: result.supportsRemoteCancellation }),
      ...(result.supportsStatusQuery === undefined ? {} : { supportsStatusQuery: result.supportsStatusQuery }),
    };
  }
  return { value: value as TResult };
};

/**
 * Executes exactly the explicitly selected executor. This boundary intentionally
 * has no retry or provider fallback: callers must make a new explicit request.
 */
export const createTaskExecutor = (options: TaskExecutorOptions): TaskExecutor => ({
  execute: async <TResult, TRequest>(input: TaskExecutionInput<TRequest>): Promise<TaskExecutionResult<TResult>> => {
    const signal = input.signal ?? new AbortController().signal;
    const runner = input.executor.kind === 'provider'
      ? await options.resolveProvider(input.executor.connectionId)
      : options.resolveLocal
        ? await options.resolveLocal(input.executor.engine)
        : undefined;
    if (!runner) throw new Error('LOCAL_EXECUTOR_UNAVAILABLE');
    return normalizeResult<TResult>(await runner.execute(input.request, signal) as TaskExecutionResult | TResult);
  },
});
