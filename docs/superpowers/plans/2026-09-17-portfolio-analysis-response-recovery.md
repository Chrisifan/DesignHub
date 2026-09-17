# Portfolio Analysis Response Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover deterministic portfolio-analysis response formatting errors, retry one schema-invalid result, and persist a safe field-level diagnostic when repair fails.

**Architecture:** Keep provider transport retries in the existing adapter boundary. Add an internal typed validation error and deterministic normalizer in the portfolio parser, then perform one fresh multimodal repair request without retaining the rejected response. Carry only a fixed diagnostic enum through the task runtime and existing validated desktop persistence boundary.

**Tech Stack:** TypeScript 5.9, Vitest 5, Electron IPC, JSON workspace persistence

---

## File Map

- Modify `src/features/agent/analyze-portfolio.ts`: normalize safe representation differences, emit typed validation issues, and retry one invalid model result.
- Modify `src/features/agent/analyze-portfolio.test.ts`: regression tests for normalization, repair retry, final diagnostics, strict rejection, and cancellation.
- Modify `src/features/tasks/state.ts`: define the safe diagnostic enum and add it to `TaskRecord`.
- Modify `src/features/tasks/runtime.ts`: persist and clear analysis diagnostics across fail/retry transitions.
- Modify `src/features/tasks/runtime.test.ts`: verify diagnostic lifecycle.
- Modify `src/features/agent/task-service.ts`: copy a validated diagnostic from the typed error into the failed task.
- Modify `src/features/agent/task-service.test.ts`: verify the safe diagnostic is retained without raw portfolio or response data.
- Modify `src/desktop/storage/task-store.ts`: validate the optional diagnostic in workspace JSON.
- Modify `src/desktop/storage/task-store.test.ts`: cover valid, invalid, and historical task records.
- Modify `src/desktop/ipc/tasks.ts`: apply the same diagnostic validation at the renderer-to-main boundary.
- Modify `src/desktop/ipc/tasks.test.ts`: reject arbitrary diagnostics before storage.

### Task 1: Normalize And Repair Portfolio Responses

**Files:**
- Modify: `src/features/agent/analyze-portfolio.ts:52-235`
- Test: `src/features/agent/analyze-portfolio.test.ts`

- [ ] **Step 1: Write failing normalization and retry tests**

Add tests with the existing `completeCandidate()` fixture:

```ts
it('normalizes numeric percentage strings without weakening the signal contract', async () => {
  const candidate = completeCandidate();
  candidate.styleDna.signals.contrast = '68%' as unknown as number;
  candidate.styleDna.signals.whitespace = ' 38 ' as unknown as number;
  const result = await analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1',
    adapter: { analyzeVision: async () => ({ text: JSON.stringify({ candidates: [candidate] }), cost: null }) },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  });
  expect(result.candidates[0]?.styleDna.signals).toMatchObject({ contrast: 68, whitespace: 38 });
});

it('requests one complete replacement when the first model result is invalid', async () => {
  const analyzeVision = vi.fn()
    .mockResolvedValueOnce({ text: '{bad json', cost: null })
    .mockResolvedValueOnce({ text: JSON.stringify({ candidates: [completeCandidate()] }), cost: null });
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).resolves.toMatchObject({ candidates: [expect.objectContaining({ name: { zh: '纸感', en: 'Paper' } })] });
  expect(analyzeVision).toHaveBeenCalledTimes(2);
  expect(analyzeVision.mock.calls[1]?.[0]).toMatchObject({
    images: [{ url: 'https://img.test/a.png' }],
    prompt: expect.stringContaining('payload.invalid_json'),
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run --config vitest.config.ts src/features/agent/analyze-portfolio.test.ts
```

Expected: the percentage-string test rejects with `VISION_ANALYSIS_INVALID_RESPONSE`, and the repair test reports only one provider call.

- [ ] **Step 3: Add typed issues and deterministic normalization**

Introduce a typed error that never stores rejected values:

