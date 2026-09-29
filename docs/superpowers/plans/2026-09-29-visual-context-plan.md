# Visual Context Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist automatically inferred image roles once during conversation understanding and make every subsequent design-generation request consume that exact visual context plan.

**Architecture:** Add a focused visual-context domain module that validates structured conversation output, merges it with prior anchors, derives conservative legacy plans, and orders images for generation. Conversation tasks make one existing multimodal model call and persist the parsed plan; generation tasks copy that immutable plan, choose its edit target as the primary edit image when supported, and send the remaining role-labelled images as references.

**Tech Stack:** TypeScript 5.9, React 19, Electron 44, Vitest 5, existing JSON task store and OpenAI-compatible provider adapter.

**Spec:** `docs/superpowers/specs/2026-09-29-visual-context-plan-design.md`

## Global Constraints

- Do not add a mandatory role-selection UI.
- Use one conversation-model request per turn; do not add a separate image-classification request.
- Persist only asset IDs, roles, confidence, version, and clarification state; never persist image bytes or hidden model reasoning.
- Existing `tasks.json` records without a plan must remain readable and must not be rewritten in bulk.
- Existing visual anchors remain active unless the structured response names them in `releasedAssetIds`.
- Invalid structured output must retain relevant images through conservative recovery.
- Design generation must stop when `clarificationRequired` is true or an asset is missing.
- All candidate slots and retries must use the same persisted plan.
- Provider error records must not include prompts, image bytes, raw structured output, or credentials.
- Preserve unrelated local modifications; stage and commit only files owned by each task.

---

## File Structure

- Create `src/features/agent/visual-context.ts`: role types, strict validators, structured envelope parsing, conservative legacy derivation, merge safeguards, ordering, image labels, and generation manifest.
- Create `src/features/agent/visual-context.test.ts`: isolated domain tests for parsing, merging, release evidence, conservative recovery, ambiguity, and ordering.
- Modify `src/features/tasks/state.ts`: add optional persisted `visualContextPlan` to `TaskRecord` and its known-key set.
- Modify `src/features/tasks/runtime.ts`: add a persisted active-task plan update operation.
- Modify `src/features/tasks/runtime.test.ts`: prove plan updates persist and retries preserve the plan.
- Modify `src/desktop/storage/task-store.ts`: strictly validate version 1 plans while accepting legacy records.
- Modify `src/desktop/storage/task-store.test.ts`: round-trip valid plans and reject malformed plans.
- Modify `src/features/agent/task-service.ts`: label multimodal messages, parse the one structured response, persist the merged plan, gate clarification, and assemble role-aware generation inputs.
- Modify `src/features/agent/task-service.test.ts`: cover conversation-to-generation continuity, invalid-output recovery, explicit release, missing assets, slot consistency, and retry stability.
- Modify `src/app/studio/ProjectCanvas.tsx`: disable generation while clarification is required.
- Modify `src/app/studio/ProjectCanvas.test.tsx`: verify clarification gating without adding role controls.

---

### Task 1: Visual Context Domain Module

**Files:**
- Create: `src/features/agent/visual-context.ts`
- Create: `src/features/agent/visual-context.test.ts`

**Interfaces:**
- Consumes: asset IDs from project-owned task context and raw conversation-model text.
- Produces: `VisualContextRole`, `VisualContextItem`, `VisualContextPlan`, `ParsedVisualContextEnvelope`, `isVisualContextPlan`, `parseVisualContextEnvelope`, `mergeVisualContextPlan`, `deriveConservativeVisualContextPlan`, `orderedVisualContextItems`, `imageContextLabel`, and `buildGenerationVisualManifest`.

- [ ] **Step 1: Write failing parser and validator tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  isVisualContextPlan,
  parseVisualContextEnvelope,
  type VisualContextPlan,
} from './visual-context';

const plan: VisualContextPlan = {
  version: 1,
  items: [
    { assetId: 'asset-original', roles: ['visual-anchor'], confidence: 0.96 },
    { assetId: 'asset-draft', roles: ['edit-target'], confidence: 0.98 },
  ],
  clarificationRequired: false,
};

