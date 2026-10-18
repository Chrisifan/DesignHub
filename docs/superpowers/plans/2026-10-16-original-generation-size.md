# Original Generation Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `original` generation ratio use the currently selected project design's immutable dimensions.

**Architecture:** `ProjectCanvas` resolves a unique selected `ProjectDesign` into an optional `originalSize` snapshot and forwards it through `Studio` and the desktop bridge. `AgentTaskService` uses that snapshot only for `original`, then persists the resolved dimensions in the generated task context; fixed ratios and retries remain unchanged.

**Tech Stack:** React, TypeScript, Electron IPC, Vitest, Testing Library

---

### Task 1: Task Service Size Snapshot

**Files:**
- Modify: `src/features/agent/task-service.ts`
- Test: `src/features/agent/task-service-design-generation.test.ts`

- [ ] **Step 1: Write the failing service test**

Extend the test helper to accept `originalSize`, then assert that a stale `1350 × 1800` parent context produces a `1600x900` provider request when the submission carries `{ width: 1600, height: 900 }`.

- [ ] **Step 2: Run the service test and verify RED**

Run: `pnpm vitest run --config vitest.config.ts src/features/agent/task-service-design-generation.test.ts`

Expected: FAIL because `DesignGenerationInput` has no `originalSize` and the request remains `1350x1800`.

- [ ] **Step 3: Add the minimal task input and resolution logic**

Add this optional field:

```ts
originalSize?: ProjectDesignSize;
```

Resolve the immutable generation dimensions with:

```ts
const generationSize = resolveGenerationRatioSize(
  input.generationRatio ?? 'original',
  input.originalSize ?? parent.designContext.canvas,
);
```

- [ ] **Step 4: Run the service test and verify GREEN**

Run: `pnpm vitest run --config vitest.config.ts src/features/agent/task-service-design-generation.test.ts`

Expected: all tests pass, including the existing fixed-ratio assertion.

### Task 2: Canvas Selection and IPC Validation

**Files:**
- Modify: `src/app/studio/ProjectCanvas.tsx`
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/desktop/ipc/agent.ts`
- Test: `src/app/studio/ProjectCanvas.test.tsx`
- Test: `src/desktop/ipc/agent.test.ts`

- [ ] **Step 1: Write the failing canvas test**

Render a completed analysis with a selected `1600 × 900` project design and `generationRatio: 'original'`. Click `生成单张` and expect:

```ts
expect(onSubmitDesignGeneration).toHaveBeenCalledWith(
  analysis.id,
  'original',
  1,
  { width: 1600, height: 900 },
);
```

- [ ] **Step 2: Write the failing IPC tests**

Verify a design-generation submission accepts `{ originalSize: { width: 1600, height: 900 } }` and rejects non-integer, zero, negative, or over-20000 values.

- [ ] **Step 3: Run both test files and verify RED**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx src/desktop/ipc/agent.test.ts`

Expected: FAIL because the callback and bridge do not accept `originalSize`.

- [ ] **Step 4: Forward the selected size through the renderer**

Extend the callback signature with `originalSize?: ProjectDesignSize`. In `ProjectCanvas.generate`, pass the unique selected design's dimensions only when the selected ratio is `original`:

```ts
const originalSize = project.generationRatio === 'original' && selectedDesigns.length === 1
  ? { width: selectedDesigns[0].width, height: selectedDesigns[0].height }
  : undefined;
await onSubmitDesignGeneration(analysisTask.id, ratio, count, originalSize);
```

Forward that value through `Studio.submitProjectDesignGeneration` into `submitDesignGeneration`.

- [ ] **Step 5: Validate structured dimensions at IPC**

Accept only integer `width` and `height` values from 1 through 20000:

```ts
const isProjectDesignSize = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const size = value as Record<string, unknown>;
  return Number.isInteger(size.width) && Number(size.width) >= 1 && Number(size.width) <= 20_000
    && Number.isInteger(size.height) && Number(size.height) >= 1 && Number(size.height) <= 20_000;
};
```

- [ ] **Step 6: Run both test files and verify GREEN**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx src/desktop/ipc/agent.test.ts`

Expected: all tests pass.

### Task 3: Regression Gates and Commit

**Files:**
- Verify all files from Tasks 1 and 2

- [ ] **Step 1: Run focused and static gates**

Run:

```bash
pnpm test:focused
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Run broad regression suites**

Run:

```bash
pnpm test:unit
pnpm test:integration
```

Expected: all non-skipped tests pass.

- [ ] **Step 3: Commit only the implementation files**

```bash
git add src/features/agent/task-service.ts src/features/agent/task-service-design-generation.test.ts \
  src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvas.test.tsx \
  src/app/studio/Studio.tsx src/desktop/ipc/agent.ts src/desktop/ipc/agent.test.ts
git commit -m "fix: preserve selected image size for original generation"
```
