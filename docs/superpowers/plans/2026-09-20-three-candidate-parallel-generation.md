# Three-Candidate Parallel Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one design-generation action create three independently updating candidate drafts through three parallel `count: 1` image requests, with partial-success review and per-slot retry.

**Architecture:** Keep one persisted `design-generation` batch task and model its three trusted slots (`primary`, `composition`, `expressive`) explicitly. The task service resolves the immutable context and reference images once, starts the three provider calls concurrently, and persists each slot result immediately; the runtime owns atomic slot state, recovery, retry, and batch settlement. Renderer code normalizes new multi-candidate batches and historical single-candidate tasks into one display model.

**Tech Stack:** TypeScript 5.9, Electron IPC/preload, React 19, Vitest, Testing Library, Playwright, pnpm.

---

## Fixed behavior and file map

The implementation must preserve these invariants:

- The renderer never submits candidate count or direction text.
- A new batch always has exactly three slots in `primary`, `composition`, `expressive` order.
- Every provider call uses `count: 1`; `editImage` remains one image per call and receives no count field.
- All three calls share the persisted task context, image inputs, size, provider, and base revision.
- A completed slot is visible before the other slots settle.
- One or more successful slots completes the batch; zero successes fails it unless it was cancelled.
- Cancelling preserves already-completed candidates and aborts only unfinished calls.
- Retrying a slot reuses the original task context and never regenerates successful slots.
- `result.candidate` remains readable for historical tasks; new batches write `result.candidates`.

File responsibilities:

- `src/features/tasks/state.ts`: public slot types, fixed slot definitions, task/result schema.
- `src/features/tasks/runtime.ts`: atomic slot mutation, retry, settlement, restart recovery, persistence.
- `src/desktop/storage/task-store.ts`: strict JSON validation for slots and candidate arrays.
- `src/features/agent/task-service.ts`: shared-input preparation, parallel provider calls, slot retry/cancel orchestration.
- `src/platform/contracts.ts`: renderer-safe slot retry contract.
- `src/desktop/ipc/agent.ts`: trusted validation and slot retry handler/channel.
- `src/desktop/main.ts`: register the retry handler and enforce writable workspace/project ownership.
- `src/desktop/preload.ts`: expose the retry bridge.
- `src/app/studio/CandidateBoard.tsx`: normalize and render three stable slot cards plus legacy tasks.
- `src/app/studio/Workbench.tsx`: search/select/finalize all candidates and dispatch slot retry.
- `src/app/studio/workbench.css`: batch, failure, and retry card presentation.
- `src/app/studio/LibraryPages.tsx`: batch progress and expandable slot state in the task page.
- `src/app/studio/library.css`: task slot-detail layout.
- Existing colocated tests cover each layer; integration and E2E tests cover persistence and user flow.

### Task 1: Add the batch task domain model

**Files:**
- Modify: `src/features/tasks/state.ts`
- Modify: `src/features/tasks/state.test.ts`

- [ ] **Step 1: Write failing tests for fixed slot creation and result compatibility**

Add tests that pin the trusted order, direction content, initial state, and legacy result shape:

```ts
import { createDesignGenerationSlots, designGenerationSlotIds, type TaskRecord } from './state';

it('creates the three trusted generation slots in stable order', () => {
  expect(designGenerationSlotIds).toEqual(['primary', 'composition', 'expressive']);
  expect(createDesignGenerationSlots()).toEqual([
    expect.objectContaining({ id: 'primary', state: 'queued', attempt: 1 }),
    expect.objectContaining({ id: 'composition', state: 'queued', attempt: 1 }),
    expect.objectContaining({ id: 'expressive', state: 'queued', attempt: 1 }),
  ]);
  const directions = createDesignGenerationSlots().map((slot) => slot.direction).join('\n');
  expect(directions).toContain('准确');
  expect(directions).toContain('构图');
  expect(directions).toContain('大胆');
});

it('keeps the historical single candidate result assignable', () => {
  const task: TaskRecord = {
    id: 'legacy', requestId: 'request-legacy', state: 'completed', cancelRequested: false, attempt: 1,
    result: {
      candidate: { id: 'candidate-legacy', baseRevisionId: null, assetIds: ['asset-legacy'], createdAt: '2026-09-20T00:00:00.000Z' },
    },
  };
  expect(task.result?.candidate?.id).toBe('candidate-legacy');
});
```

- [ ] **Step 2: Run the state tests and verify RED**

Run:

```bash
pnpm exec vitest run src/features/tasks/state.test.ts
```

Expected: FAIL because the slot types and `createDesignGenerationSlots` do not exist.

- [ ] **Step 3: Add the slot types, fixed definitions, and plural result field**

Add these exports near `TaskCandidate`:

```ts
export const designGenerationSlotIds = ['primary', 'composition', 'expressive'] as const;
export type DesignGenerationSlotId = typeof designGenerationSlotIds[number];
export type DesignGenerationSlotState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type DesignGenerationSlot = {
  id: DesignGenerationSlotId;
  direction: string;
  state: DesignGenerationSlotState;
  attempt: number;
  assetId?: string;
  candidateId?: string;
  errorCode?: string;
  providerFailure?: TaskProviderFailure;
  cost?: number | null;
};

const designGenerationDirections: Record<DesignGenerationSlotId, string> = {
  primary: '主方案：准确落实用户需求、内容层级、品牌约束和设计师风格。',
  composition: '构图探索：保持内容、品牌和风格约束，明显改变构图、视觉动线和信息层级。',
  expressive: '视觉突破：保持核心需求和可用性，采用更大胆但仍可交付的视觉表达。',
};

export const createDesignGenerationSlots = (): DesignGenerationSlot[] => designGenerationSlotIds.map((id) => ({
  id,
  direction: designGenerationDirections[id],
  state: 'queued',
  attempt: 1,
}));
```

Extend `taskRecordKeys`, `TaskRecord`, and `TaskRecord['result']`:

```ts
export const taskRecordKeys = new Set<keyof TaskRecord>([
  'id', 'requestId', 'requestText', 'state', 'cancelRequested', 'attempt', 'source', 'documentId',
  'sourceAssetId', 'hasMask', 'baseRevisionId', 'designerVersionId', 'providerId', 'capability',
  'portfolio', 'model', 'size', 'count', 'tool', 'toolParams', 'region', 'createdAt', 'updatedAt',
  'errorCode', 'providerFailure', 'analysisDiagnostic', 'result', 'parentConversationTaskId', 'contextAssetIds', 'contextVersion', 'designContext',
  'analysisThreadId', 'conversationParentTaskId', 'progressText', 'generationSlots',
]);

export type TaskRecord = {
  generationSlots?: DesignGenerationSlot[];
  result?: {
    text?: string;
    assetIds?: string[];
    sceneAssetId?: string;
    imageCount?: number;
    cost?: number | null;
    candidate?: TaskCandidate;
    candidates?: TaskCandidate[];
  };
};
```

Insert `generationSlots?: DesignGenerationSlot[]` after the existing `progressText` field. Insert `candidates?: TaskCandidate[]` after the existing `candidate` result field. All other fields remain byte-for-byte unchanged.

- [ ] **Step 4: Run the state tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/features/tasks/state.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the domain model**

```bash
git add src/features/tasks/state.ts src/features/tasks/state.test.ts
git commit -m "feat: model parallel generation slots"
```

### Task 2: Make TaskRuntime persist and settle slots atomically

**Files:**
- Modify: `src/features/tasks/runtime.ts`
- Modify: `src/features/tasks/runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests for incremental completion, retry, settlement, and recovery**

Add complete tests using a three-slot task fixture:

```ts
const batchTask = () => ({
  id: 'design-1',
  requestId: 'request-1',
  source: { kind: 'project' as const, id: 'project-1' },
  documentId: 'document-1',
  capability: 'design-generation',
  generationSlots: createDesignGenerationSlots(),
});