describe('visual context envelope', () => {
  it('parses a strict structured conversation response', () => {
    expect(parseVisualContextEnvelope(JSON.stringify({
      brief: '保留原图袖口，修改当前稿背景。',
      visualContext: plan,
      releasedAssetIds: [],
    }))).toEqual({
      brief: '保留原图袖口，修改当前稿背景。',
      visualContextPlan: plan,
      releasedAssetIds: [],
    });
  });

  it('rejects duplicate assets, duplicate roles, unknown roles, and invalid confidence', () => {
    expect(isVisualContextPlan({ ...plan, items: [...plan.items, plan.items[0]] })).toBe(false);
    expect(isVisualContextPlan({ ...plan, items: [{ assetId: 'a', roles: ['visual-anchor', 'visual-anchor'], confidence: 1 }] })).toBe(false);
    expect(isVisualContextPlan({ ...plan, items: [{ assetId: 'a', roles: ['other'], confidence: 1 }] })).toBe(false);
    expect(isVisualContextPlan({ ...plan, items: [{ assetId: 'a', roles: ['visual-anchor'], confidence: 2 }] })).toBe(false);
  });

  it('returns null for plain text or a malformed envelope', () => {
    expect(parseVisualContextEnvelope('普通分析文本')).toBeNull();
    expect(parseVisualContextEnvelope('{"brief":"x"}')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the parser test and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/agent/visual-context.test.ts
```

Expected: FAIL because `visual-context.ts` and its exports do not exist.

- [ ] **Step 3: Implement strict role types and envelope parsing**

```ts
export const visualContextRoles = [
  'edit-target',
  'visual-anchor',
  'content-source',
  'visual-reference',
] as const;

export type VisualContextRole = typeof visualContextRoles[number];

export type VisualContextItem = {
  assetId: string;
  roles: VisualContextRole[];
  confidence: number;
};

export type VisualContextPlan = {
  version: 1;
  items: VisualContextItem[];
  clarificationRequired: boolean;
};

export type ParsedVisualContextEnvelope = {
  brief: string;
  visualContextPlan: VisualContextPlan;
  releasedAssetIds: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isVisualContextPlan = (value: unknown): value is VisualContextPlan => {
  if (!isRecord(value) || value.version !== 1 || typeof value.clarificationRequired !== 'boolean' || !Array.isArray(value.items)) return false;
  const assetIds = new Set<string>();
  return value.items.every((candidate) => {
    if (!isRecord(candidate) || typeof candidate.assetId !== 'string' || !candidate.assetId.trim() || assetIds.has(candidate.assetId)) return false;
    if (!Array.isArray(candidate.roles) || candidate.roles.length === 0 || new Set(candidate.roles).size !== candidate.roles.length) return false;
    if (!candidate.roles.every((role) => typeof role === 'string' && (visualContextRoles as readonly string[]).includes(role))) return false;
    if (typeof candidate.confidence !== 'number' || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) return false;
    assetIds.add(candidate.assetId);
    return true;
  });
};

export const parseVisualContextEnvelope = (text: string): ParsedVisualContextEnvelope | null => {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!isRecord(parsed) || typeof parsed.brief !== 'string' || !parsed.brief.trim()) return null;
  if (!isVisualContextPlan(parsed.visualContext) || !Array.isArray(parsed.releasedAssetIds)) return null;
  if (!parsed.releasedAssetIds.every((id) => typeof id === 'string' && id.trim())) return null;
  if (new Set(parsed.releasedAssetIds).size !== parsed.releasedAssetIds.length) return null;
  return {
    brief: parsed.brief.trim(),
    visualContextPlan: structuredClone(parsed.visualContext),
    releasedAssetIds: [...parsed.releasedAssetIds],
  };
};
```

- [ ] **Step 4: Run the parser test and verify GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/agent/visual-context.test.ts
```

Expected: PASS for all parser and validator cases.

- [ ] **Step 5: Write failing merge, fallback, ordering, and label tests**

```ts
import {
  buildGenerationVisualManifest,
  deriveConservativeVisualContextPlan,
  imageContextLabel,
  mergeVisualContextPlan,
  orderedVisualContextItems,
} from './visual-context';

it('retains a prior anchor unless release evidence names it', () => {
  const previous: VisualContextPlan = {
    version: 1,
    items: [{ assetId: 'asset-original', roles: ['visual-anchor'], confidence: 0.9 }],
    clarificationRequired: false,
  };
  const proposed: VisualContextPlan = {
    version: 1,
    items: [{ assetId: 'asset-draft', roles: ['edit-target'], confidence: 0.9 }],
    clarificationRequired: false,
  };
  expect(mergeVisualContextPlan({ previous, proposed, releasedAssetIds: [], requiredAssetIds: ['asset-draft'], knownAssetIds: ['asset-original', 'asset-draft'] }).items)
    .toEqual([
      { assetId: 'asset-original', roles: ['visual-anchor'], confidence: 0.9 },
      { assetId: 'asset-draft', roles: ['edit-target'], confidence: 0.9 },
    ]);
  expect(mergeVisualContextPlan({ previous, proposed, releasedAssetIds: ['asset-original'], requiredAssetIds: ['asset-draft'], knownAssetIds: ['asset-original', 'asset-draft'] }).items)
    .toEqual([{ assetId: 'asset-draft', roles: ['edit-target'], confidence: 0.9 }]);
});

it('derives a conservative ambiguous plan without inventing an edit target', () => {
  expect(deriveConservativeVisualContextPlan({
    previous: undefined,
    initialAttachmentAssetIds: ['asset-a', 'asset-b'],
    currentAssetIds: [],
    canvasAssetIds: [],
  })).toEqual({
    version: 1,
    items: [
      { assetId: 'asset-a', roles: ['visual-anchor', 'visual-reference'], confidence: 0 },
      { assetId: 'asset-b', roles: ['visual-anchor', 'visual-reference'], confidence: 0 },
    ],
    clarificationRequired: true,
  });
});

it('orders one uploaded image once by its highest-priority role', () => {
  const items = orderedVisualContextItems({
    version: 1,
    items: [
      { assetId: 'style', roles: ['visual-reference'], confidence: 1 },
      { assetId: 'target', roles: ['edit-target', 'visual-anchor'], confidence: 1 },
      { assetId: 'source', roles: ['content-source'], confidence: 1 },
    ],
    clarificationRequired: false,
  });
  expect(items.map((item) => item.assetId)).toEqual(['target', 'source', 'style']);
  expect(imageContextLabel(items[0]!, 'generated')).toContain('assetId=target');
  expect(buildGenerationVisualManifest(items)).toContain('Image 1: assetId=target; roles=edit-target,visual-anchor');
});
```

- [ ] **Step 6: Run the expanded domain test and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/agent/visual-context.test.ts
```

Expected: FAIL because merge, fallback, ordering, and label helpers are not exported.

- [ ] **Step 7: Implement deterministic merge and presentation helpers**

```ts
const rolePriority: Record<VisualContextRole, number> = {
  'edit-target': 0,
  'visual-anchor': 1,
  'content-source': 2,
  'visual-reference': 3,
};

export const mergeVisualContextPlan = (input: {
  previous?: VisualContextPlan;
  proposed: VisualContextPlan;
  releasedAssetIds: readonly string[];
  requiredAssetIds: readonly string[];
  knownAssetIds: readonly string[];
}): VisualContextPlan => {
  const known = new Set(input.knownAssetIds);
  const released = new Set(input.releasedAssetIds.filter((id) => known.has(id)));
  const merged = new Map(input.proposed.items.filter((item) => known.has(item.assetId)).map((item) => [item.assetId, structuredClone(item)]));
  for (const previous of input.previous?.items ?? []) {
    if (released.has(previous.assetId) || !known.has(previous.assetId)) continue;
    const current = merged.get(previous.assetId);
    if (!current && previous.roles.includes('visual-anchor')) merged.set(previous.assetId, structuredClone(previous));
    else if (current && previous.roles.includes('visual-anchor') && !current.roles.includes('visual-anchor')) current.roles.push('visual-anchor');
  }
  for (const assetId of input.requiredAssetIds) {
    if (known.has(assetId) && !merged.has(assetId)) merged.set(assetId, { assetId, roles: ['visual-reference'], confidence: 0 });
  }
  return { version: 1, items: [...merged.values()], clarificationRequired: input.proposed.clarificationRequired };
};

export const orderedVisualContextItems = (plan: VisualContextPlan): VisualContextItem[] =>
  [...plan.items].sort((left, right) =>
    Math.min(...left.roles.map((role) => rolePriority[role])) - Math.min(...right.roles.map((role) => rolePriority[role]))
    || left.assetId.localeCompare(right.assetId));

export const imageContextLabel = (item: VisualContextItem, origin: string): string =>
  `[DesignHub image: assetId=${item.assetId}; origin=${origin}; roles=${item.roles.join(',')}]`;

export const buildGenerationVisualManifest = (items: readonly VisualContextItem[]): string => [
  'Visual input manifest:',
  ...items.map((item, index) => `Image ${index + 1}: assetId=${item.assetId}; roles=${item.roles.join(',')}`),
].join('\n');
```

```ts
export const deriveConservativeVisualContextPlan = (input: {
  previous?: VisualContextPlan;
  initialAttachmentAssetIds: readonly string[];
  currentAssetIds: readonly string[];
  canvasAssetIds: readonly string[];
}): VisualContextPlan => {
  const items = new Map((input.previous?.items ?? []).map((item) => [item.assetId, structuredClone(item)]));
  const current = [...new Set(input.currentAssetIds)];
  if (current.length === 1) {
    for (const item of items.values()) item.roles = item.roles.filter((role) => role !== 'edit-target');
    const item = items.get(current[0]!) ?? { assetId: current[0]!, roles: [], confidence: 0 };
    item.roles = [...new Set<VisualContextRole>(['edit-target', ...item.roles])];
    items.set(item.assetId, item);
  }
  for (const assetId of input.initialAttachmentAssetIds) {
    const item = items.get(assetId) ?? { assetId, roles: [], confidence: 0 };
    item.roles = [...new Set<VisualContextRole>([...item.roles, 'visual-anchor', 'visual-reference'])];
    items.set(assetId, item);
  }
  if (![...items.values()].some((item) => item.roles.includes('edit-target')) && input.canvasAssetIds.length === 1) {
    const assetId = input.canvasAssetIds[0]!;
    const item = items.get(assetId) ?? { assetId, roles: [], confidence: 0 };
    item.roles = [...new Set<VisualContextRole>(['edit-target', 'visual-anchor', ...item.roles])];
    items.set(assetId, item);
  }
  const result = [...items.values()];
  return {
    version: 1,
    items: result,
    clarificationRequired: result.filter((item) => item.roles.includes('edit-target')).length !== 1,
  };
};
```

- [ ] **Step 8: Run the domain test and verify GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/agent/visual-context.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit the domain module**

```bash
git add src/features/agent/visual-context.ts src/features/agent/visual-context.test.ts
git commit -m "feat: model visual context plans"
```

---

### Task 2: Persist Plans In Task State

**Files:**
- Modify: `src/features/tasks/state.ts`
- Modify: `src/features/tasks/runtime.ts`
- Modify: `src/features/tasks/runtime.test.ts`
- Modify: `src/desktop/storage/task-store.ts`
- Modify: `src/desktop/storage/task-store.test.ts`

**Interfaces:**
- Consumes: `VisualContextPlan` and `isVisualContextPlan` from Task 1.
- Produces: optional `TaskRecord.visualContextPlan` and `TaskRuntime.updateVisualContextPlan(taskId, plan)`.

- [ ] **Step 1: Write failing runtime persistence and retry tests**

```ts
import type { VisualContextPlan } from '../agent/visual-context';

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
  const runtime = createTaskRuntime({ initialTasks: [{
    ...baseTask,
    state: 'failed',
    visualContextPlan: {
      version: 1,
      items: [{ assetId: 'asset-a', roles: ['edit-target'], confidence: 1 }],
      clarificationRequired: false,
    },
  }] });
  const retried = runtime.retry('task-1');
  expect(retried?.visualContextPlan).toEqual(runtime.get('task-1')?.visualContextPlan);
});
```

- [ ] **Step 2: Write failing task-store validation tests**

```ts
it('round-trips a valid visual context plan and still accepts a legacy task', async () => {
  const workspace = await createTemporaryWorkspace();
  const planned: TaskRecord = {
    ...task,
    visualContextPlan: {
      version: 1,
      items: [{ assetId: 'asset-a', roles: ['edit-target', 'visual-anchor'], confidence: 0.95 }],
      clarificationRequired: false,
    },
  };
  await expect(saveTaskState(workspace, workspace.library.libraryId, [task, planned])).resolves.toBe(true);
  await expect(loadTaskState(workspace, workspace.library.libraryId)).resolves.toEqual([task, planned]);
  workspace.close();
});

it('rejects malformed visual context plans', async () => {
  const workspace = await createTemporaryWorkspace();
  await expect(saveTaskState(workspace, workspace.library.libraryId, [{
    ...task,
    visualContextPlan: {
      version: 1,
      items: [{ assetId: 'asset-a', roles: ['unknown'], confidence: 2 }],
      clarificationRequired: false,
    },
  } as unknown as TaskRecord])).rejects.toThrow('INVALID_TASK_STATE');
  workspace.close();
});
```

- [ ] **Step 3: Run focused state tests and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/tasks/runtime.test.ts src/desktop/storage/task-store.test.ts
```

Expected: FAIL because `visualContextPlan` is not a known task key and `updateVisualContextPlan` does not exist.

- [ ] **Step 4: Add the persisted field and runtime mutation**

In `state.ts`:

```ts
import type { VisualContextPlan } from '../agent/visual-context';

export const taskRecordKeys = new Set<keyof TaskRecord>([
  // existing keys
  'visualContextPlan',
]);

export type TaskRecord = {
  // existing fields
  visualContextPlan?: VisualContextPlan;
};
```

In `runtime.ts`:

```ts
updateVisualContextPlan: (taskId: string, plan: VisualContextPlan) => TaskRecord | undefined;

const updateVisualContextPlan: TaskRuntime['updateVisualContextPlan'] = (taskId, plan) => {
  const task = tasks.get(taskId);
  if (!task || ['completed', 'failed', 'cancelled', 'unknown'].includes(task.state)) return task ? structuredClone(task) : undefined;
  const updated = { ...task, visualContextPlan: structuredClone(plan), updatedAt: new Date().toISOString() };
  tasks.set(taskId, updated);
  schedulePersistence();
  return structuredClone(updated);
};
```

Return `updateVisualContextPlan` from `createTaskRuntime`.

- [ ] **Step 5: Validate the field in the task store**

```ts
import { isVisualContextPlan } from '../../features/agent/visual-context';

// Add to isTaskRecord:
&& (value.visualContextPlan === undefined || isVisualContextPlan(value.visualContextPlan))
```

Add `visualContextPlan` to `taskRecordKeys`; do not require it on historical records.

- [ ] **Step 6: Run focused state tests and verify GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/tasks/runtime.test.ts src/desktop/storage/task-store.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit task persistence**

```bash
git add src/features/tasks/state.ts src/features/tasks/runtime.ts src/features/tasks/runtime.test.ts src/desktop/storage/task-store.ts src/desktop/storage/task-store.test.ts
git commit -m "feat: persist task visual context plans"
```

---

### Task 3: Produce One Structured Conversation Analysis

**Files:**
- Modify: `src/features/agent/visual-context.ts`
- Modify: `src/features/agent/visual-context.test.ts`
- Modify: `src/features/agent/task-service.ts`
- Modify: `src/features/agent/task-service.test.ts`

**Interfaces:**
- Consumes: existing `ConversationAdapter.chat` or `streamChat`, task history, stored attachments, prior plan, and current project assets.
- Produces: one provider request whose result text is a structured envelope, a user-visible `brief`, and a persisted merged `visualContextPlan`.

- [ ] **Step 1: Write a failing prompt contract test**

```ts
import { buildVisualContextAnalysisInstruction } from './visual-context';

it('requires one strict response envelope with explicit release evidence', () => {
  const instruction = buildVisualContextAnalysisInstruction({
    knownAssetIds: ['asset-original', 'asset-draft'],
    previousPlan: {
      version: 1,
      items: [{ assetId: 'asset-original', roles: ['visual-anchor'], confidence: 1 }],
      clarificationRequired: false,
    },
  });
  expect(instruction).toContain('releasedAssetIds');
  expect(instruction).toContain('asset-original');
  expect(instruction).toContain('Return JSON only');
  expect(instruction).toContain('Ask one clarification question');
});
```

- [ ] **Step 2: Write a failing service test for labelled images and parsed output**

```ts
it('labels image IDs, publishes only the brief, and persists the inferred plan', async () => {
  const runtime = createTaskRuntime();
  const requests: ChatRequest[] = [];
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async (request) => {
        requests.push(request);
        return { text: JSON.stringify({
          brief: '修改图一并参考图二构图。',
          visualContext: {
            version: 1,
            items: [
              { assetId: 'asset-a', roles: ['edit-target', 'visual-anchor'], confidence: 0.98 },
              { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0.94 },
            ],
            clarificationRequired: false,
          },
          releasedAssetIds: [],
        }), cost: null };
      },
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId!, projectId: input.projectId!, documentId: input.documentId!,
      brief: '', document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds,
      userMessage: input.message, baseRevisionId: null,
    }),
    persistConversationAttachments: async () => ['asset-a', 'asset-b'],
    loadContextImage: async ({ assetId }) => ({ name: `${assetId}.png`, mimeType: 'image/png', bytes: new Uint8Array([1]) }),
  });

  const task = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    message: '修改图一并参考图二构图',
    attachments: [
      { name: 'a.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'b.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();

  const content = requests[0]!.messages.at(-1)!.content;
  expect(JSON.stringify(content)).toContain('assetId=asset-a');
  expect(JSON.stringify(content)).toContain('assetId=asset-b');
  expect(runtime.get(task.id)?.result?.text).toBe('修改图一并参考图二构图。');
  expect(runtime.get(task.id)?.progressText).toBe('修改图一并参考图二构图。');
  expect(runtime.get(task.id)?.visualContextPlan?.items).toHaveLength(2);
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/agent/visual-context.test.ts src/features/agent/task-service.test.ts -t "labels image IDs|requires one strict response"
```

Expected: FAIL because the analysis instruction and structured conversation handling are absent.

- [ ] **Step 4: Implement the analysis instruction**

```ts
export const buildVisualContextAnalysisInstruction = (input: {
  knownAssetIds: readonly string[];
  previousPlan?: VisualContextPlan;
}): string => [
  'Return JSON only with keys brief, visualContext, and releasedAssetIds.',
  'visualContext must contain version: 1, items, and clarificationRequired.',
  'Allowed roles: edit-target, visual-anchor, content-source, visual-reference.',
  'Every currently supplied image must appear in items. One image may have multiple roles.',
  'Keep previous visual-anchor roles unless the user explicitly asks to stop using them.',
  'Only list an existing asset in releasedAssetIds when the current user message explicitly releases it.',
  'If no single edit target can be determined, set clarificationRequired true and make brief ask one clarification question.',
  `Known asset IDs: ${input.knownAssetIds.join(', ') || 'none'}`,
  `Previous plan: ${JSON.stringify(input.previousPlan ?? null)}`,
].join('\n');
```

- [ ] **Step 5: Refactor conversation message construction to label stored images**

Represent each loaded asset as `{ assetId, attachment }` and emit a text label immediately before its image part:

```ts
const imageParts = (assetId: string, attachment: ConversationImageAttachment, roles: VisualContextRole[] = []) => [
  { type: 'text' as const, text: `[DesignHub image: assetId=${assetId}; roles=${roles.join(',') || 'unclassified'}]` },
  { type: 'image_url' as const, image_url: { url: attachmentDataUrl(attachment) } },
];
```

Append `buildVisualContextAnalysisInstruction(...)` to the system message. Continue to send all historical text and images in chronological order.

- [ ] **Step 6: Parse once, merge safeguards, and persist before completion**

After accumulating either streaming or non-streaming provider text:

```ts
const parsed = parseVisualContextEnvelope(text);
const conservative = deriveConservativeVisualContextPlan({
  previous: parent?.visualContextPlan,
  initialAttachmentAssetIds: task.designContext?.attachmentAssetIds ?? [],
  currentAssetIds,
  canvasAssetIds: task.designContext?.document.currentImageAssetIds ?? [],
});
const visualContextPlan = parsed
  ? mergeVisualContextPlan({
      previous: parent?.visualContextPlan,
      proposed: parsed.visualContextPlan,
      releasedAssetIds: parsed.releasedAssetIds,
      requiredAssetIds: currentAssetIds,
      knownAssetIds,
    })
  : conservative;
const brief = parsed?.brief ?? text.trim();
runtime.updateVisualContextPlan(task.id, visualContextPlan);
publishProgress(brief, true);
await runtime.complete(task.id, { text: brief, cost });
```

Do not publish the raw structured stream. Existing plain-text provider responses remain valid through conservative recovery.

- [ ] **Step 7: Add failing recovery, anchor-release, and ambiguity tests**

```ts
const createConversationPlanHarness = (responses: string[]) => {
  const runtime = createTaskRuntime();
  let responseIndex = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: responses[responseIndex++]!, cost: null }),
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId!,
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: '',
      document: { width: 100, height: 100, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    persistConversationAttachments: async ({ attachments }) =>
      attachments.map((attachment) => attachment.name.replace(/\.png$/u, '')),
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`, mimeType: 'image/png', bytes: new Uint8Array([1]),
    }),
  });
  return { runtime, service };
};

