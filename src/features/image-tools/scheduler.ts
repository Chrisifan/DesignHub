import { aggregateImageToolJobState, retryImageToolItem, validateRelativePath, type ImageToolItem, type ImageToolJob, type ToolExecutor } from './jobs';
import { failureItem, processImageToolItem, unknownItem, type BatchWorkerDeps } from './worker';

export type BatchJobSnapshot = { job: ImageToolJob; items: ImageToolItem[] };
export type BatchSchedulerOptions = BatchWorkerDeps & {
  maxLocalConcurrency?: number;
  maxProviderConcurrency?: number;
  itemTimeoutMs?: number;
  onUpdate?: (snapshot: BatchJobSnapshot) => void;
};

type RuntimeJob = { job: ImageToolJob; items: ImageToolItem[] };
const clone = <T>(value: T): T => structuredClone(value);

const executorFor = (job: ImageToolJob): ToolExecutor => job.executor ?? (job.tool === 'resize' || job.tool === 'format-convert' ? { kind: 'local', engine: 'image-codec' } : { kind: 'provider', connectionId: '', modelId: '' });
const executorKey = (job: ImageToolJob): string => {
  const executor = executorFor(job);
  return executor.kind === 'local' ? 'local' : `provider:${executor.connectionId}`;
};

/**
 * In-memory coordinator for persisted image tool jobs. Persistence belongs to
 * the caller's job store; onUpdate is called after every state transition.
 */