it('persists a completed slot without waiting for the batch', () => {
  const writes: TaskRecord[][] = [];
  const runtime = createTaskRuntime({ persist: async (tasks) => { writes.push(structuredClone([...tasks])); } });
  const task = runtime.start(batchTask());
  const candidate = { id: `candidate-${task.id}-primary`, baseRevisionId: null, assetIds: ['asset-primary'], sceneAssetId: 'asset-primary', createdAt: '2026-09-20T00:00:00.000Z' };
  runtime.updateGenerationSlot(task.id, 'primary', { state: 'completed', assetId: 'asset-primary', candidateId: candidate.id, cost: 0.1 }, candidate);
  expect(runtime.get(task.id)).toMatchObject({
    state: 'running',
    result: { assetIds: ['asset-primary'], imageCount: 1, cost: 0.1, candidates: [candidate] },
  });
  expect(writes.length).toBeGreaterThan(0);
});

it('retries only one failed slot and preserves completed candidates', () => {
  const runtime = createTaskRuntime();
  const task = runtime.start(batchTask());
  const candidate = { id: `candidate-${task.id}-primary`, baseRevisionId: null, assetIds: ['asset-primary'], createdAt: '2026-09-20T00:00:00.000Z' };
  runtime.updateGenerationSlot(task.id, 'primary', { state: 'completed', assetId: 'asset-primary', candidateId: candidate.id, cost: null }, candidate);
  runtime.updateGenerationSlot(task.id, 'composition', { state: 'failed', errorCode: 'IMAGE_RESULT_EMPTY' });
  runtime.retryGenerationSlot(task.id, 'composition');
  expect(runtime.get(task.id)).toMatchObject({
    state: 'running',
    cancelRequested: false,
    generationSlots: [
      expect.objectContaining({ id: 'primary', state: 'completed', attempt: 1 }),
      expect.objectContaining({ id: 'composition', state: 'queued', attempt: 2, errorCode: undefined }),
    ],
    result: { candidates: [candidate] },
  });
});

it('recovers unfinished slots as retryable while preserving a successful candidate', () => {
  const slots = createDesignGenerationSlots();
  slots[0] = { ...slots[0]!, state: 'completed', assetId: 'asset-primary', candidateId: 'candidate-design-1-primary', cost: 0.1 };
  slots[1] = { ...slots[1]!, state: 'running' };
  const runtime = createTaskRuntime({
    initialTasks: [{ ...createTaskState(batchTask()), generationSlots: slots, result: { candidates: [{ id: 'candidate-design-1-primary', baseRevisionId: null, assetIds: ['asset-primary'], createdAt: '2026-09-20T00:00:00.000Z' }] } }],
  });
  expect(runtime.get('design-1')).toMatchObject({
    state: 'completed',
    generationSlots: [
      expect.objectContaining({ id: 'primary', state: 'completed' }),
      expect.objectContaining({ id: 'composition', state: 'failed', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' }),
    ],
  });
});
```

Also assert `settleGenerationBatch` produces `completed` for one success, `failed/DESIGN_GENERATION_ALL_FAILED` for zero successes, and `cancelled` for a cancelled zero-success batch.

- [ ] **Step 2: Run the runtime tests and verify RED**

```bash
pnpm exec vitest run src/features/tasks/runtime.test.ts
```

Expected: FAIL because slot runtime methods are missing.

- [ ] **Step 3: Extend TaskResult and the runtime interface**

Use the plural candidate result everywhere in the runtime type:

```ts
export type TaskResult = {
  sceneAssetId?: string;
  assetIds?: string[];
  text?: string;
  imageCount?: number;
  cost?: number | null;
  candidate?: TaskCandidate;
  candidates?: TaskCandidate[];
};

export type TaskRuntime = {
  updateGenerationSlot: (
    taskId: string,
    slotId: DesignGenerationSlotId,
    patch: Partial<Omit<DesignGenerationSlot, 'id' | 'direction' | 'attempt'>>,
    candidate?: TaskCandidate,
  ) => TaskRecord | undefined;
  retryGenerationSlot: (taskId: string, slotId: DesignGenerationSlotId) => TaskRecord | undefined;
  settleGenerationBatch: (taskId: string) => Promise<TaskRecord>;
};
```

Import `DesignGenerationSlot`, `DesignGenerationSlotId`, and `designGenerationSlotIds` from `state.ts`.

- [ ] **Step 4: Implement deterministic result aggregation and slot mutation**

Inside `createTaskRuntime`, add one helper and the three methods:

```ts
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
  const slots = task.generationSlots.map((slot) => slot.id === slotId ? { ...slot, ...patch } : slot);
  const candidates = candidate
    ? [...(task.result?.candidates ?? []).filter((item) => item.id !== candidate.id), candidate]
    : task.result?.candidates ?? [];
  const updated = { ...task, generationSlots: slots, result: generationResult(task, slots, candidates), updatedAt: new Date().toISOString() };
  tasks.set(taskId, updated);
  schedulePersistence();
  return structuredClone(updated);
};

const retryGenerationSlot: TaskRuntime['retryGenerationSlot'] = (taskId, slotId) => {
  const task = tasks.get(taskId);
  const current = task?.generationSlots?.find((slot) => slot.id === slotId);
  if (!task || !current || (current.state !== 'failed' && current.state !== 'cancelled')) throw new Error('GENERATION_SLOT_NOT_RETRYABLE');
  const generationSlots = task.generationSlots!.map((slot) => slot.id === slotId ? {
    id: slot.id,
    direction: slot.direction,
    state: 'queued' as const,
    attempt: slot.attempt + 1,
  } : slot);
  const updated = { ...task, state: 'running' as const, cancelRequested: false, errorCode: undefined, providerFailure: undefined, generationSlots, updatedAt: new Date().toISOString() };
  tasks.set(taskId, updated);
  schedulePersistence();
  return structuredClone(updated);
};

const settleGenerationBatch: TaskRuntime['settleGenerationBatch'] = async (taskId) => {
  const task = tasks.get(taskId);
  if (!task?.generationSlots) throw new Error('GENERATION_SLOTS_REQUIRED');
  const hasSuccess = task.generationSlots.some((slot) => slot.state === 'completed');
  const state = hasSuccess ? 'completed' : task.cancelRequested ? 'cancelled' : 'failed';
  const settled = {
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
```

Return all three methods from `createTaskRuntime`.

- [ ] **Step 5: Recover generation batches slot-by-slot**

Replace the current blanket queued/running recovery branch with a generation-aware branch before the existing legacy branch:

```ts
if ((task.state === 'queued' || task.state === 'running') && task.generationSlots?.length) {
  recoveredInterruptedTask = true;
  const generationSlots = task.generationSlots.map((slot) => slot.state === 'queued' || slot.state === 'running'
    ? { ...slot, state: 'failed' as const, errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' }
    : slot);
  const hasSuccess = generationSlots.some((slot) => slot.state === 'completed');
  tasks.set(task.id, structuredClone({
    ...task,
    state: hasSuccess ? 'completed' : 'failed',
    cancelRequested: false,
    generationSlots,
    errorCode: hasSuccess ? undefined : 'RESULT_UNKNOWN_AFTER_RESTART',
    updatedAt: new Date().toISOString(),
  }));
  return;
}
```

Keep the existing recovery behavior unchanged for tasks without `generationSlots`.

- [ ] **Step 6: Run runtime tests and typecheck**

```bash
pnpm exec vitest run src/features/tasks/runtime.test.ts src/features/tasks/state.test.ts
pnpm typecheck
```

Expected: both test files PASS and TypeScript reports no errors.

- [ ] **Step 7: Commit runtime behavior**

```bash
git add src/features/tasks/runtime.ts src/features/tasks/runtime.test.ts
git commit -m "feat: persist generation slot progress"
```

### Task 3: Validate multi-candidate tasks in storage

**Files:**
- Modify: `src/desktop/storage/task-store.ts`
- Modify: `src/desktop/storage/task-store.test.ts`

- [ ] **Step 1: Write failing storage tests**

Add a valid batch fixture and explicit invalid cases:

```ts
it('round-trips a three-slot generation batch and still accepts legacy candidates', async () => {
  const workspace = await createTemporaryWorkspace();
  const batch: TaskRecord = {
    ...task,
    capability: 'design-generation',
    generationSlots: [
      { id: 'primary', direction: 'primary direction', state: 'completed', attempt: 1, assetId: 'asset-a', candidateId: 'candidate-a', cost: 0.1 },
      { id: 'composition', direction: 'composition direction', state: 'failed', attempt: 1, errorCode: 'IMAGE_RESULT_EMPTY' },
      { id: 'expressive', direction: 'expressive direction', state: 'running', attempt: 1 },
    ],
    result: { candidates: [{ id: 'candidate-a', baseRevisionId: null, assetIds: ['asset-a'], createdAt: '2026-09-20T00:00:00.000Z' }] },
  };
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [batch])).resolves.toBe(true);
  await expect(loadTaskState(workspace, workspace.workspace.workspaceId)).resolves.toEqual([batch]);
  workspace.close();
});

it('rejects duplicate or unknown generation slots', async () => {
  const workspace = await createTemporaryWorkspace();
  const duplicate = {
    ...task,
    generationSlots: [
      { id: 'primary', direction: 'a', state: 'queued', attempt: 1 },
      { id: 'primary', direction: 'b', state: 'queued', attempt: 1 },
    ],
  } as unknown as TaskRecord;
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [duplicate])).rejects.toThrow('INVALID_TASK_STATE');
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [{ ...duplicate, generationSlots: [{ id: 'other', direction: 'x', state: 'queued', attempt: 1 }] } as unknown as TaskRecord])).rejects.toThrow('INVALID_TASK_STATE');
  workspace.close();
});
```

Add cases for an unknown slot key, invalid state, attempt `0`, unsafe provider failure, and malformed `result.candidates`.

- [ ] **Step 2: Run storage tests and verify RED**

```bash
pnpm exec vitest run src/desktop/storage/task-store.test.ts
```

Expected: FAIL because `generationSlots` and `candidates` are not accepted.

- [ ] **Step 3: Extract candidate validation and add strict slot validation**

Use validators with explicit allowlists:

```ts
const isTaskCandidate = (value: unknown): value is TaskCandidate => isRecord(value)
  && Object.keys(value).every((key) => ['id', 'baseRevisionId', 'assetIds', 'sceneAssetId', 'analysisThreadId', 'parentConversationTaskId', 'designerVersionId', 'createdAt'].includes(key))
  && typeof value.id === 'string' && value.id.trim().length > 0
  && (value.baseRevisionId === null || typeof value.baseRevisionId === 'string')
  && Array.isArray(value.assetIds) && value.assetIds.every((id) => typeof id === 'string')
  && (value.sceneAssetId === undefined || typeof value.sceneAssetId === 'string')
  && (value.analysisThreadId === undefined || typeof value.analysisThreadId === 'string')
  && (value.parentConversationTaskId === undefined || typeof value.parentConversationTaskId === 'string')
  && (value.designerVersionId === undefined || typeof value.designerVersionId === 'string')
  && typeof value.createdAt === 'string';

