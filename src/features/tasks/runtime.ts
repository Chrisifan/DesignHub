import {
  type DesignGenerationSlot,
  type DesignGenerationSlotId,
  type PortfolioAnalysisDiagnostic,
  type TaskProviderFailure,
  type TaskRecord,
} from './state';
import {
  completeTaskRecord as completeTask,
  createRunningTask as createTaskState,
  retryTaskRecord as retryTask,
  transitionTaskRecord as transitionTask,
} from '../agent/task-state-machine';

import type { TaskCandidate, ToolCandidate } from './state';
import type { VisualContextPlan } from '../agent/visual-context';

export type TaskResult = { sceneAssetId?: string; assetIds?: string[]; text?: string; imageCount?: number; cost?: number | null; candidate?: TaskCandidate; candidates?: TaskCandidate[]; toolCandidate?: ToolCandidate };

export type TaskRuntime = {
  get: (taskId: string) => TaskRecord | undefined;
  list: () => TaskRecord[];
  start: (task: Omit<TaskRecord, 'state' | 'cancelRequested' | 'attempt'>) => TaskRecord;
  run: (taskId: string) => TaskRecord | undefined;
  cancel: (taskId: string) => TaskRecord | undefined;
  complete: (taskId: string, result?: TaskResult) => Promise<TaskRecord>;
  fail: (taskId: string, errorCode: string, providerFailure?: TaskProviderFailure, analysisDiagnostic?: PortfolioAnalysisDiagnostic) => Promise<TaskRecord>;
  updateProgress: (taskId: string, progressText: string) => TaskRecord | undefined;
  updateRemoteMetadata: (taskId: string, metadata: Pick<TaskRecord, 'remoteRequestId' | 'remoteSupportsCancellation' | 'remoteSupportsStatusQuery'>) => TaskRecord | undefined;
  updateVisualContextPlan: (taskId: string, plan: VisualContextPlan) => TaskRecord | undefined;
  updateGenerationSlot: (
    taskId: string,
    slotId: DesignGenerationSlotId,
    patch: Partial<Omit<DesignGenerationSlot, 'id' | 'direction' | 'attempt'>>,
    candidate?: TaskCandidate,
  ) => TaskRecord | undefined;
  retryGenerationSlot: (taskId: string, slotId: DesignGenerationSlotId) => TaskRecord | undefined;
  settleGenerationBatch: (taskId: string) => Promise<TaskRecord>;
  retry: (taskId: string) => TaskRecord | undefined;
  markUnknown: (taskId: string, errorCode?: string) => TaskRecord | undefined;
  flush: () => Promise<void>;
};

export type TaskRuntimeOptions = {
  initialTasks?: readonly TaskRecord[];
  persist?: (tasks: readonly TaskRecord[]) => Promise<void>;
};

