import type { RevisionStore } from '../revisions/commit-revision';
import { completeTask, createTaskState, retryTask, transitionTask, type TaskProviderFailure, type TaskRecord } from './state';

import type { TaskCandidate } from './state';

export type TaskResult = { sceneAssetId?: string; assetIds?: string[]; text?: string; imageCount?: number; cost?: number | null; candidate?: TaskCandidate };

export type TaskRuntime = {
  get: (taskId: string) => TaskRecord | undefined;
  list: () => TaskRecord[];
  start: (task: Omit<TaskRecord, 'state' | 'cancelRequested' | 'attempt'>) => TaskRecord;
  run: (taskId: string) => TaskRecord | undefined;
  cancel: (taskId: string) => TaskRecord | undefined;
  complete: (taskId: string, result?: TaskResult) => Promise<TaskRecord>;
  fail: (taskId: string, errorCode: string, providerFailure?: TaskProviderFailure) => Promise<TaskRecord>;
  retry: (taskId: string) => TaskRecord | undefined;
  finish: (taskId: string, result: TaskResult, revisionStore: RevisionStore) => Promise<TaskRecord>;
  flush: () => Promise<void>;
};

export type TaskRuntimeOptions = {
  initialTasks?: readonly TaskRecord[];
  persist?: (tasks: readonly TaskRecord[]) => Promise<void>;
};

export const createTaskRuntime = (options: TaskRuntimeOptions = {}): TaskRuntime => {
  const tasks = new Map<string, TaskRecord>();
  const results = new Map<string, string>();
  let recoveredInterruptedTask = false;
  options.initialTasks?.forEach((task) => {
    if (task.state === 'queued' || task.state === 'running') {
      recoveredInterruptedTask = true;
      tasks.set(task.id, structuredClone({ ...task, state: 'failed', cancelRequested: false, errorCode: 'RESULT_UNKNOWN_AFTER_RESTART', updatedAt: new Date().toISOString() }));
      return;
    }
    tasks.set(task.id, structuredClone(task));
  });
  let persistence = Promise.resolve();
  const snapshot = (): TaskRecord[] => [...tasks.values()].map((task) => structuredClone(task));
  const schedulePersistence = (): void => {
    if (!options.persist) return;
    const next = snapshot();
    persistence = persistence.then(() => options.persist!(next));
  };
  if (recoveredInterruptedTask) schedulePersistence();
  const get = (taskId: string): TaskRecord | undefined => {
    const task = tasks.get(taskId);
    return task ? structuredClone(task) : undefined;
  };
  const list = (): TaskRecord[] => snapshot();
  const start = (input: Omit<TaskRecord, 'state' | 'cancelRequested' | 'attempt'>): TaskRecord => {
    const existing = tasks.get(input.id);
    if (existing) return structuredClone(existing);
    const task = createTaskState(input);
    tasks.set(task.id, task);
    schedulePersistence();
    return structuredClone(task);
  };
  const run = (taskId: string): TaskRecord | undefined => {
    const task = tasks.get(taskId);
    if (!task) return undefined;
    const running = transitionTask({ ...task, updatedAt: new Date().toISOString() }, 'running');
    tasks.set(taskId, running);
    schedulePersistence();
    return structuredClone(running);
  };
  const cancel = (taskId: string): TaskRecord | undefined => {
    const task = tasks.get(taskId);
    if (!task) return undefined;
    task.cancelRequested = true;
    tasks.set(taskId, task);
    schedulePersistence();
    return structuredClone(task);
  };
  const complete = async (taskId: string, result: TaskResult = {}): Promise<TaskRecord> => {
    const task = tasks.get(taskId);
    if (!task) throw new Error('TASK_NOT_FOUND');
    if (task.state === 'completed') return structuredClone(task);
    if (task.state === 'failed' || task.state === 'cancelled') return structuredClone(task);
    const completed = completeTask({ ...task, result: { ...result }, updatedAt: new Date().toISOString() });
    tasks.set(taskId, completed);
    schedulePersistence();
    await persistence;
    return structuredClone(completed);
  };
  const fail = async (taskId: string, errorCode: string, providerFailure?: TaskProviderFailure): Promise<TaskRecord> => {
    const task = tasks.get(taskId);
    if (!task) throw new Error('TASK_NOT_FOUND');
    if (task.state === 'completed' || task.state === 'cancelled') return structuredClone(task);
    const failed = transitionTask({ ...task, errorCode, ...(providerFailure ? { providerFailure } : {}), updatedAt: new Date().toISOString() }, 'failed');
    tasks.set(taskId, failed);
    schedulePersistence();
    await persistence;
    return structuredClone(failed);
  };
  const retry = (taskId: string): TaskRecord | undefined => {
    const task = tasks.get(taskId);
    if (!task) return undefined;
    const retried = retryTask(task, `${task.id}-retry-${crypto.randomUUID()}`);
    tasks.set(retried.id, retried);
    schedulePersistence();
    return structuredClone(retried);
  };
  const finish = async (taskId: string, result: TaskResult, revisionStore: RevisionStore): Promise<TaskRecord> => {
    const task = tasks.get(taskId);
    if (!task) throw new Error('TASK_NOT_FOUND');
    const existingRevision = results.get(taskId);
    if (existingRevision) return structuredClone({ ...task, state: 'completed' });
    if (task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled') return structuredClone(task);
    if (task.cancelRequested) {
      const cancelled = completeTask({ ...task, result: { ...result }, updatedAt: new Date().toISOString() });
      tasks.set(taskId, cancelled);
      schedulePersistence();
      await persistence;
      return structuredClone(cancelled);
    }
    if (!task.documentId || !task.source?.id || !result.sceneAssetId) throw new Error('TASK_BINDING_REQUIRED');
    const revision = await revisionStore.commitRevision({
      projectId: task.source.id,
      documentId: task.documentId,
      baseRevisionId: task.baseRevisionId ?? null,
      operationId: task.requestId,
      sceneAssetId: result.sceneAssetId,
      assetIds: result.assetIds ?? [],
      contributions: task.designerVersionId ? [{ designerVersionId: task.designerVersionId, role: 'revision' }] : [],
    });
    results.set(taskId, revision.revisionId);
    const completed = completeTask({ ...task, result: { ...result }, updatedAt: new Date().toISOString() });
    tasks.set(taskId, completed);
    schedulePersistence();
    await persistence;
    return structuredClone(completed);
  };
  const flush = async (): Promise<void> => persistence;
  return { get, list, start, run, cancel, complete, fail, retry, finish, flush };
};
