# Native Outpainting Result Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat expansion as one provider-generated full image and remove the local source-image overlay that creates visible rectangular seams.

**Architecture:** Keep the expanded transparent input canvas and generated edge mask. Send both to the provider with the exact target size, then persist the provider image unchanged after validating that its dimensions match the requested canvas. A provider that returns the wrong dimensions fails explicitly instead of being resized or composited locally.

**Tech Stack:** TypeScript, Sharp, Vitest, Electron main-process task service.

---

### Task 1: Lock Full-Result Semantics With Tests

**Files:**
- Modify: `src/desktop/services/expand-image.test.ts`
- Modify: `src/desktop/services/task-service-factory.test.ts`

- [x] **Step 1: Replace the finalization test with a regression assertion**

Assert that expansion preparation still creates a target-sized image and mask, while no API exists that overlays the source onto a provider result.

- [x] **Step 2: Run the focused tests and verify red**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/desktop/services/expand-image.test.ts src/desktop/services/task-service-factory.test.ts
```

Expected: FAIL while `finalizeExpandedImage` remains exported and used.

### Task 2: Remove Local Result Compositing

**Files:**
- Modify: `src/desktop/services/expand-image.ts`
- Modify: `src/desktop/services/task-service-factory.ts`
- Modify: `src/features/agent/task-service.ts`

- [x] **Step 1: Delete `finalizeExpandedImage`**

Keep only `buildExpandPrompt` and `prepareExpandedImage`; the latter remains responsible for the provider input canvas and mask.

- [x] **Step 2: Remove the expand result normalizer**

Delete `normalizeImageEditResult` from the task service option contract and remove its factory implementation. Pass the provider response directly to result validation and persistence.

- [x] **Step 3: Preserve strict result validation**

Keep `expectedImageResultSize` returning the prepared expansion dimensions so an incompatible provider produces `RESULT_DIMENSIONS_INVALID`.

- [x] **Step 4: Run focused tests and verify green**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/desktop/services/expand-image.test.ts src/desktop/services/task-service-factory.test.ts src/features/agent/task-service-image-edit.test.ts src/features/providers/config.test.ts
```

Expected: all tests pass.

### Task 3: Regression Verification

**Files:**
- Test: all modified source and integration boundaries.

- [x] **Step 1: Run static and build checks**

```bash
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit successfully.

- [x] **Step 2: Run unit and provider suites**

```bash
pnpm test:unit
pnpm test:provider
```

Expected: all tests pass.

- [x] **Step 3: Run integration tests and report unrelated failures separately**

```bash
pnpm test:integration
```

Expected expansion-related tests to pass; do not modify unrelated layout contracts.