```ts
export class PortfolioAnalysisResponseError extends Error {
  readonly analysisDiagnostic: PortfolioAnalysisDiagnostic;

  constructor(analysisDiagnostic: PortfolioAnalysisDiagnostic) {
    super('VISION_ANALYSIS_INVALID_RESPONSE');
    this.name = 'PortfolioAnalysisResponseError';
    this.analysisDiagnostic = analysisDiagnostic;
  }
}

const normalizedPercentage = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)%?$/u);
  return match ? Number(match[1]) : value;
};
```

Replace generic response throws with fixed diagnostics. Normalize the five numeric signal fields before `isCompleteSignals`, trim localized strings in `localized`, and retain strict `0-100` validation. Do not clamp, fill absent semantic fields, or choose among multiple candidates.

- [ ] **Step 4: Add one repair request around parsing**

Keep a reusable schema contract string for the normal and repair prompts. In `analyzePortfolio`, parse the first response; only when it throws `PortfolioAnalysisResponseError`, issue one more `analyzeVisionWithRetry` call with the original images and a prompt containing the safe diagnostic:

```ts
const parseAnalysis = (text: string): PersonaProfile[] => candidatesFromResponse(text, 0);
let candidates: PersonaProfile[];
try {
  candidates = parseAnalysis(response.text);
} catch (error) {
  if (!(error instanceof PortfolioAnalysisResponseError)) throw error;
  if (input.signal?.aborted) {
    throw Object.assign(new Error('Provider request cancelled locally.'), { kind: 'cancelled' });
  }
  const repaired = await analyzeVisionWithRetry(input.adapter, {
    prompt: portfolioRepairPrompt(error.analysisDiagnostic),
    images: input.sources.map((source) => source.image),
  }, input.signal);
  candidates = parseAnalysis(repaired.text);
}
```

Return the final successful response cost using the existing nullable cost behavior.

- [ ] **Step 5: Add strict final-failure and cancellation tests**

