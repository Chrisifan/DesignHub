import { expect, it, vi } from 'vitest';

import { createTaskRuntime } from './runtime';
import { createDesignGenerationSlots, createTaskState, type TaskRecord } from './state';
import type { RevisionStore } from '../revisions/commit-revision';
import type { VisualContextPlan } from '../agent/visual-context';

const baseTask: TaskRecord = {
  id: 'task-1',
  requestId: 'request-1',
  state: 'running',
  cancelRequested: false,
  attempt: 1,
  source: { kind: 'project', id: 'project-1' },
};

const batchTask = () => ({
  id: 'design-1',
  requestId: 'request-design-1',
  source: { kind: 'project' as const, id: 'project-1' },
  documentId: 'document-1',
  capability: 'design-generation',
  generationSlots: createDesignGenerationSlots(),
});

it('persists a visual context plan on an active conversation task', async () => {
  const writes: Array<readonly TaskRecord[]> = [];
  const runtime = createTaskRuntime({ persist: async (tasks) => { writes.push(tasks); } });
  const task = runtime.start({
    id: 'conversation-1',
    requestId: 'request-1',
    source: { kind: 'project', id: 'project-1' },
    capability: 'conversation',
  });
  const visualContextPlan: VisualContextPlan = {
    version: 1,
    items: [{ assetId: 'asset-a', roles: ['edit-target', 'visual-anchor'], confidence: 1 }],
    clarificationRequired: false,
  };

  runtime.updateVisualContextPlan(task.id, visualContextPlan);
  await runtime.flush();

  expect(runtime.get(task.id)?.visualContextPlan).toEqual(visualContextPlan);
  expect(writes.at(-1)?.[0]?.visualContextPlan).toEqual(visualContextPlan);
});

it('preserves the visual context plan when retrying a task', () => {
  const visualContextPlan: VisualContextPlan = {
    version: 1,
    items: [{ assetId: 'asset-a', roles: ['edit-target'], confidence: 1 }],
    clarificationRequired: false,
  };
  const runtime = createTaskRuntime({
    initialTasks: [{ ...baseTask, state: 'failed', visualContextPlan }],
  });

  const retried = runtime.retry('task-1');

  expect(retried?.visualContextPlan).toEqual(visualContextPlan);
});

it('persists a completed generation slot without waiting for the batch', async () => {
  const writes: Array<readonly TaskRecord[]> = [];
  const runtime = createTaskRuntime({ persist: async (tasks) => { writes.push(tasks); } });
  const task = runtime.start(batchTask());
  const candidate = {
    id: `candidate-${task.id}-primary`,
    baseRevisionId: null,
    assetIds: ['asset-primary'],
    sceneAssetId: 'asset-primary',
    createdAt: '2026-09-20T00:00:00.000Z',
  };

  runtime.updateGenerationSlot(task.id, 'primary', {
    state: 'completed',
    assetId: 'asset-primary',
    candidateId: candidate.id,
    cost: 0.1,
  }, candidate);
  await runtime.flush();

  expect(runtime.get(task.id)).toMatchObject({
    state: 'running',
    result: { assetIds: ['asset-primary'], imageCount: 1, cost: 0.1, candidates: [candidate] },
  });
  expect(writes.at(-1)?.[0]?.result?.candidates).toEqual([candidate]);
});

it('retries only one failed generation slot and preserves completed candidates', () => {
  const runtime = createTaskRuntime();
  const task = runtime.start(batchTask());
  const candidate = {
    id: `candidate-${task.id}-primary`,
    baseRevisionId: null,
    assetIds: ['asset-primary'],
    createdAt: '2026-09-20T00:00:00.000Z',
  };
  runtime.updateGenerationSlot(task.id, 'primary', {
    state: 'completed', assetId: 'asset-primary', candidateId: candidate.id, cost: null,
  }, candidate);
  runtime.updateGenerationSlot(task.id, 'composition', { state: 'failed', errorCode: 'IMAGE_RESULT_EMPTY' });
  runtime.updateGenerationSlot(task.id, 'expressive', { state: 'failed', errorCode: 'IMAGE_RESULT_EMPTY' });

  runtime.retryGenerationSlot(task.id, 'composition');

  expect(runtime.get(task.id)).toMatchObject({
    state: 'running',
    cancelRequested: false,
    result: { candidates: [candidate] },
  });
  expect(runtime.get(task.id)?.generationSlots?.find((slot) => slot.id === 'primary')).toMatchObject({ state: 'completed', attempt: 1 });
  expect(runtime.get(task.id)?.generationSlots?.find((slot) => slot.id === 'composition')).toMatchObject({ state: 'queued', attempt: 2 });
  expect(runtime.get(task.id)?.generationSlots?.[1]?.errorCode).toBeUndefined();
});