const isGenerationSlot = (value: unknown): value is DesignGenerationSlot => isRecord(value)
  && Object.keys(value).every((key) => ['id', 'direction', 'state', 'attempt', 'assetId', 'candidateId', 'errorCode', 'providerFailure', 'cost'].includes(key))
  && designGenerationSlotIds.includes(value.id as DesignGenerationSlotId)
  && typeof value.direction === 'string' && value.direction.trim().length > 0
  && (value.state === 'queued' || value.state === 'running' || value.state === 'completed' || value.state === 'failed' || value.state === 'cancelled')
  && Number.isInteger(value.attempt) && Number(value.attempt) > 0
  && (value.assetId === undefined || typeof value.assetId === 'string')
  && (value.candidateId === undefined || typeof value.candidateId === 'string')
  && (value.errorCode === undefined || typeof value.errorCode === 'string')
  && (value.providerFailure === undefined || isProviderFailure(value.providerFailure))
  && (value.cost === undefined || value.cost === null || (typeof value.cost === 'number' && Number.isFinite(value.cost) && value.cost >= 0));
```

Change `isResult` to accept `candidate` through `isTaskCandidate` and `candidates` only when every entry validates and candidate IDs are unique. In `isTaskRecord`, add:

```ts
  && (value.generationSlots === undefined || isGenerationSlots(value.generationSlots))
```

Define the array validator immediately after `isGenerationSlot`:

```ts
const isGenerationSlots = (value: unknown): value is DesignGenerationSlot[] => Array.isArray(value)
  && value.length === designGenerationSlotIds.length
  && value.every(isGenerationSlot)
  && new Set(value.map((slot) => slot.id)).size === value.length
  && designGenerationSlotIds.every((id, index) => value[index]?.id === id);