it('recovers plain text without dropping initial attachments', async () => {
  const { runtime, service } = createConversationPlanHarness(['普通分析文本']);
  const task = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    connectionId: 'provider-1', message: '比较两张图',
    attachments: [
      { name: 'asset-a.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'asset-b.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();
  expect(runtime.get(task.id)?.result?.text).toBe('普通分析文本');
  expect(runtime.get(task.id)?.visualContextPlan?.items.map((item) => item.assetId).sort())
    .toEqual(['asset-a', 'asset-b']);
});

it('removes an anchor only when releasedAssetIds names it', async () => {
  const envelope = (releasedAssetIds: string[]) => JSON.stringify({
    brief: '继续修改当前稿。',
    visualContext: {
      version: 1,
      items: [{ assetId: 'asset-draft', roles: ['edit-target'], confidence: 1 }],
      clarificationRequired: false,
    },
    releasedAssetIds,
  });
  const firstEnvelope = JSON.stringify({
    brief: '以原图为基础。',
    visualContext: {
      version: 1,
      items: [{ assetId: 'asset-original', roles: ['edit-target', 'visual-anchor'], confidence: 1 }],
      clarificationRequired: false,
    },
    releasedAssetIds: [],
  });
  const { runtime, service } = createConversationPlanHarness([firstEnvelope, envelope([]), envelope(['asset-original'])]);
  const first = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    message: '以原图为基础', attachments: [{ name: 'asset-original.png', mimeType: 'image/png', bytes: new Uint8Array([1]) }],
  });
  await service.flush();
  const second = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    analysisThreadId: first.analysisThreadId, conversationParentTaskId: first.id,
    referencedAssetIds: ['asset-draft'], message: '继续修改当前稿',
  });
  await service.flush();
  expect(runtime.get(second.id)?.visualContextPlan?.items.some((item) => item.assetId === 'asset-original' && item.roles.includes('visual-anchor'))).toBe(true);
  const third = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    analysisThreadId: first.analysisThreadId, conversationParentTaskId: second.id,
    referencedAssetIds: ['asset-draft'], message: '只使用当前稿，不再参考原图',
  });
  await service.flush();
  expect(runtime.get(third.id)?.visualContextPlan?.items.some((item) => item.assetId === 'asset-original')).toBe(false);
});