it('does not retry a generation slot while another slot is still active', () => {
  const runtime = createTaskRuntime();
  const task = runtime.start(batchTask());
  runtime.updateGenerationSlot(task.id, 'composition', { state: 'failed', errorCode: 'IMAGE_RESULT_EMPTY' });

  expect(() => runtime.retryGenerationSlot(task.id, 'composition')).toThrow('GENERATION_BATCH_ACTIVE');
});

it('does not settle a generation batch until every slot is terminal', async () => {
  const runtime = createTaskRuntime();
  const task = runtime.start(batchTask());
  runtime.updateGenerationSlot(task.id, 'primary', { state: 'failed', errorCode: 'IMAGE_RESULT_EMPTY' });

  await expect(runtime.settleGenerationBatch(task.id)).rejects.toThrow('GENERATION_BATCH_ACTIVE');
  expect(runtime.get(task.id)?.state).toBe('running');
});

it('settles a partially successful generation batch as completed', async () => {
  const runtime = createTaskRuntime();
  const task = runtime.start(batchTask());
  runtime.updateGenerationSlot(task.id, 'primary', { state: 'completed', assetId: 'asset-primary', candidateId: 'candidate-primary', cost: 0.1 }, {
    id: 'candidate-primary', baseRevisionId: null, assetIds: ['asset-primary'], createdAt: '2026-09-20T00:00:00.000Z',
  });
  runtime.updateGenerationSlot(task.id, 'composition', { state: 'failed', errorCode: 'IMAGE_RESULT_EMPTY' });
  runtime.updateGenerationSlot(task.id, 'expressive', { state: 'failed', errorCode: 'PROVIDER_REQUEST_FAILED' });

  await expect(runtime.settleGenerationBatch(task.id)).resolves.toMatchObject({ state: 'completed', result: { imageCount: 1 } });
});

it('settles an all-failed generation batch as failed', async () => {
  const runtime = createTaskRuntime();
  const task = runtime.start(batchTask());
  for (const slot of createDesignGenerationSlots()) runtime.updateGenerationSlot(task.id, slot.id, { state: 'failed', errorCode: 'IMAGE_RESULT_EMPTY' });

  await expect(runtime.settleGenerationBatch(task.id)).resolves.toMatchObject({
    state: 'failed', errorCode: 'DESIGN_GENERATION_ALL_FAILED', result: { imageCount: 0 },
  });
});