```

Import the slot types, IDs, and `TaskCandidate` from `state.ts`.

- [ ] **Step 4: Run storage tests and typecheck**

```bash
pnpm exec vitest run src/desktop/storage/task-store.test.ts
pnpm typecheck
```

Expected: PASS, including historical tasks without the new fields.

- [ ] **Step 5: Commit storage validation**

```bash
git add src/desktop/storage/task-store.ts src/desktop/storage/task-store.test.ts
git commit -m "feat: validate generation batches in task storage"
```

### Task 4: Execute three image requests concurrently

**Files:**
- Modify: `src/features/agent/task-service.ts`
- Modify: `src/features/agent/task-service.test.ts`

- [ ] **Step 1: Add a controllable promise helper and failing parallelism test**

Add this helper to the test file:

```ts
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};
```

Then add a test that proves all requests start before any resolves:

```ts
it('starts three differentiated count-one generation requests concurrently', async () => {
  const runtime = createTaskRuntime();
  const responses = [deferred<ImageResponse>(), deferred<ImageResponse>(), deferred<ImageResponse>()];
  const generateImage = vi.fn((_request) => responses[generateImage.mock.calls.length - 1]!.promise);
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'analysis brief', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, workspaceId: input.workspaceId!, projectId: input.projectId!, documentId: input.documentId!,
      brief: 'Project brief', document: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds, userMessage: input.message, baseRevisionId: 'revision-1',
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${images[0]!.base64}`],
  });
  const conversation = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });

  await vi.waitFor(() => expect(generateImage).toHaveBeenCalledTimes(3));
  expect(generateImage.mock.calls.every(([request]) => request.count === 1)).toBe(true);
  expect(generateImage.mock.calls.map(([request]) => request.prompt)).toEqual([
    expect.stringContaining('主方案'),
    expect.stringContaining('构图探索'),
    expect.stringContaining('视觉突破'),
  ]);
  responses.forEach((response, index) => response.resolve({ images: [{ base64: `image-${index}` }], cost: 0.1 }));
  await service.flush();
  expect(runtime.get(generation.id)).toMatchObject({ state: 'completed', result: { imageCount: 3 } });
});
```

Declare `ImageResponse` in the test as:

```ts
type ImageResponse = { images: Array<{ base64: string; mimeType?: string }>; cost: number | null };
```

- [ ] **Step 2: Add failing tests for shared inputs, edit mode, partial success, all failure, and ordering**

The assertions must cover:

```ts
expect(generateImage).toHaveBeenCalledTimes(3);
const requests = generateImage.mock.calls.map(([request]) => request);
expect(requests[1]?.referenceImages).toBe(requests[0]?.referenceImages);
expect(requests[2]?.referenceImages).toBe(requests[0]?.referenceImages);
expect(editImage).toHaveBeenCalledTimes(3);
expect(editImage.mock.calls.every(([request]) => !Object.hasOwn(request, 'count'))).toBe(true);
expect(partialTask.state).toBe('completed');
expect(partialTask.result?.candidates?.map((candidate) => candidate.id)).toEqual([
  `candidate-${partialTask.id}-primary`,
  `candidate-${partialTask.id}-expressive`,
]);
expect(allFailedTask).toMatchObject({ state: 'failed', errorCode: 'DESIGN_GENERATION_ALL_FAILED', result: { imageCount: 0 } });
```

Use deferred responses resolved in expressive/primary/composition order and assert the final candidates remain primary/composition/expressive.

- [ ] **Step 3: Run task-service tests and verify RED**

```bash
pnpm exec vitest run src/features/agent/task-service.test.ts
```

Expected: FAIL because only one request and one candidate are currently produced.

- [ ] **Step 4: Initialize three slots at submission**

Import the slot helpers and insert this property immediately after `baseRevisionId` in the existing `options.runtime.start` object:

```ts
generationSlots: createDesignGenerationSlots(),
```

- [ ] **Step 5: Prepare immutable shared execution inputs once**

Add a focused helper inside `createAgentTaskService`:

```ts
const prepareDesignGeneration = async (task: TaskRecord) => {
  const context = task.designContext;
  if (!context || task.source?.kind !== 'project' || !task.providerId) throw new Error('DESIGN_CONTEXT_UNAVAILABLE');
  const adapter = await options.resolveAdapter(task.providerId);
  const sourceAssetId = context.document.currentImageAssetIds[0];
  const sourceImage = sourceAssetId && options.loadSourceImage
    ? await options.loadSourceImage({ projectId: task.source.id, assetId: sourceAssetId })
    : null;
  const referenceAssetIds = [...new Set([
    ...(task.contextAssetIds ?? context.attachmentAssetIds),
    ...context.document.currentImageAssetIds,
  ])].filter((assetId) => assetId !== sourceAssetId);
  const loaded = options.loadContextImage
    ? await Promise.all(referenceAssetIds.map((assetId) => options.loadContextImage!({ projectId: task.source!.id, assetId })))
    : [];
  if (loaded.some((image) => !image)) throw new Error('CONTEXT_ASSET_MISSING');
  const referenceImages = loaded.filter((image): image is ConversationImageAttachment => Boolean(image)).map((image) => new Blob(
    [new Uint8Array(image.bytes).buffer as ArrayBuffer],
    { type: image.mimeType },
  ));
  return { context, adapter, sourceImage, referenceImages };
};
```

- [ ] **Step 6: Replace single-image execution with fixed-slot parallel execution**

Use one batch execution promise so `flush()` still waits for the whole batch, while each slot persists independently:

```ts
const generationControllers = new Map<string, Map<DesignGenerationSlotId, AbortController>>();

const executeDesignGeneration = async (task: TaskRecord, onlySlots?: readonly DesignGenerationSlotId[]): Promise<void> => {
  const execution = (async () => {
    const slotIds = onlySlots ?? designGenerationSlotIds;
    let prepared: Awaited<ReturnType<typeof prepareDesignGeneration>>;
    try {
      prepared = await prepareDesignGeneration(task);
    } catch (error) {
      const failure = providerFailure(error);
      for (const slotId of slotIds) options.runtime.updateGenerationSlot(task.id, slotId, {
        state: 'failed',
        errorCode: errorCode(error),
        ...(failure ? { providerFailure: failure } : {}),
      });
      await options.runtime.settleGenerationBatch(task.id);
      return;
    }
    if (options.runtime.get(task.id)?.cancelRequested) {
      for (const slotId of slotIds) options.runtime.updateGenerationSlot(task.id, slotId, {
        state: 'cancelled', errorCode: 'CANCELLED', providerFailure: { kind: 'cancelled' },
      });
      await options.runtime.settleGenerationBatch(task.id);
      return;
    }
    const controllersForTask = new Map<DesignGenerationSlotId, AbortController>();
    generationControllers.set(task.id, controllersForTask);
    for (const slotId of slotIds) options.runtime.updateGenerationSlot(task.id, slotId, { state: 'running' });
    const requests = slotIds.map(async (slotId) => {
      const latest = options.runtime.get(task.id);
      const slot = latest?.generationSlots?.find((candidate) => candidate.id === slotId);
      if (!slot) throw new Error('GENERATION_SLOT_NOT_FOUND');
      const controller = new AbortController();
      controllersForTask.set(slotId, controller);
      try {
        const prompt = `${task.requestText ?? generationPrompt(prepared.context, prepared.context.assistantBrief)}\n\nCandidate direction\n${slot.direction}`;
        const size = `${prepared.context.document.width}x${prepared.context.document.height}`;
        const response = prepared.sourceImage && prepared.adapter.editImage
          ? await prepared.adapter.editImage({ prompt, image: prepared.sourceImage, ...(prepared.referenceImages.length ? { referenceImages: prepared.referenceImages } : {}), size }, controller.signal)
          : prepared.adapter.generateImage
            ? await prepared.adapter.generateImage({ prompt, ...(prepared.referenceImages.length ? { referenceImages: prepared.referenceImages } : {}), size, count: 1 }, controller.signal)
            : undefined;
        const image = response?.images[0];
        if (!response) throw new Error('IMAGE_CAPABILITY_UNAVAILABLE');
        if (!image) throw new Error('IMAGE_RESULT_EMPTY');
        const assetIds = options.persistGeneratedImages
          ? await options.persistGeneratedImages({ projectId: task.source!.id, images: [image] })
          : [];
        const assetId = assetIds[0];
        if (!assetId) throw new Error('IMAGE_ASSET_PERSIST_FAILED');
        const candidate: TaskCandidate = {
          id: `candidate-${task.id}-${slotId}`,
          baseRevisionId: task.baseRevisionId ?? null,
          assetIds: [assetId],
          sceneAssetId: assetId,
          ...(task.parentConversationTaskId ? { parentConversationTaskId: task.parentConversationTaskId } : {}),
          ...(task.analysisThreadId ? { analysisThreadId: task.analysisThreadId } : {}),
          ...(task.designerVersionId ? { designerVersionId: task.designerVersionId } : {}),
          createdAt: new Date().toISOString(),
        };
        options.runtime.updateGenerationSlot(task.id, slotId, {
          state: 'completed', assetId, candidateId: candidate.id, cost: response.cost,
        }, candidate);
      } catch (error) {
        options.runtime.updateGenerationSlot(task.id, slotId, controller.signal.aborted
          ? { state: 'cancelled', errorCode: 'CANCELLED', providerFailure: { kind: 'cancelled' } }
          : { state: 'failed', errorCode: errorCode(error), ...(providerFailure(error) ? { providerFailure: providerFailure(error) } : {}) });
      } finally {
        controllersForTask.delete(slotId);
      }
    });
    await Promise.allSettled(requests);
    generationControllers.delete(task.id);
    await options.runtime.settleGenerationBatch(task.id);
  })().finally(() => { generationControllers.delete(task.id); });
  pending.add(execution);
  void execution.finally(() => pending.delete(execution));
};
```

Change both submission and legacy whole-task retry call sites to call `executeDesignGeneration(task)` without rebuilding mutable project context.

- [ ] **Step 7: Run focused service and provider regression tests**

```bash
pnpm exec vitest run src/features/agent/task-service.test.ts src/features/providers/adapter.test.ts
pnpm typecheck
```

Expected: PASS; the adapter test that rejects `count: 2` remains unchanged and no design-generation test sends it.

- [ ] **Step 8: Commit parallel execution**

```bash
git add src/features/agent/task-service.ts src/features/agent/task-service.test.ts
git commit -m "feat: generate three candidates in parallel"
```

### Task 5: Add slot retry and cancellation semantics

**Files:**
- Modify: `src/features/agent/task-service.ts`
- Modify: `src/features/agent/task-service.test.ts`

- [ ] **Step 1: Write failing service tests for one-slot retry and partial cancellation**

Add a test that completes `primary`, fails `composition`, then retries `composition`:

```ts
await service.retryDesignGenerationSlot({ workspaceId: 'workspace-1', taskId: generation.id, slotId: 'composition' });
await service.flush();
expect(generateImage).toHaveBeenCalledTimes(4);
expect(generateImage.mock.calls[3]?.[0].prompt).toContain('构图探索');
expect(runtime.get(generation.id)?.generationSlots).toEqual([
  expect.objectContaining({ id: 'primary', state: 'completed', attempt: 1 }),
  expect.objectContaining({ id: 'composition', state: 'completed', attempt: 2 }),
  expect.objectContaining({ id: 'expressive', state: 'completed', attempt: 1 }),
]);
```

Add a cancellation test where `primary` resolves before `service.cancel(generation.id)` and the other two promises reject after their signals abort. Assert the final task is `completed`, `primary` remains in `result.candidates`, and the two unfinished slots are `cancelled`.

Also assert retry rejects:

```ts
await expect(service.retryDesignGenerationSlot({ workspaceId: 'workspace-2', taskId: generation.id, slotId: 'composition' })).rejects.toThrow('WORKSPACE_CONTEXT_MISMATCH');
await expect(service.retryDesignGenerationSlot({ workspaceId: 'workspace-1', taskId: generation.id, slotId: 'primary' })).rejects.toThrow('GENERATION_SLOT_NOT_RETRYABLE');
```

- [ ] **Step 2: Run service tests and verify RED**

```bash
pnpm exec vitest run src/features/agent/task-service.test.ts
```

Expected: FAIL because the service method and batch cancellation do not exist.

- [ ] **Step 3: Add the trusted retry input and service method**

Add:

```ts
export type DesignGenerationSlotRetryInput = {
  workspaceId: string;
  taskId: string;
  slotId: DesignGenerationSlotId;
};
```

Extend `AgentTaskService` and implement:

```ts
const retryDesignGenerationSlot = async (input: DesignGenerationSlotRetryInput): Promise<TaskRecord> => {
  const task = options.runtime.get(input.taskId);
  if (!task || task.capability !== 'design-generation' || !task.generationSlots || task.source?.kind !== 'project' || !task.documentId) throw new Error('DESIGN_GENERATION_TASK_REQUIRED');
  if (task.designContext?.workspaceId !== input.workspaceId) throw new Error('WORKSPACE_CONTEXT_MISMATCH');
  const slot = task.generationSlots.find((candidate) => candidate.id === input.slotId);
  if (!slot) throw new Error('GENERATION_SLOT_NOT_FOUND');
  const assetIds = [...new Set([...(task.contextAssetIds ?? []), ...(task.designContext?.document.currentImageAssetIds ?? [])])];
  if (options.loadContextImage && assetIds.length) {
    const assets = await Promise.all(assetIds.map((assetId) => options.loadContextImage!({ projectId: task.source!.id, assetId })));
    if (assets.some((asset) => !asset)) throw new Error('CONTEXT_ASSET_MISSING');
  }
  const retried = options.runtime.retryGenerationSlot(task.id, input.slotId);
  if (!retried) throw new Error('GENERATION_SLOT_NOT_FOUND');
  await executeDesignGeneration(retried, [input.slotId]);
  return retried;
};
```

Expose `retryDesignGenerationSlot` in the returned service object. Also expose the read-only lookup needed by the main-process ownership check:

```ts
getTask: (taskId: string) => TaskRecord | undefined;
```

Implement it as `const getTask = (taskIdValue: string) => options.runtime.get(taskIdValue);` and include `getTask` in the returned object.

- [ ] **Step 4: Abort unfinished slot controllers as a batch**

Update `cancel`:

```ts
const cancel = (taskIdValue: string): TaskRecord | undefined => {
  controllers.get(taskIdValue)?.abort();
  generationControllers.get(taskIdValue)?.forEach((controller) => controller.abort());
  return options.runtime.cancel(taskIdValue);
};
```

In the existing generic `retry`, preserve legacy design-generation retry only for tasks without `generationSlots`:

```ts
if (previous.capability === 'design-generation' && previous.generationSlots?.length) return undefined;
```

- [ ] **Step 5: Run service tests and typecheck**

```bash
pnpm exec vitest run src/features/agent/task-service.test.ts src/features/tasks/runtime.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit retry and cancellation**

```bash
git add src/features/agent/task-service.ts src/features/agent/task-service.test.ts
git commit -m "feat: retry individual generation candidates"
```

### Task 6: Expose slot retry across the desktop trust boundary

**Files:**
- Modify: `src/features/agent/task-service.ts`
- Modify: `src/platform/contracts.ts`
- Modify: `src/desktop/ipc/agent.ts`
- Modify: `src/desktop/ipc/agent.test.ts`
- Modify: `src/desktop/main.ts`
- Modify: `src/desktop/preload.ts`
- Modify: `tests/native/electron-smoke.spec.ts`

- [ ] **Step 1: Write failing IPC validation tests**

Import the new handler and add:

```ts
it('retries only a known generation slot in the active writable workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1', openMode: 'writable' } };
  const retry = createDesignGenerationSlotRetryHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => workspace as never,
    async (_workspace, input) => ({ ...task, id: input.taskId }),
  );
  await expect(retry(fixture.event, { workspaceId: 'workspace-1', taskId: 'design-1', slotId: 'composition' })).resolves.toMatchObject({ id: 'design-1' });
  await expect(retry(fixture.event, { workspaceId: 'workspace-1', taskId: 'design-1', slotId: 'unknown' })).resolves.toBeNull();
  await expect(retry(fixture.event, { workspaceId: 'workspace-2', taskId: 'design-1', slotId: 'composition' })).resolves.toBeNull();
});
```

Update the native API-key assertion to include `retryDesignGenerationSlot`.

- [ ] **Step 2: Run IPC and native smoke tests and verify RED**

```bash
pnpm exec vitest run src/desktop/ipc/agent.test.ts
pnpm exec playwright test tests/native/electron-smoke.spec.ts --config playwright.native.config.ts
```

Expected: the IPC test fails because the new channel/handler is missing; the native assertion fails until preload exposes the method.

- [ ] **Step 3: Add the public bridge contract**

In `src/platform/contracts.ts`, import `DesignGenerationSlotRetryInput` and extend `DesktopApi`:

```ts
retryDesignGenerationSlot?: (input: DesignGenerationSlotRetryInput) => Promise<TaskRecord | null>;
```

- [ ] **Step 4: Add a strict IPC channel and handler**

In `src/desktop/ipc/agent.ts` add:

```ts
export const designGenerationSlotRetryChannel = 'agent:retry-design-generation-slot';