export const createTaskRuntime = (options: TaskRuntimeOptions = {}): TaskRuntime => {
  const tasks = new Map<string, TaskRecord>();
  let recoveredInterruptedTask = false;
  options.initialTasks?.forEach((task) => {
    if (task.capability === 'conversation' && task.state === 'completed' && !task.result?.text?.trim()) {
      recoveredInterruptedTask = true;
      tasks.set(task.id, structuredClone({
        ...task,
        state: 'failed',
        cancelRequested: false,
        errorCode: 'EMPTY_PROVIDER_RESPONSE',
        updatedAt: new Date().toISOString(),
      }));
      return;
    }
    if ((task.state === 'queued' || task.state === 'running') && task.generationSlots?.length) {
      recoveredInterruptedTask = true;
      const generationSlots = task.generationSlots.map((slot) => slot.state === 'queued' || slot.state === 'running'
        ? { ...slot, state: 'failed' as const, errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' }
        : slot);
      tasks.set(task.id, structuredClone({
        ...task,
        state: 'unknown' as const,
        cancelRequested: false,
        generationSlots,
        errorCode: 'RESULT_UNKNOWN_AFTER_RESTART',
        updatedAt: new Date().toISOString(),
      }));
      return;
    }
    if (task.state === 'queued' || task.state === 'running') {
      recoveredInterruptedTask = true;
      tasks.set(task.id, structuredClone({ ...task, state: 'unknown' as const, cancelRequested: false, errorCode: 'RESULT_UNKNOWN_AFTER_RESTART', updatedAt: new Date().toISOString() }));
      return;
    }
    tasks.set(task.id, structuredClone(task));
  });
  let persistence = Promise.resolve();
  let progressTimer: ReturnType<typeof setTimeout> | undefined;
  let progressDirty = false;
  const snapshot = (): TaskRecord[] => [...tasks.values()].map((task) => structuredClone(task));
  const schedulePersistence = (): void => {
    if (!options.persist) return;
    const next = snapshot();
    persistence = persistence.then(() => options.persist!(next));
  };
  const scheduleProgressPersistence = (): void => {
    if (!options.persist || progressTimer) return;
    progressTimer = setTimeout(() => {
      progressTimer = undefined;
      if (!progressDirty) return;
      progressDirty = false;
      schedulePersistence();
    }, 80);
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
    if (task.state === 'failed' || task.state === 'cancelled' || task.state === 'unknown') return structuredClone(task);
    const completed = completeTask({ ...task, result: { ...result }, updatedAt: new Date().toISOString() });
    tasks.set(taskId, completed);
    schedulePersistence();
    await persistence;
    return structuredClone(completed);
  };
  const fail = async (taskId: string, errorCode: string, providerFailure?: TaskProviderFailure, analysisDiagnostic?: PortfolioAnalysisDiagnostic): Promise<TaskRecord> => {
    const task = tasks.get(taskId);
    if (!task) throw new Error('TASK_NOT_FOUND');
    if (task.state === 'completed' || task.state === 'cancelled' || task.state === 'unknown') return structuredClone(task);
    const failed = transitionTask({ ...task, errorCode, ...(providerFailure ? { providerFailure } : {}), ...(analysisDiagnostic ? { analysisDiagnostic } : {}), updatedAt: new Date().toISOString() }, 'failed');
    tasks.set(taskId, failed);
    schedulePersistence();
    await persistence;
    return structuredClone(failed);
  };
  const updateProgress = (taskId: string, progressText: string): TaskRecord | undefined => {
    const task = tasks.get(taskId);
    if (!task || task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled' || task.state === 'unknown') return task ? structuredClone(task) : undefined;
    const updated = { ...task, progressText, updatedAt: new Date().toISOString() };
    tasks.set(taskId, updated);
    progressDirty = true;
    scheduleProgressPersistence();
    return structuredClone(updated);
  };
  const updateRemoteMetadata: TaskRuntime['updateRemoteMetadata'] = (taskId, metadata) => {
    const task = tasks.get(taskId);
    if (!task) return undefined;
    const updated = { ...task, ...metadata, updatedAt: new Date().toISOString() };
    tasks.set(taskId, updated);
    schedulePersistence();
    return structuredClone(updated);
  };
  const updateVisualContextPlan: TaskRuntime['updateVisualContextPlan'] = (taskId, plan) => {
    const task = tasks.get(taskId);
    if (!task || task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled' || task.state === 'unknown') {
      return task ? structuredClone(task) : undefined;
    }
    const updated = {
      ...task,
      visualContextPlan: structuredClone(plan),
      updatedAt: new Date().toISOString(),
    };
    tasks.set(taskId, updated);
    schedulePersistence();
    return structuredClone(updated);
  };
  const generationResult = (task: TaskRecord, slots: readonly DesignGenerationSlot[], candidates: readonly TaskCandidate[]): TaskResult => {
    const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const orderedCandidates = slots.flatMap((slot) => slot.candidateId && candidateById.has(slot.candidateId)
      ? [candidateById.get(slot.candidateId)!]
      : []);
    const successfulSlots = slots.filter((slot) => slot.state === 'completed' && slot.assetId);
    const cost = successfulSlots.length > 0 && successfulSlots.every((slot) => slot.cost !== undefined && slot.cost !== null)
      ? successfulSlots.reduce((total, slot) => total + Number(slot.cost), 0)
      : null;
    return {
      ...task.result,
      candidates: orderedCandidates,
      assetIds: orderedCandidates.flatMap((candidate) => candidate.assetIds),
      imageCount: orderedCandidates.length,
      cost,
    };
  };
  const updateGenerationSlot: TaskRuntime['updateGenerationSlot'] = (taskId, slotId, patch, candidate) => {
    const task = tasks.get(taskId);
    if (!task?.generationSlots) return undefined;
    const current = task.generationSlots.find((slot) => slot.id === slotId);
    if (!current) return undefined;
    const generationSlots = task.generationSlots.map((slot) => slot.id === slotId ? { ...slot, ...patch } : slot);
    const candidates = candidate
      ? [...(task.result?.candidates ?? []).filter((item) => item.id !== candidate.id), candidate]
      : task.result?.candidates ?? [];
    const updated = {
      ...task,
      generationSlots,
      result: generationResult(task, generationSlots, candidates),
      updatedAt: new Date().toISOString(),
    };
    tasks.set(taskId, updated);
    schedulePersistence();
    return structuredClone(updated);
  };
  const retryGenerationSlot: TaskRuntime['retryGenerationSlot'] = (taskId, slotId) => {
    const task = tasks.get(taskId);
    const current = task?.generationSlots?.find((slot) => slot.id === slotId);
    if (!task || !current || (current.state !== 'failed' && current.state !== 'cancelled')) throw new Error('GENERATION_SLOT_NOT_RETRYABLE');
    if (task.generationSlots!.some((slot) => slot.id !== slotId && (slot.state === 'queued' || slot.state === 'running'))) throw new Error('GENERATION_BATCH_ACTIVE');
    const generationSlots = task.generationSlots!.map((slot) => slot.id === slotId ? {
      id: slot.id,
      direction: slot.direction,
      state: 'queued' as const,
      attempt: slot.attempt + 1,
    } : slot);
    const updated = {
      ...task,
      state: 'running' as const,
      cancelRequested: false,
      errorCode: undefined,
      providerFailure: undefined,
      generationSlots,
      updatedAt: new Date().toISOString(),
    };
    tasks.set(taskId, updated);
    schedulePersistence();
    return structuredClone(updated);
  };
  const settleGenerationBatch: TaskRuntime['settleGenerationBatch'] = async (taskId) => {
    const task = tasks.get(taskId);
    if (!task?.generationSlots) throw new Error('GENERATION_SLOTS_REQUIRED');
    if (task.generationSlots.some((slot) => slot.state === 'queued' || slot.state === 'running')) throw new Error('GENERATION_BATCH_ACTIVE');
    const hasSuccess = task.generationSlots.some((slot) => slot.state === 'completed');
    const state = hasSuccess ? 'completed' : task.cancelRequested ? 'cancelled' : 'failed';
    const settled: TaskRecord = {
      ...task,
      state,
      errorCode: state === 'failed' ? 'DESIGN_GENERATION_ALL_FAILED' : undefined,
      updatedAt: new Date().toISOString(),
    };
    tasks.set(taskId, settled);
    schedulePersistence();
    await persistence;
    return structuredClone(settled);
  };
  const retry = (taskId: string): TaskRecord | undefined => {
    const task = tasks.get(taskId);
    if (!task) return undefined;
    const retried = retryTask(task, `${task.id}-retry-${crypto.randomUUID()}`);
    tasks.set(retried.id, retried);
    schedulePersistence();
    return structuredClone(retried);
  };
  const markUnknown: TaskRuntime['markUnknown'] = (taskId, errorCode = 'RESULT_UNKNOWN_AFTER_RESTART') => {
    const task = tasks.get(taskId);
    if (!task || task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled') return task ? structuredClone(task) : undefined;
    const generationSlots = task.generationSlots?.map((slot) => slot.state === 'queued' || slot.state === 'running'
      ? { ...slot, state: 'failed' as const, errorCode }
      : slot);
    const unknown = {
      ...task,
      state: 'unknown' as const,
      cancelRequested: false,
      errorCode,
      ...(generationSlots ? { generationSlots } : {}),
      updatedAt: new Date().toISOString(),
    };
    tasks.set(taskId, unknown);
    schedulePersistence();
    return structuredClone(unknown);
  };
  const flush = async (): Promise<void> => {
    if (progressTimer) {
      clearTimeout(progressTimer);
      progressTimer = undefined;
    }
    if (progressDirty) {
      progressDirty = false;
      schedulePersistence();
    }
    await persistence;
  };
  return { get, list, start, run, cancel, complete, fail, updateProgress, updateRemoteMetadata, updateVisualContextPlan, updateGenerationSlot, retryGenerationSlot, settleGenerationBatch, retry, markUnknown, flush };
};