it('stores a clarification plan when no edit target is identifiable', async () => {
  const response = JSON.stringify({
    brief: '你希望修改图一还是图二？',
    visualContext: {
      version: 1,
      items: [
        { assetId: 'asset-a', roles: ['visual-reference'], confidence: 0.4 },
        { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0.4 },
      ],
      clarificationRequired: true,
    },
    releasedAssetIds: [],
  });
  const { runtime, service } = createConversationPlanHarness([response]);
  const task = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    message: '调整一下', attachments: [
      { name: 'asset-a.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'asset-b.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({
    state: 'completed',
    result: { text: '你希望修改图一还是图二？' },
    visualContextPlan: { clarificationRequired: true },
  });
});
```

- [ ] **Step 8: Run the complete conversation service tests and verify GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/agent/visual-context.test.ts src/features/agent/task-service.test.ts
```

Expected: PASS, including existing plain-text conversation tests.

- [ ] **Step 9: Commit structured conversation analysis**

```bash
git add src/features/agent/visual-context.ts src/features/agent/visual-context.test.ts src/features/agent/task-service.ts src/features/agent/task-service.test.ts
git commit -m "feat: infer visual roles during conversation"
```

---

### Task 4: Consume The Persisted Plan During Generation

**Files:**
- Modify: `src/features/agent/task-service.ts`
- Modify: `src/features/agent/task-service.test.ts`

**Interfaces:**
- Consumes: parent `TaskRecord.visualContextPlan`, `orderedVisualContextItems`, and `buildGenerationVisualManifest`.
- Produces: generation tasks that copy the plan, ordered provider inputs, a primary edit image when available, and legacy derivation only when no plan exists.

- [ ] **Step 1: Write a failing continuity test reproducing the reported thread**

```ts
it('keeps original anchors and references when a generated draft becomes the edit target', async () => {
  const runtime = createTaskRuntime();
  const editImage = vi.fn(async () => ({ images: [{ base64: 'result' }], cost: null }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'unused', cost: null }), editImage }),
    persistGeneratedImages: async () => ['asset-result'],
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`, mimeType: 'image/png', bytes: new Uint8Array([
        assetId === 'asset-draft' ? 3 : assetId === 'asset-original' ? 1 : 2,
      ]),
    }),
  });
  const conversation = runtime.start({
    id: 'conversation-1', requestId: 'request-1', capability: 'conversation',
    source: { kind: 'project', id: 'project-1' }, providerId: 'provider-1',
    analysisThreadId: 'analysis-1', requestText: '保持原图袖口，修改当前稿背景',
    designContext: {
      version: 1, libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', brief: '',
      document: { width: 100, height: 100, currentImageAssetIds: [] },
      attachmentAssetIds: ['asset-original', 'asset-style'], userMessage: 'first', baseRevisionId: null,
    },
    visualContextPlan: {
      version: 1,
      items: [
        { assetId: 'asset-draft', roles: ['edit-target'], confidence: 1 },
        { assetId: 'asset-original', roles: ['visual-anchor'], confidence: 1 },
        { assetId: 'asset-style', roles: ['visual-reference'], confidence: 1 },
      ],
      clarificationRequired: false,
    },
  });
  await runtime.complete(conversation.id, { text: 'brief' });

  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: conversation.id, connectionId: 'provider-1', count: 1,
  });
  await service.flush();

  expect(generation.visualContextPlan).toEqual(runtime.get(conversation.id)?.visualContextPlan);
  expect(editImage).toHaveBeenCalledTimes(1);
  const request = editImage.mock.calls[0]![0];
  expect(await request.image.arrayBuffer()).toEqual(new Uint8Array([3]).buffer);
  expect(request.referenceImages).toHaveLength(2);
  expect(request.prompt).toContain('Image 1: assetId=asset-draft; roles=edit-target');
  expect(request.prompt).toContain('assetId=asset-original; roles=visual-anchor');
  expect(request.prompt).toContain('assetId=asset-style; roles=visual-reference');
});
```

- [ ] **Step 2: Write failing clarification and missing-asset tests**

```ts
const completedConversationWithPlan = async (runtime: TaskRuntime, visualContextPlan: VisualContextPlan) => {
  const task = runtime.start({
    id: `conversation-${crypto.randomUUID()}`,
    requestId: `request-${crypto.randomUUID()}`,
    capability: 'conversation',
    source: { kind: 'project', id: 'project-1' },
    providerId: 'provider-1',
    requestText: 'design request',
    visualContextPlan,
    designContext: {
      version: 1, libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', brief: '',
      document: { width: 100, height: 100, currentImageAssetIds: [] },
      attachmentAssetIds: [], userMessage: 'design request', baseRevisionId: null,
    },
  });
  await runtime.complete(task.id, { text: 'brief' });
  return runtime.get(task.id)!;
};