const isDesignGenerationSlotRetryInput = (value: unknown): value is DesignGenerationSlotRetryInput => value !== null
  && typeof value === 'object'
  && isNonEmpty((value as Record<string, unknown>).workspaceId)
  && isNonEmpty((value as Record<string, unknown>).taskId)
  && designGenerationSlotIds.includes((value as Record<string, unknown>).slotId as DesignGenerationSlotId);

export const createDesignGenerationSlotRetryHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  retry: (workspace: WorkspaceHandle, input: DesignGenerationSlotRetryInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isDesignGenerationSlotRetryInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId || workspace.workspace.openMode !== 'writable') return null;
  return retry(workspace, input);
};
```

- [ ] **Step 5: Register main-process validation and preload forwarding**

In `src/desktop/main.ts`, perform project/document validation before launching the provider retry by using the read-only `getTask` method added in Task 5:

```ts
ipcMain.handle(designGenerationSlotRetryChannel, async (event, input) => {
  if (!activeWindow || !activeTrustedUrl) return null;
  return createDesignGenerationSlotRetryHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (workspace, retryInput) => {
    const service = await getAgentTaskService();
    const existing = service.getTask(retryInput.taskId);
    if (!existing || existing.source?.kind !== 'project' || !existing.documentId) throw new Error('DESIGN_GENERATION_TASK_REQUIRED');
    const metadata = await createProjectStore(workspace).getProjectMetadata(existing.source.id);
    if (!metadata || metadata.workspaceId !== retryInput.workspaceId || !metadata.documents.some((document) => document.id === existing.documentId)) throw new Error('DOCUMENT_NOT_FOUND');
    return service.retryDesignGenerationSlot(retryInput);
  })(event, input);
});
```

In `src/desktop/preload.ts`, import the channel and add:

```ts
retryDesignGenerationSlot: (input) => ipcRenderer.invoke(designGenerationSlotRetryChannel, input),
```

- [ ] **Step 6: Run IPC, native, and type checks**

```bash
pnpm exec vitest run src/desktop/ipc/agent.test.ts
pnpm typecheck
pnpm exec playwright test tests/native/electron-smoke.spec.ts --config playwright.native.config.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the bridge**