```ts
it('reports a safe field diagnostic after one unsuccessful repair', async () => {
  const candidate = completeCandidate();
  candidate.styleDna.signals.contrast = 140;
  const analyzeVision = vi.fn(async () => ({ text: JSON.stringify({ candidates: [candidate] }), cost: null }));
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toMatchObject({
    message: 'VISION_ANALYSIS_INVALID_RESPONSE',
    analysisDiagnostic: 'candidate.styleDna.signals.contrast.invalid_percentage',
  });
  expect(analyzeVision).toHaveBeenCalledTimes(2);
});

it('does not continue repair after cancellation', async () => {
  const controller = new AbortController();
  const analyzeVision = vi.fn(async () => {
    controller.abort();
    return { text: '{bad json', cost: null };
  });
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision }, signal: controller.signal,
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toMatchObject({ kind: 'cancelled' });
  expect(analyzeVision).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the focused command from Step 2. Expected: all tests in `analyze-portfolio.test.ts` pass.

### Task 2: Carry Safe Diagnostics Through Task State

**Files:**
- Modify: `src/features/tasks/state.ts`
- Modify: `src/features/tasks/runtime.ts`
- Test: `src/features/tasks/runtime.test.ts`

- [ ] **Step 1: Write failing runtime lifecycle test**

```ts
it('persists a safe analysis diagnostic on failure and clears it on retry', async () => {
  const runtime = createTaskRuntime();
  const task = runtime.start({ id: 'analysis-1', requestId: 'request-1' });
  await runtime.fail(task.id, 'VISION_ANALYSIS_INVALID_RESPONSE', undefined,
    'candidate.styleDna.signals.contrast.invalid_percentage');
  expect(runtime.get(task.id)?.analysisDiagnostic).toBe(
    'candidate.styleDna.signals.contrast.invalid_percentage',
  );
  const retried = await runtime.retry(task.id, 'analysis-2');
  expect(retried.analysisDiagnostic).toBeUndefined();
});
```

- [ ] **Step 2: Run runtime test and verify RED**

Run:

```bash
pnpm vitest run --config vitest.config.ts src/features/tasks/runtime.test.ts
```

Expected: TypeScript/runtime failure because `analysisDiagnostic` and the fourth `fail` argument do not exist.

- [ ] **Step 3: Define a closed diagnostic contract**

In `state.ts`, export `portfolioAnalysisDiagnostics`, `PortfolioAnalysisDiagnostic`, and `isPortfolioAnalysisDiagnostic`. The set must enumerate every diagnostic emitted by Task 1, including payload, candidate-count, required semantic fields, and each signal field. Add `analysisDiagnostic` to `taskRecordKeys` and `TaskRecord`.

Update `TaskRuntime.fail` and its implementation:

```ts
fail: (
  taskId: string,
  errorCode: string,
  providerFailure?: TaskProviderFailure,
  analysisDiagnostic?: PortfolioAnalysisDiagnostic,
) => Promise<TaskRecord>;
```

Persist the diagnostic only when supplied and clear it in `retryTask` together with `errorCode` and `providerFailure`.

- [ ] **Step 4: Run runtime tests and verify GREEN**

Run the command from Step 2. Expected: all runtime tests pass.

### Task 3: Persist Diagnostics Without Sensitive Content

**Files:**
- Modify: `src/features/agent/task-service.ts:115-143`
- Modify: `src/features/agent/task-service.test.ts`
- Modify: `src/desktop/storage/task-store.ts:1-90`
- Modify: `src/desktop/storage/task-store.test.ts`
- Modify: `src/desktop/ipc/tasks.ts:1-45`
- Modify: `src/desktop/ipc/tasks.test.ts`

- [ ] **Step 1: Write failing service, store, and IPC tests**

Add a task-service test that returns invalid JSON twice and asserts:

```ts
expect(runtime.get(task.id)).toMatchObject({
  state: 'failed',
  errorCode: 'VISION_ANALYSIS_INVALID_RESPONSE',
  analysisDiagnostic: 'payload.invalid_json',
});
expect(JSON.stringify(persisted.at(-1))).not.toContain('{bad json');
expect(JSON.stringify(persisted.at(-1))).not.toContain(sourceData);
```

Extend the task-store diagnostic test to save and load a known diagnostic, reject `analysisDiagnostic: 'private response text'`, and load an existing record with the field absent. Extend the IPC malformed-write test with the same arbitrary diagnostic rejection and one accepted enum value.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run --config vitest.config.ts \
  src/features/agent/task-service.test.ts \
  src/desktop/storage/task-store.test.ts \
  src/desktop/ipc/tasks.test.ts
```

Expected: the service omits the diagnostic, and the persistence boundaries reject or ignore the new property.

- [ ] **Step 3: Thread and validate only the enum value**

In `task-service.ts`, extract only a validated value:

```ts
const analysisDiagnostic = (error: unknown): PortfolioAnalysisDiagnostic | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const value = (error as Record<string, unknown>).analysisDiagnostic;
  return isPortfolioAnalysisDiagnostic(value) ? value : undefined;
};
```

Pass it as the fourth `runtime.fail` argument. In both storage and IPC validators, accept `analysisDiagnostic` only when absent or accepted by `isPortfolioAnalysisDiagnostic`; arbitrary strings and extra fields remain invalid.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all focused task-service, store, and IPC tests pass.

### Task 4: Full Regression Verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run the full unit suite**

```bash
pnpm test:unit
```

Expected: all unit test files and tests pass with zero failures.

- [ ] **Step 2: Run static checks**

```bash
pnpm typecheck
pnpm lint
git diff --check
```

Expected: all commands exit `0` with no type, lint, or whitespace errors.

- [ ] **Step 3: Run the production build**

```bash
pnpm build
```

Expected: all renderer, main, and preload bundles build successfully. Existing bundle-size or Node externalization warnings are acceptable if unchanged.

- [ ] **Step 4: Review final scope**

Inspect `git diff --stat`, `git diff`, and `git status --short`. Confirm no raw provider response logging, no source-image persistence, no relaxed semantic validation, and no unrelated file changes.