it('rejects generation while visual context clarification is required', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: 'unused', cost: null }),
      generateImage: async () => ({ images: [{ base64: 'unused' }], cost: null }),
    }),
  });
  const parent = await completedConversationWithPlan(runtime, {
    version: 1,
    items: [{ assetId: 'asset-a', roles: ['visual-reference'], confidence: 0.4 }],
    clarificationRequired: true,
  });
  await expect(service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: parent.id, connectionId: 'provider-1', count: 1,
  })).rejects.toThrow('VISUAL_CONTEXT_CLARIFICATION_REQUIRED');
});

it('fails before provider submission when a planned asset is missing', async () => {
  const runtime = createTaskRuntime();
  const editImage = vi.fn(async () => ({ images: [{ base64: 'unused' }], cost: null }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'unused', cost: null }), editImage }),
    loadContextImage: async ({ assetId }) => assetId === 'asset-missing' ? null : {
      name: `${assetId}.png`, mimeType: 'image/png', bytes: new Uint8Array([1]),
    },
  });
  const parent = await completedConversationWithPlan(runtime, {
    version: 1,
    items: [
      { assetId: 'asset-target', roles: ['edit-target'], confidence: 1 },
      { assetId: 'asset-missing', roles: ['visual-anchor'], confidence: 1 },
    ],
    clarificationRequired: false,
  });
  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: parent.id, connectionId: 'provider-1', count: 1,
  });
  await service.flush();
  expect(runtime.get(generation.id)?.generationSlots?.[0]).toMatchObject({
    state: 'failed', errorCode: 'CONTEXT_ASSET_MISSING',
  });
  expect(editImage).not.toHaveBeenCalled();
});
```

Use real task-service submission and runtime state; only the provider and asset loader are injected boundaries.

- [ ] **Step 3: Run targeted generation tests and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/agent/task-service.test.ts -t "keeps original anchors|clarification is required|planned asset is missing"
```