```bash
git add src/features/agent/task-service.ts src/platform/contracts.ts src/desktop/ipc/agent.ts src/desktop/ipc/agent.test.ts src/desktop/main.ts src/desktop/preload.ts tests/native/electron-smoke.spec.ts
git commit -m "feat: expose candidate slot retry over ipc"
```

### Task 7: Render stable batch slots on the candidate canvas

**Files:**
- Modify: `src/app/studio/CandidateBoard.tsx`
- Modify: `src/app/studio/CandidateBoard.test.tsx`
- Modify: `src/app/studio/workbench.css`

- [ ] **Step 1: Write failing CandidateBoard tests for three skeletons, independent completion, failure retry, order, and focus**

Build a task with three slots and assert:

```tsx
render(<CandidateBoard
  locale="zh-CN"
  tasks={[batch]}
  projectId="project-1"
  analysisThreadId="thread-1"
  width={1080}
  height={1440}
  selectedCandidateId={null}
  onSelect={vi.fn()}
  onRetrySlot={onRetrySlot}
  onRequestFocus={onRequestFocus}
/>);

expect(screen.getAllByLabelText('正在生成设计稿')).toHaveLength(3);
expect(screen.getByTestId('generation-slot-primary')).toBeBefore(screen.getByTestId('generation-slot-composition'));
expect(screen.getByTestId('generation-slot-composition')).toBeBefore(screen.getByTestId('generation-slot-expressive'));
```

Rerender after `primary` completes and `composition` fails:

```tsx
expect(screen.getByAltText('生成候选稿')).toBeVisible();
expect(screen.getAllByLabelText('正在生成设计稿')).toHaveLength(1);
fireEvent.click(screen.getByRole('button', { name: '重新生成构图探索' }));
expect(onRetrySlot).toHaveBeenCalledWith(batch.id, 'composition');
expect(onRequestFocus).toHaveBeenCalledTimes(1);
```

Rerender with all slots complete in reverse response order and assert DOM order is still primary/composition/expressive. Keep the existing legacy single-candidate test.

- [ ] **Step 2: Run CandidateBoard tests and verify RED**

```bash
pnpm exec vitest run src/app/studio/CandidateBoard.test.tsx
```

Expected: FAIL because the board renders one card per task and has no retry callback.

- [ ] **Step 3: Normalize batches and legacy tasks into stable draft items**

Add these local types/helpers:

```ts
type DraftItem = {
  key: string;
  taskId: string;
  slotId?: DesignGenerationSlotId;
  state: DesignGenerationSlotState;
  label: string;
  candidate?: TaskCandidate;
};

const taskDrafts = (task: TaskRecord): DraftItem[] => {
  if (task.generationSlots?.length) {
    const candidates = new Map((task.result?.candidates ?? []).map((candidate) => [candidate.id, candidate]));
    return task.generationSlots.map((slot) => ({
      key: `${task.id}:${slot.id}`,
      taskId: task.id,
      slotId: slot.id,
      state: slot.state,
      label: slot.id,
      ...(slot.candidateId && candidates.has(slot.candidateId) ? { candidate: candidates.get(slot.candidateId) } : {}),
    }));
  }
  if (task.result?.candidate) return [{ key: task.result.candidate.id, taskId: task.id, state: 'completed', label: 'primary', candidate: task.result.candidate }];
  if (task.state === 'queued' || task.state === 'running') return [{ key: task.id, taskId: task.id, state: task.state, label: 'primary' }];
  return [];
};

const slotLabel = (locale: Locale, slotId: DesignGenerationSlotId): string => ({
  primary: locale === 'zh-CN' ? '主方案' : 'Primary',
  composition: locale === 'zh-CN' ? '构图探索' : 'Composition',
  expressive: locale === 'zh-CN' ? '视觉突破' : 'Expressive',
})[slotId];
```

Extend props:

```ts
onRetrySlot?: (taskId: string, slotId: DesignGenerationSlotId) => void;
```

- [ ] **Step 4: Render state-specific cards inside one focusable batch wrapper**

Inside `CandidateBoard`, add a local renderer so it can reuse the current drag refs and offset state:

```tsx
const renderDraft = (draft: DraftItem): React.ReactNode => {
  if (draft.state === 'queued' || draft.state === 'running') return <div
    key={draft.key}
    className="workbench-candidate-card workbench-candidate-card--skeleton"
    data-task-id={draft.taskId}
    data-testid={`generation-slot-${draft.slotId ?? 'legacy'}`}
    style={{ width: displayWidth, flexBasis: displayWidth }}
  >
    <div aria-label={locale === 'zh-CN' ? '正在生成设计稿' : 'Generating design draft'} style={{ aspectRatio: draftAspectRatio }} />
    <span>{locale === 'zh-CN' ? '正在生成…' : 'Generating…'}</span>
  </div>;

  if ((draft.state === 'failed' || draft.state === 'cancelled') && draft.slotId) return <div
    key={draft.key}
    className="workbench-candidate-card workbench-candidate-card--failed"
    data-testid={`generation-slot-${draft.slotId}`}
    style={{ width: displayWidth, flexBasis: displayWidth }}
  >
    <div className="workbench-candidate-card__placeholder" style={{ aspectRatio: draftAspectRatio }}><Icon name="circle-alert" size={22} /></div>
    <span>{locale === 'zh-CN' ? '生成失败' : 'Generation failed'}</span>
    <button type="button" onClick={() => onRetrySlot?.(draft.taskId, draft.slotId!)}>
      {locale === 'zh-CN' ? `重新生成${slotLabel(locale, draft.slotId)}` : `Regenerate ${slotLabel(locale, draft.slotId)}`}
    </button>
  </div>;

  const candidate = draft.candidate;
  if (!candidate) return null;
  const assetId = candidate.sceneAssetId ?? candidate.assetIds[0];
  const preview = assetId ? previews[assetId] : undefined;
  const offset = offsets[candidate.id] ?? { x: 0, y: 0 };
  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = { candidateId: candidate.id, startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y, moved: false };
    setDraggingId(candidate.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.candidateId !== candidate.id) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) > 3) drag.moved = true;
    if (drag.moved) setOffsets((current) => ({ ...current, [candidate.id]: { x: drag.originX + deltaX, y: drag.originY + deltaY } }));
  };
  const endDrag = () => {
    const drag = dragRef.current;
    if (drag?.candidateId === candidate.id && drag.moved) suppressClickRef.current = candidate.id;
    dragRef.current = null;
    setDraggingId(null);
  };
  const select = () => {
    if (suppressClickRef.current === candidate.id) {
      suppressClickRef.current = null;
      return;
    }
    if (assetId) onSelect(candidate.id, assetId);
  };
  return <button
    key={draft.key}
    type="button"
    className={`workbench-candidate-card${selectedCandidateId === candidate.id ? ' is-selected' : ''}`}
    data-testid={`generation-slot-${draft.slotId ?? 'legacy'}`}
    data-candidate-id={candidate.id}
    data-dragging={draggingId === candidate.id || undefined}
    style={{ width: displayWidth, flexBasis: displayWidth, transform: `translate(${offset.x}px, ${offset.y}px)` }}
    aria-pressed={selectedCandidateId === candidate.id}
    onClick={select}
    onPointerDown={beginDrag}
    onPointerMove={moveDrag}
    onPointerUp={endDrag}
    onPointerCancel={endDrag}
  >
    {preview
      ? <img style={{ aspectRatio: draftAspectRatio }} src={preview} alt={locale === 'zh-CN' ? '生成候选稿' : 'Generated candidate'} />
      : <div className="workbench-candidate-card__placeholder" style={{ aspectRatio: draftAspectRatio }}><Icon name="image" size={22} /></div>}
    <span>{draft.slotId ? slotLabel(locale, draft.slotId) : locale === 'zh-CN' ? '候选设计稿' : 'Candidate draft'}</span>
  </button>;
};
```