it('recovers unfinished generation slots while preserving a successful candidate', () => {
  const slots = createDesignGenerationSlots();
  slots[0] = { ...slots[0]!, state: 'completed', assetId: 'asset-primary', candidateId: 'candidate-design-1-primary', cost: 0.1 };
  slots[1] = { ...slots[1]!, state: 'running' };
  const runtime = createTaskRuntime({
    initialTasks: [{
      ...createTaskState(batchTask()),
      generationSlots: slots,
      result: { candidates: [{ id: 'candidate-design-1-primary', baseRevisionId: null, assetIds: ['asset-primary'], createdAt: '2026-09-20T00:00:00.000Z' }] },
    }],
  });

  expect(runtime.get('design-1')).toMatchObject({ state: 'unknown' });
  expect(runtime.get('design-1')?.generationSlots?.find((slot) => slot.id === 'primary')).toMatchObject({ state: 'completed' });
  expect(runtime.get('design-1')?.generationSlots?.find((slot) => slot.id === 'composition')).toMatchObject({ state: 'failed', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' });
  expect(runtime.get('design-1')?.state).toBe('unknown');
});

it('hydrates persisted tasks and exposes a cloned list', () => {
  const runtime = createTaskRuntime({ initialTasks: [baseTask] });
  const listed = runtime.list();
  listed[0]!.state = 'failed';
  expect(runtime.get('task-1')?.state).toBe('unknown');
  expect(runtime.get('task-1')?.errorCode).toBe('RESULT_UNKNOWN_AFTER_RESTART');
});

it('recovers a completed conversation that has no provider result', async () => {
  const runtime = createTaskRuntime({
    initialTasks: [{
      ...baseTask,
      capability: 'conversation',
      requestText: '恢复这轮分析',
      state: 'completed',
      result: {},
    }],
  });

  expect(runtime.get('task-1')).toMatchObject({ state: 'failed', errorCode: 'EMPTY_PROVIDER_RESPONSE' });
  await runtime.flush();
});

it('persists restart recovery so an interrupted task can be explicitly retried', async () => {
  const writes: Array<readonly TaskRecord[]> = [];
  const runtime = createTaskRuntime({ initialTasks: [baseTask], persist: async (tasks) => { writes.push(tasks); } });
  await runtime.flush();
  expect(writes.at(-1)?.[0]).toMatchObject({ state: 'unknown', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' });
  const retried = runtime.retry('task-1');
  expect(retried).toMatchObject({ state: 'queued', attempt: 2 });
});

it('serializes mutations through one persistence queue', async () => {
  const writes: Array<readonly TaskRecord[]> = [];
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const runtime = createTaskRuntime({
    persist: async (tasks) => {
      writes.push(tasks);
      if (writes.length === 1) await firstWrite;
    },
  });
  runtime.start(baseTask);
  runtime.cancel('task-1');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(writes).toHaveLength(1);
  releaseFirst();
  await runtime.flush();
  expect(writes).toHaveLength(2);
  expect(writes[1]![0]!.cancelRequested).toBe(true);
});

it('completes text tasks without creating an image revision', async () => {
  const runtime = createTaskRuntime();
  runtime.start({ ...baseTask, documentId: undefined });
  const completed = await runtime.complete('task-1', { text: 'drafted brief' });
  expect(completed.state).toBe('completed');
  expect(completed.result).toEqual({ text: 'drafted brief' });
});

it('updates progress in memory and persists it as a coalesced snapshot', async () => {
  const writes: Array<readonly TaskRecord[]> = [];
  const runtime = createTaskRuntime({ persist: async (tasks) => { writes.push(tasks); } });
  runtime.start(baseTask);
  runtime.updateProgress('task-1', '分析中');
  runtime.updateProgress('task-1', '分析中。');
  expect(runtime.get('task-1')?.progressText).toBe('分析中。');
  await runtime.flush();
  expect(writes.at(-1)?.[0]?.progressText).toBe('分析中。');
});

it('marks provider failures and keeps a retryable task record', async () => {
  const runtime = createTaskRuntime();
  runtime.start(baseTask);
  const failed = await runtime.fail('task-1', 'PROVIDER_UNAVAILABLE');
  expect(failed.state).toBe('failed');
  expect(failed.errorCode).toBe('PROVIDER_UNAVAILABLE');
});

it('persists a safe analysis diagnostic on failure and clears it on retry', async () => {
  const runtime = createTaskRuntime();
  runtime.start(baseTask);
  await runtime.fail(
    'task-1',
    'VISION_ANALYSIS_INVALID_RESPONSE',
    undefined,
    'candidate.styleDna.signals.contrast.invalid_percentage',
  );
  expect(runtime.get('task-1')?.analysisDiagnostic).toBe(
    'candidate.styleDna.signals.contrast.invalid_percentage',
  );
  const retried = runtime.retry('task-1');
  expect(retried?.analysisDiagnostic).toBeUndefined();
});

it('creates a new queued attempt when a failed task is explicitly retried', async () => {
  const runtime = createTaskRuntime();
  runtime.start(baseTask);
  await runtime.fail('task-1', 'PROVIDER_UNAVAILABLE');
  const retried = runtime.retry('task-1');
  expect(retried).toBeDefined();
  if (!retried) throw new Error('expected retry task');
  expect(retried.id).not.toBe('task-1');
  expect(retried.state).toBe('queued');
  expect(retried.attempt).toBe(2);
  expect(runtime.get('task-1')?.state).toBe('failed');
  expect(runtime.get(retried.id)?.requestId).toBe('request-1');
});

it('does not commit a hydrated completed task again after restart', async () => {
  const completedTask: TaskRecord = {
    ...baseTask,
    documentId: 'doc-1',
    state: 'completed',
    result: { sceneAssetId: 'scene-1', assetIds: ['asset-1'] },
  };
  const revisionStore = { commitRevision: vi.fn(async () => ({ revisionId: 'revision-duplicate' })) };
  const runtime = createTaskRuntime({ initialTasks: [completedTask] });

  const result = await runtime.finish('task-1', { sceneAssetId: 'scene-1', assetIds: ['asset-1'] }, revisionStore as unknown as RevisionStore);

  expect(result.state).toBe('completed');
  expect(revisionStore.commitRevision).not.toHaveBeenCalled();
});
