import type { RevisionStore } from '../revisions/commit-revision';
import { completeTask, createTaskState, type TaskRecord } from './state';

export type TaskResult = { sceneAssetId: string; assetIds?: string[] };

export type TaskRuntime = {
  get: (taskId: string) => TaskRecord | undefined;
  start: (task: Omit<TaskRecord, 'state' | 'cancelRequested' | 'attempt'>) => TaskRecord;
  cancel: (taskId: string) => TaskRecord | undefined;
  finish: (taskId: string, result: TaskResult, revisionStore: RevisionStore) => Promise<TaskRecord>;
};

export const createTaskRuntime = (): TaskRuntime => {
  const tasks = new Map<string, TaskRecord>();
  const results = new Map<string, string>();
  const get = (taskId: string): TaskRecord | undefined => {
    const task = tasks.get(taskId);
    return task ? structuredClone(task) : undefined;
  };
  const start = (input: Omit<TaskRecord, 'state' | 'cancelRequested' | 'attempt'>): TaskRecord => {
    const existing = tasks.get(input.id);
    if (existing) return structuredClone(existing);
    const task = createTaskState(input);
    tasks.set(task.id, task);
    return structuredClone(task);
  };
  const cancel = (taskId: string): TaskRecord | undefined => {
    const task = tasks.get(taskId);
    if (!task) return undefined;
    task.cancelRequested = true;
    tasks.set(taskId, task);
    return structuredClone(task);
  };
  const finish = async (taskId: string, result: TaskResult, revisionStore: RevisionStore): Promise<TaskRecord> => {
    const task = tasks.get(taskId);
    if (!task) throw new Error('TASK_NOT_FOUND');
    const existingRevision = results.get(taskId);
    if (existingRevision) return structuredClone({ ...task, state: 'completed' });
    if (task.cancelRequested) {
      const cancelled = completeTask(task);
      tasks.set(taskId, cancelled);
      return structuredClone(cancelled);
    }
    if (!task.documentId || !task.source?.id) throw new Error('TASK_BINDING_REQUIRED');
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
    const completed = completeTask(task);
    tasks.set(taskId, completed);
    return structuredClone(completed);
  };
  return { get, start, cancel, finish };
};