Group each task's items under:

```tsx
<div
  className="workbench-candidate-batch"
  data-generation-batch-id={task.id}
  ref={task.id === latestDesignTaskId ? (element) => { latestDraftRef.current = element; } : undefined}
>
  {taskDrafts(task).map((draft) => renderDraft(draft))}
</div>
```

Load previews by flattening every `taskDrafts(task).flatMap((draft) => draft.candidate ? [draft.candidate] : [])`. Key preview storage by asset ID exactly as today.

Because `latestDesignTaskId` remains unchanged while slots complete, the `useLayoutEffect` must focus the batch wrapper only once when the batch first appears.

- [ ] **Step 5: Add batch and failed-card CSS**

Add:

```css
.workbench-candidate-batch {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  gap: 24px;
}

.workbench-candidate-card--failed {
  cursor: default;
  touch-action: auto;
}

.workbench-candidate-card--failed > button {
  align-self: flex-start;
  border: 0;
  border-radius: 999px;
  padding: 5px 9px;
  color: var(--on-primary-container);
  background: var(--primary-container);
  cursor: pointer;
}
```

- [ ] **Step 6: Run CandidateBoard tests and typecheck**

```bash
pnpm exec vitest run src/app/studio/CandidateBoard.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit candidate canvas rendering**

```bash
git add src/app/studio/CandidateBoard.tsx src/app/studio/CandidateBoard.test.tsx src/app/studio/workbench.css
git commit -m "feat: render three candidate slots on canvas"
```

### Task 8: Wire selection, finalization, history, and slot retry in Workbench

**Files:**
- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/Workbench.test.tsx`

- [ ] **Step 1: Write failing Workbench tests for plural candidates and slot retry**

Use a completed batch fixture and assert that clicking each generated image selects the corresponding candidate and enables finalization. Use a partial batch fixture and assert:

```tsx
fireEvent.click(screen.getByRole('button', { name: '重新生成构图探索' }));
await waitFor(() => expect(window.designhub.retryDesignGenerationSlot).toHaveBeenCalledWith({
  workspaceId: 'workspace-1',
  taskId: 'design-1',
  slotId: 'composition',
}));
```

Open history and assert all successful candidates are listed, while a failed slot is not offered for finalization. Keep the current legacy candidate tests.

- [ ] **Step 2: Run Workbench tests and verify RED**

```bash
pnpm exec vitest run src/app/studio/Workbench.test.tsx
```

Expected: FAIL because candidate lookup and history only scan `result.candidate`.

- [ ] **Step 3: Centralize candidate normalization**

Add one helper outside the component:

```ts
const taskCandidates = (task: TaskRecord): TaskCandidate[] => task.result?.candidates
  ?? (task.result?.candidate ? [task.result.candidate] : []);
```

Change `candidateFor` to scan `taskCandidates(task)`, and change history rendering from `tasks.filter(...result?.candidate)` to:

```ts
tasks.flatMap((task) => task.state === 'completed'
  ? taskCandidates(task).map((candidate) => ({ task, candidate }))
  : [])
```

Use the flattened `{ task, candidate }` entries in the existing view/compare/continue/finalize markup.

- [ ] **Step 4: Wire slot retry and preserve generation disabling**

Add:

```ts
const retryGenerationSlot = async (taskId: string, slotId: DesignGenerationSlotId): Promise<void> => {
  if (!workspaceId) return;
  const retried = await getDesktopApi().retryDesignGenerationSlot?.({ workspaceId, taskId, slotId });
  if (!retried) return;
  setTasks((current) => current.map((task) => task.id === retried.id ? retried : task));
};
```

Pass it to the board:

```tsx
<CandidateBoard
  locale={locale}
  tasks={tasks}
  workspaceId={workspaceId}
  projectId={project.id}
  analysisThreadId={analysisThreadId}
  width={scene.width}
  height={scene.height}
  displayWidth={draftDisplayWidth}
  selectedCandidateId={selectedCandidateId}
  onSelect={selectCandidate}
  onRetrySlot={(taskId, slotId) => { void retryGenerationSlot(taskId, slotId); }}
  onRequestFocus={centerDraft}
/>
```

Keep `generating` based on batch task state `queued/running`; `retryGenerationSlot` sets the batch back to `running`, so the analysis-panel generation button remains disabled during a retry.

- [ ] **Step 5: Run Workbench tests and typecheck**

```bash
pnpm exec vitest run src/app/studio/Workbench.test.tsx src/app/studio/CandidateBoard.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Workbench integration**

```bash
git add src/app/studio/Workbench.tsx src/app/studio/Workbench.test.tsx
git commit -m "feat: support candidate batches in workbench"
```

### Task 9: Show batch progress and per-slot retry in the task page

**Files:**
- Modify: `src/app/studio/LibraryPages.tsx`
- Modify: `src/app/studio/LibraryPages.test.tsx`
- Modify: `src/app/studio/library.css`

- [ ] **Step 1: Write failing task-page tests**

Render a batch with two completed slots and one failed slot. Assert:

```tsx
expect(screen.getByText('候选生成 2/3')).toBeVisible();
fireEvent.click(screen.getByText('候选生成 2/3'));
expect(screen.getByText('主方案')).toBeVisible();
expect(screen.getByText('构图探索')).toBeVisible();
expect(screen.getByText('视觉突破')).toBeVisible();
fireEvent.click(screen.getByRole('button', { name: '重试构图探索' }));
await waitFor(() => expect(window.designhub.retryDesignGenerationSlot).toHaveBeenCalledWith({
  workspaceId: 'workspace-1', taskId: 'design-1', slotId: 'composition',
}));
expect(window.designhub.retryTask).not.toHaveBeenCalledWith('workspace-1', 'design-1');
```

Keep a test proving legacy failed tasks still use `retryTask`.

- [ ] **Step 2: Run task-page tests and verify RED**

```bash
pnpm exec vitest run src/app/studio/LibraryPages.test.tsx
```

Expected: FAIL because the page has no slot summary or slot retry.

- [ ] **Step 3: Add batch summary and retry updater**

Add:

```ts
const generationProgress = (task: TaskRecord): string | undefined => {
  if (!task.generationSlots?.length) return undefined;
  const completed = task.generationSlots.filter((slot) => slot.state === 'completed').length;
  return t(locale, `候选生成 ${completed}/${task.generationSlots.length}`, `Candidates ${completed}/${task.generationSlots.length}`);
};