Expected: FAIL because generation ignores `visualContextPlan`.

- [ ] **Step 4: Copy and validate the plan at generation submission**

In `submitDesignGeneration`:

```ts
if (parent.visualContextPlan?.clarificationRequired) {
  throw new Error('VISUAL_CONTEXT_CLARIFICATION_REQUIRED');
}
const visualContextPlan = parent.visualContextPlan
  ?? deriveConservativeVisualContextPlan({
    previous: undefined,
    initialAttachmentAssetIds: parent.designContext.attachmentAssetIds,
    currentAssetIds: parent.contextAssetIds ?? [],
    canvasAssetIds: parent.designContext.document.currentImageAssetIds,
  });
if (visualContextPlan.clarificationRequired) throw new Error('VISUAL_CONTEXT_CLARIFICATION_REQUIRED');
const orderedItems = orderedVisualContextItems(visualContextPlan);
```

Start the generation task with both:

```ts
visualContextPlan: structuredClone(visualContextPlan),
contextAssetIds: orderedItems.map((item) => item.assetId),
```

The flat IDs remain for legacy previews and diagnostics; the plan is authoritative.

- [ ] **Step 5: Load role-aware provider inputs**

Change `prepareDesignGeneration` to return:

```ts
type PreparedVisualInput = {
  item: VisualContextItem;
  image: Blob;
};

const plan = task.visualContextPlan ?? deriveConservativeVisualContextPlan({
  previous: undefined,
  initialAttachmentAssetIds: task.designContext?.attachmentAssetIds ?? [],
  currentAssetIds: task.contextAssetIds ?? [],
  canvasAssetIds: task.designContext?.document.currentImageAssetIds ?? [],
});
const items = orderedVisualContextItems(plan);
const loaded = await Promise.all(items.map(async (item) => {
  const attachment = await options.loadContextImage?.({ projectId: task.source!.id, assetId: item.assetId });
  if (!attachment) throw new Error('CONTEXT_ASSET_MISSING');
  return { item, image: new Blob([new Uint8Array(attachment.bytes).buffer as ArrayBuffer], { type: attachment.mimeType }) };
}));
const editTarget = loaded.find(({ item }) => item.roles.includes('edit-target'));
const referenceImages = loaded.filter((entry) => entry !== editTarget).map(({ image }) => image);
const visualManifest = buildGenerationVisualManifest(items);
```