export const createImageToolScheduler = (options: BatchSchedulerOptions = {}) => {
  const jobs = new Map<string, RuntimeJob>();
  const order: string[] = [];
  const cursorByKey = new Map<string, number>();
  const running = new Map<string, { controller: AbortController; key: string }>();
  const paused = new Set<string>();
  const cancelled = new Set<string>();
  const maxLocalConcurrency = Math.max(1, options.maxLocalConcurrency ?? 2);
  // A provider connection defaults to one in-flight request. Callers may opt
  // into a higher limit only when the connection capability explicitly allows
  // it; each connection key is still throttled independently.
  const maxProviderConcurrency = Math.max(1, options.maxProviderConcurrency ?? 1);
  const itemTimeoutMs = Math.max(1, options.itemTimeoutMs ?? 60_000);
  let activeLocal = 0;
  let pumping = false;
  let scheduled = false;
  let stopping = false;
  let idleWaiters: Array<() => void> = [];
  const activeRuns = new Set<Promise<void>>();

  const hasPendingWork = (): boolean => [...jobs.values()].some((runtime) => !paused.has(runtime.job.id) && !cancelled.has(runtime.job.id) && runtime.items.some((item) => item.state === 'queued'));

  const emit = (runtime: RuntimeJob): void => options.onUpdate?.({ job: clone(runtime.job), items: clone(runtime.items) });
  const updateAggregate = (runtime: RuntimeJob, now = new Date().toISOString()): void => {
    const state = aggregateImageToolJobState(runtime.items);
    runtime.job = { ...runtime.job, state: paused.has(runtime.job.id) && (state === 'queued' || state === 'running') ? 'paused' : state, updatedAt: now };
    emit(runtime);
  };
  const notifyIdle = (): void => {
    if (running.size === 0 && !hasPendingWork()) {
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  };
  const candidateFor = (key: string): { runtime: RuntimeJob; item: ImageToolItem } | undefined => {
    const candidates = order.filter((id) => {
      const runtime = jobs.get(id);
      return runtime && !paused.has(id) && !cancelled.has(id) && executorKey(runtime.job) === key && runtime.items.some((item) => item.state === 'queued');
    });
    if (!candidates.length) return undefined;
    const cursor = cursorByKey.get(key) ?? 0;
    const id = candidates[cursor % candidates.length];
    // Keep the cursor absolute: when a new job joins while another is running,
    // the next selection must advance to the new job instead of resetting to 0.
    cursorByKey.set(key, cursor + 1);
    const runtime = jobs.get(id)!;
    const item = runtime.items.find((candidate) => candidate.state === 'queued')!;
    return { runtime, item };
  };
  const availableKeys = (): string[] => [...new Set(order.map((id) => jobs.get(id)).filter((runtime): runtime is RuntimeJob => Boolean(runtime)).filter((runtime) => !paused.has(runtime.job.id) && !cancelled.has(runtime.job.id) && runtime.items.some((item) => item.state === 'queued')).map((runtime) => executorKey(runtime.job)))];

  const runItem = async (runtime: RuntimeJob, item: ImageToolItem, key: string): Promise<void> => {
    const controller = new AbortController();
    running.set(item.id, { controller, key });
    const now = new Date().toISOString();
    const index = runtime.items.findIndex((candidate) => candidate.id === item.id);
    runtime.items[index] = { ...item, state: 'running', startedAt: now, updatedAt: now };
    runtime.job = { ...runtime.job, state: 'running', updatedAt: now };
    emit(runtime);
    if (key === 'local') activeLocal += 1;
    try {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('IMAGE_TOOL_ITEM_TIMEOUT'));
        }, itemTimeoutMs);
      });
      const result = await Promise.race([
        processImageToolItem(runtime.job, runtime.items[index], options, controller.signal),
        timeoutPromise,
      ]).finally(() => {
        if (timeout) clearTimeout(timeout);
      });
      runtime.items[index] = result.item;
    } catch (error) {
      runtime.items[index] = stopping ? unknownItem(runtime.items[index]) : failureItem(runtime.items[index], error);
    } finally {
      running.delete(item.id);
      if (key === 'local') activeLocal -= 1;
      updateAggregate(runtime);
      schedulePump();
    }
  };
  const dispatchAvailable = (): void => {
    if (stopping) return;
    const keys = availableKeys().filter((key) => key === 'local'
      ? activeLocal < maxLocalConcurrency
      : [...running.values()].filter((entry) => entry.key === key).length < maxProviderConcurrency);
    const taskKeys = keys.flatMap((key) => key === 'local'
      ? Array.from({ length: maxLocalConcurrency - activeLocal }, () => key)
      : Array.from({ length: maxProviderConcurrency - [...running.values()].filter((entry) => entry.key === key).length }, () => key));
    for (const key of taskKeys) {
      const candidate = candidateFor(key);
      if (!candidate) continue;
      const task = runItem(candidate.runtime, candidate.item, key);
      activeRuns.add(task);
      void task.finally(() => activeRuns.delete(task));
    }
  };
  const pump = async (): Promise<void> => {
    if (pumping) {
      dispatchAvailable();
      return;
    }
    pumping = true;
    try {
      while (!stopping) {
        dispatchAvailable();
        if (activeRuns.size === 0) break;
        await Promise.race(activeRuns);
      }
    } finally {
      pumping = false;
      notifyIdle();
      if (scheduled) {
        scheduled = false;
        void pump();
      }
    }
  };
  const schedulePump = (): void => {
    scheduled = true;
    if (pumping) dispatchAvailable();
    else void pump();
  };

  const enqueue = (job: ImageToolJob, items: readonly ImageToolItem[]): BatchJobSnapshot => {
    if (jobs.has(job.id)) throw new Error('IMAGE_TOOL_JOB_EXISTS');
    const itemIds = new Set(items.map((item) => item.id));
    if (items.some((item) => item.jobId !== job.id || !validateRelativePath(item.relativePath)) || itemIds.size !== items.length) throw new Error('IMAGE_TOOL_PATH_INVALID');
    const runtime = { job: { ...job }, items: clone([...items]) };
    jobs.set(job.id, runtime);
    order.push(job.id);
    emit(runtime);
    schedulePump();
    return { job: clone(runtime.job), items: clone(runtime.items) };
  };
  const get = (jobId: string): BatchJobSnapshot | null => {
    const runtime = jobs.get(jobId);
    return runtime ? { job: clone(runtime.job), items: clone(runtime.items) } : null;
  };
  const pauseJob = (jobId: string): BatchJobSnapshot => {
    const runtime = jobs.get(jobId);
    if (!runtime) throw new Error('IMAGE_TOOL_JOB_NOT_FOUND');
    paused.add(jobId);
    updateAggregate(runtime);
    return get(jobId)!;
  };
  const resumeJob = (jobId: string): BatchJobSnapshot => {
    const runtime = jobs.get(jobId);
    if (!runtime) throw new Error('IMAGE_TOOL_JOB_NOT_FOUND');
    paused.delete(jobId);
    cancelled.delete(jobId);
    updateAggregate(runtime);
    schedulePump();
    return get(jobId)!;
  };
  const cancelJob = (jobId: string): BatchJobSnapshot => {
    const runtime = jobs.get(jobId);
    if (!runtime) throw new Error('IMAGE_TOOL_JOB_NOT_FOUND');
    cancelled.add(jobId);
    paused.delete(jobId);
    const now = new Date().toISOString();
    runtime.items = runtime.items.map((item) => item.state === 'queued' ? { ...item, state: 'cancelled', errorCode: 'CANCELLED', updatedAt: now } : item);
    for (const item of runtime.items) running.get(item.id)?.controller.abort();
    updateAggregate(runtime, now);
    return get(jobId)!;
  };
  const retryItem = (jobId: string, itemId: string): BatchJobSnapshot => {
    const runtime = jobs.get(jobId);
    if (!runtime) throw new Error('IMAGE_TOOL_JOB_NOT_FOUND');
    const index = runtime.items.findIndex((item) => item.id === itemId);
    if (index < 0) throw new Error('IMAGE_TOOL_ITEM_NOT_FOUND');
    runtime.items[index] = retryImageToolItem(runtime.items[index]);
    cancelled.delete(jobId);
    paused.delete(jobId);
    updateAggregate(runtime);
    schedulePump();
    return get(jobId)!;
  };
  const stop = (): void => {
    stopping = true;
    for (const entry of running.values()) entry.controller.abort();
    for (const runtime of jobs.values()) {
      runtime.items = runtime.items.map((item) => item.state === 'running' ? unknownItem(item) : item);
      updateAggregate(runtime);
    }
    notifyIdle();
  };
  const waitForIdle = async (): Promise<void> => {
    if (running.size === 0 && !hasPendingWork()) return;
    await new Promise<void>((resolve) => idleWaiters.push(resolve));
  };
  return { enqueue, get, pauseJob, resumeJob, cancelJob, retryItem, stop, waitForIdle };
};

export const recoverBatchJob = (snapshot: BatchJobSnapshot): BatchJobSnapshot => {
  const items = snapshot.items.map((item) => item.state === 'running' ? unknownItem(item) : item);
  return { items, job: { ...snapshot.job, state: aggregateImageToolJobState(items), updatedAt: new Date().toISOString() } };
};

export const createBatchScheduler = createImageToolScheduler;