const retryGenerationSlot = async (taskId: string, slotId: DesignGenerationSlotId): Promise<void> => {
  if (!workspaceId) return;
  const retried = await getDesktopApi().retryDesignGenerationSlot?.({ workspaceId, taskId, slotId });
  if (!retried) return;
  setTasks((current) => current.map((task) => task.id === taskId ? retried : task));
};
```

Include `generationProgress(task)` in `taskMetadata`, and ensure generic `canRetry` is false when `task.generationSlots?.length` is present.

- [ ] **Step 4: Render expandable slot details**

After each batch row render:

```tsx
{task.generationSlots?.length ? <details className="task-generation-details">
  <summary>{generationProgress(task)}</summary>
  <ul>
    {task.generationSlots.map((slot) => <li key={slot.id}>
      <span>{slotLabel(locale, slot.id)}</span>
      <Badge tone={slot.state === 'completed' ? 'success' : slot.state === 'failed' || slot.state === 'cancelled' ? 'warning' : ''}>{slotStateLabel(locale, slot.state)}</Badge>
      {(slot.state === 'failed' || slot.state === 'cancelled') && <IconButton
        name="rotate-ccw"
        label={t(locale, `重试${slotLabel(locale, slot.id)}`, `Retry ${slotLabel(locale, slot.id)}`)}
        onClick={() => { void retryGenerationSlot(task.id, slot.id); }}
      />}
    </li>)}
  </ul>
</details> : null}
```

Define `slotLabel` and `slotStateLabel` in the same file with exhaustive records for the three IDs and five states.

- [ ] **Step 5: Style the detail row**

```css
.task-generation-details {
  grid-column: 1 / -1;
  padding: 0 16px 12px;
}

.task-generation-details summary {
  color: var(--primary);
  font-size: 12px;
  cursor: pointer;
}

.task-generation-details ul,
.task-generation-details li {
  margin: 0;
  padding: 0;
  list-style: none;
}

.task-generation-details li {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) auto 36px;
  align-items: center;
  gap: 8px;
  min-height: 36px;
}
```

If the current task row cannot legally contain the sibling detail because it is an `<article>`, wrap the row and details in a keyed fragment; do not nest `<details>` inside an interactive control.

- [ ] **Step 6: Run task-page tests and typecheck**

```bash
pnpm exec vitest run src/app/studio/LibraryPages.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit task-page progress UI**

```bash
git add src/app/studio/LibraryPages.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/library.css
git commit -m "feat: show candidate batch progress"
```

### Task 10: Add persistence integration and end-to-end regression coverage

**Files:**
- Create: `tests/integration/design-generation-batch.test.ts`
- Modify: `tests/e2e/agent-workflow.spec.ts`
- Modify: `tests/e2e/test-workspace.ts`

- [ ] **Step 1: Write the integration test for restart recovery and old-task compatibility**

Create a real task-store round trip that saves one completed slot, one running slot, and one failed slot; reopen the workspace; construct `createTaskRuntime({ initialTasks })`; assert the completed candidate survives, the running slot becomes `failed/RESULT_UNKNOWN_AFTER_RESTART`, and only the two failed slots are accepted by `retryGenerationSlot`.

The core assertion must be:

```ts
expect(recovered.get('design-batch-1')).toMatchObject({
  state: 'completed',
  result: { candidates: [expect.objectContaining({ id: 'candidate-design-batch-1-primary' })] },
  generationSlots: [
    expect.objectContaining({ id: 'primary', state: 'completed' }),
    expect.objectContaining({ id: 'composition', state: 'failed', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' }),
    expect.objectContaining({ id: 'expressive', state: 'failed' }),
  ],
});
```

In the same file, round-trip an old `result.candidate` task and assert it is unchanged.

- [ ] **Step 2: Run the integration test and verify it passes against the completed lower layers**

```bash
pnpm exec vitest run tests/integration/design-generation-batch.test.ts
```

Expected: PASS.

- [ ] **Step 3: Extend the E2E workspace stub with a deterministic three-slot lifecycle**

In `tests/e2e/test-workspace.ts`, make the test bridge return one design task that advances on successive `listTasks` calls:

```ts
const generationSlots = createDesignGenerationSlots();
const generationTask: TaskRecord = {
  id: 'design-e2e', requestId: 'request-design-e2e', state: 'running', cancelRequested: false, attempt: 1,
  source: { kind: 'project', id: 'project-e2e' }, documentId: 'document-e2e', capability: 'design-generation',
  analysisThreadId: 'thread-e2e', generationSlots,
};
```

The first poll returns three running slots, the second returns primary completed/composition failed/expressive running, and the third returns primary and expressive completed with composition failed. Implement `retryDesignGenerationSlot` so retrying composition returns the same task ID with composition queued and attempt `2`; later polling returns it completed.

- [ ] **Step 4: Add the E2E user flow**

In `tests/e2e/agent-workflow.spec.ts`, cover:

```ts
await page.getByRole('button', { name: '生成设计稿' }).click();
await expect(page.getByLabel('正在生成设计稿')).toHaveCount(3);
await expect(page.getByAltText('生成候选稿')).toHaveCount(1);
await page.getByRole('button', { name: '重新生成构图探索' }).click();
await expect(page.getByAltText('生成候选稿')).toHaveCount(3);
const candidateIds = await page.locator('[data-candidate-id]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-candidate-id')));
expect(candidateIds).toEqual([
  'candidate-design-e2e-primary',
  'candidate-design-e2e-composition',
  'candidate-design-e2e-expressive',
]);
await page.locator('[data-candidate-id="candidate-design-e2e-expressive"]').click();
await expect(page.getByRole('button', { name: '定稿所选候选' })).toBeEnabled();
```

The stub must not call a real provider and must keep the existing offline E2E path deterministic.

- [ ] **Step 5: Run integration and E2E tests**

```bash
pnpm exec vitest run tests/integration/design-generation-batch.test.ts
pnpm exec playwright test tests/e2e/agent-workflow.spec.ts --config playwright.config.ts
```

Expected: PASS.

- [ ] **Step 6: Commit integration coverage**

```bash
git add tests/integration/design-generation-batch.test.ts tests/e2e/agent-workflow.spec.ts tests/e2e/test-workspace.ts
git commit -m "test: cover three-candidate generation flow"
```

### Task 11: Run the complete acceptance suite

**Files:**
- No source changes expected; fix only failures caused by this feature and commit those fixes separately.

- [ ] **Step 1: Run the focused feature suite**

```bash
pnpm exec vitest run \
  src/features/tasks/state.test.ts \
  src/features/tasks/runtime.test.ts \
  src/desktop/storage/task-store.test.ts \
  src/features/agent/task-service.test.ts \
  src/desktop/ipc/agent.test.ts \
  src/app/studio/CandidateBoard.test.tsx \
  src/app/studio/Workbench.test.tsx \
  src/app/studio/LibraryPages.test.tsx \
  src/app/Studio.test.tsx
```

Expected: PASS with no unhandled rejections.

- [ ] **Step 2: Run project-wide static and unit validation**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run integration, E2E, and production build validation**

```bash
pnpm test:integration
pnpm test:e2e
pnpm build
```

Expected: all commands exit `0`; design generation never triggers `RESPONSES_IMAGE_COUNT_UNSUPPORTED`.

- [ ] **Step 4: Inspect the final diff and task schema**

```bash
git status --short
git diff --check
git log --oneline --decorate -12
```

Expected: no whitespace errors, no unrelated files, and the implementation commits appear after the specification/plan commits.

- [ ] **Step 5: Commit any acceptance-only fixes**

If Step 1–4 required source changes, stage only those files and commit:

```bash
git add src tests
git commit -m "fix: close parallel generation regressions"
```

If no files changed, do not create an empty commit.