Prefer `adapter.editImage` when `editTarget` exists. Otherwise retain the existing canvas-source edit path and generation fallback. Append `visualManifest` to every candidate prompt.

- [ ] **Step 6: Add failing slot consistency and retry tests**

```ts
it('uses the same persisted plan for every candidate slot', async () => {
  const runtime = createTaskRuntime();
  const requests: Array<{ prompt: string; image: Blob; referenceImages?: Blob[] }> = [];
  let assetIndex = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: 'unused', cost: null }),
      editImage: async (request) => {
        requests.push(request);
        return { images: [{ base64: `result-${requests.length}` }], cost: null };
      },
    }),
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`, mimeType: 'image/png', bytes: new Uint8Array([assetId === 'asset-target' ? 1 : 2]),
    }),
    persistGeneratedImages: async () => [`asset-result-${assetIndex += 1}`],
  });
  const plan: VisualContextPlan = {
    version: 1,
    items: [
      { assetId: 'asset-target', roles: ['edit-target'], confidence: 1 },
      { assetId: 'asset-anchor', roles: ['visual-anchor'], confidence: 1 },
    ],
    clarificationRequired: false,
  };
  const parent = await completedConversationWithPlan(runtime, plan);
  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: parent.id, connectionId: 'provider-1', count: 3,
  });
  await service.flush();
  expect(requests).toHaveLength(3);
  expect(new Set(requests.map((request) => request.prompt.match(/Visual input manifest:[\s\S]*$/u)?.[0]))).toHaveLength(1);
  expect(requests.every((request) => request.referenceImages?.length === 1)).toBe(true);
  expect(runtime.get(generation.id)?.visualContextPlan).toEqual(plan);
});

it('retries a failed slot with the original visual context plan', async () => {
  const runtime = createTaskRuntime();
  const prompts: string[] = [];
  let attempt = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: 'unused', cost: null }),
      editImage: async (request) => {
        prompts.push(request.prompt);
        attempt += 1;
        if (attempt === 1) throw new Error('IMAGE_RESULT_EMPTY');
        return { images: [{ base64: 'success' }], cost: null };
      },
    }),
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`, mimeType: 'image/png', bytes: new Uint8Array([1]),
    }),
    persistGeneratedImages: async () => ['asset-result'],
  });
  const plan: VisualContextPlan = {
    version: 1,
    items: [{ assetId: 'asset-target', roles: ['edit-target', 'visual-anchor'], confidence: 1 }],
    clarificationRequired: false,
  };
  const parent = await completedConversationWithPlan(runtime, plan);
  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: parent.id, connectionId: 'provider-1', count: 1,
  });
  await service.flush();
  await service.retryDesignGenerationSlot({ libraryId: 'workspace-1', taskId: generation.id, slotId: 'primary' });
  await service.flush();
  expect(prompts).toHaveLength(2);
  expect(prompts[1]).toBe(prompts[0]);
  expect(runtime.get(generation.id)?.visualContextPlan).toEqual(plan);
});
```

- [ ] **Step 7: Run the complete task-service suite and verify GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/features/agent/task-service.test.ts
```

Expected: PASS, including legacy generation tests.

- [ ] **Step 8: Commit role-aware generation**

```bash
git add src/features/agent/task-service.ts src/features/agent/task-service.test.ts
git commit -m "fix: preserve visual context through generation"
```

---

### Task 5: Clarification UI Gate And Full Verification

**Files:**
- Modify: `src/app/studio/ProjectCanvas.tsx`
- Modify: `src/app/studio/ProjectCanvas.test.tsx`

**Interfaces:**
- Consumes: `TaskRecord.visualContextPlan.clarificationRequired`.
- Produces: a disabled generate action until the user answers the existing conversation clarification.

- [ ] **Step 1: Write a failing project-canvas clarification test**

```tsx
it('does not offer generation while visual context clarification is required', async () => {
  const analysis: TaskRecord = {
    ...conversation({ id: 'analysis-clarify', state: 'completed', requestText: '请确认要修改哪张图片' }),
    source: { kind: 'project', id: 'project-1' },
    result: { text: '你希望修改图一还是图二？' },
    visualContextPlan: {
      version: 1,
      items: [
        { assetId: 'asset-a', roles: ['visual-reference'], confidence: 0.4 },
        { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0.4 },
      ],
      clarificationRequired: true,
    },
  };
  renderProjectCanvasWithTasks([analysis]);
  expect(await screen.findByText('你希望修改图一还是图二？')).toBeVisible();
  expect(screen.queryByRole('button', { name: /生成 1 个方案/u })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /生成 3 个方案/u })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx -t "clarification is required"
```

Expected: FAIL because `canGenerate` ignores the clarification flag.

- [ ] **Step 3: Gate generation with the persisted plan**

Update the existing expression:

```ts
const canGenerate = analysisTask?.state === 'completed'
  && Boolean(analysisTask.result?.text)
  && analysisTask.visualContextPlan?.clarificationRequired !== true
  && !tasks.some((task) => task.capability === 'design-generation' && (task.state === 'queued' || task.state === 'running'));
```

Do not add role buttons, badges, menus, or settings.

- [ ] **Step 4: Run the project-canvas suite and verify GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run focused feature verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/features/agent/visual-context.test.ts \
  src/features/agent/task-service.test.ts \
  src/features/tasks/runtime.test.ts \
  src/desktop/storage/task-store.test.ts \
  src/app/studio/ProjectCanvas.test.tsx
```

Expected: PASS with no unhandled errors or warnings.

- [ ] **Step 6: Run repository verification**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
```

Expected: all commands exit `0`. If an unrelated pre-existing dirty-worktree failure occurs, record the exact command and failure without modifying unrelated files.

- [ ] **Step 7: Inspect the final diff for scope and sensitive data**

Run:

```bash
git diff --check
git diff -- src/features/agent/visual-context.ts src/features/agent/visual-context.test.ts src/features/agent/task-service.ts src/features/agent/task-service.test.ts src/features/tasks/state.ts src/features/tasks/runtime.ts src/features/tasks/runtime.test.ts src/desktop/storage/task-store.ts src/desktop/storage/task-store.test.ts src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvas.test.tsx
rg -n "apiKey|base64|image_url|rawResponse|providerMessage" src/features/agent/visual-context.ts src/features/tasks/state.ts src/desktop/storage/task-store.ts
```

Expected: no whitespace errors, no unrelated refactor, and no persisted secret or raw image fields.

- [ ] **Step 8: Commit the clarification gate**

```bash
git add src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvas.test.tsx
git commit -m "fix: gate generation on visual clarification"
```

---

## Completion Criteria

- New conversations persist a valid version 1 visual context plan from one model call.
- The user sees only the design brief or clarification question, never the raw structured envelope.
- Original anchors survive generated-draft iteration unless explicitly released.
- Generation receives an ordered, labelled set of edit target, anchors, content sources, and references.
- Missing assets and unresolved edit targets fail before provider submission.
- Existing task files and plain-text conversation providers continue to work through conservative recovery.
- Focused tests, type-check, lint, and the full unit suite pass.
