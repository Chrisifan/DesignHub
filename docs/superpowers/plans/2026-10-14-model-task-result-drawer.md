# Model Task Result Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize model-task types and replace inline candidate expansion with a clickable result summary that opens real candidate previews in a drawer.

**Architecture:** Keep task filtering, polling, sorting, and mutation in `TasksPage`. Add a focused `TaskResultDrawer` that projects persisted task results into preview cards, reads managed assets through the existing desktop bridge, and delegates slot retries back to `TasksPage`.

**Tech Stack:** React 19, TypeScript, CSS Grid, existing Drawer/UI primitives, Vitest, Testing Library.

---

### Task 1: Define Localized Types And Result Interaction

**Files:**
- Modify: `src/app/studio/LibraryPages.test.tsx`
- Modify: `src/app/studio/LibraryPages.tsx:775-915`

- [x] **Step 1: Write failing type-label tests**

Render tasks for `conversation`, `design-generation`, `image-generation`, `image-editing`, `local-transform`, `vision-analysis`, and an unknown capability. Assert the known Chinese labels and the unknown raw value are present in `.task-row__type` cells.

- [x] **Step 2: Write the failing result-control test**

For a design-generation task with one completed slot, assert that the result cell contains a button named `候选 1/1`, that `查看候选详情` is absent, and that no `.task-generation-details` exists.

- [x] **Step 3: Run the focused test and verify RED**

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx
```

Expected: FAIL because capability values are raw text and result details still use inline `<details>`.

- [x] **Step 4: Implement localized labels and the result button**

Add `taskCapabilityLabel(task)` with explicit localized mappings and raw-value fallback. Replace the inline `<details>` block with a result-cell button that stores the selected task ID. Derive the selected task from the current `tasks` array so polling and retries refresh the open result automatically.

- [x] **Step 5: Run the focused test and verify GREEN**

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx
```

Expected: all tests in the file PASS.

### Task 2: Build The Result Drawer

**Files:**
- Create: `src/app/studio/TaskResultDrawer.tsx`
- Create: `src/app/studio/TaskResultDrawer.test.tsx`
- Modify: `src/app/studio/LibraryPages.tsx`
- Modify: `src/app/studio/library.css`

- [x] **Step 1: Write failing drawer preview tests**

Render `TaskResultDrawer` with a project design-generation task whose completed slot references a persisted candidate. Mock `readAsset` and assert it is called with:

```ts
{ libraryId: 'workspace-1', projectId: 'project-1', assetId: 'asset-primary' }
```

Assert the drawer renders a `生成候选稿` image, the localized `主方案` label, and `已完成` status.

- [x] **Step 2: Write failing state and retry tests**

Render completed, running, failed, and cancelled slots. Assert stable localized placeholders and verify `重试构图探索` calls `onRetrySlot(task.id, 'composition')` only when no slot remains queued or running. Mock a rejected asset read and assert the card displays `预览不可用` without closing the drawer.

- [x] **Step 3: Run the drawer test and verify RED**

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/TaskResultDrawer.test.tsx
```

Expected: FAIL because `TaskResultDrawer` does not exist.

- [x] **Step 4: Implement result projection and managed previews**

Create typed result items from generation slots, legacy candidates, ordinary `assetIds`, `sceneAssetId`, and `toolCandidate.resultAssetId`. Load unique preview assets in an effect using `getDesktopApi().readAsset`, convert bytes to PNG data URLs, and record failed reads as `null` so they do not retry on every render.

- [x] **Step 5: Implement accessible drawer cards**

Render the existing `Drawer` titled `任务结果 / Task results`. Each card includes a fixed preview region, localized label, `Badge` state, and optional retry `IconButton`. Keep missing bindings and failed reads inside the card as `预览不可用 / Preview unavailable`.

- [x] **Step 6: Connect and style the drawer**

Render `TaskResultDrawer` from `TasksPage` with the selected task, active `libraryId`, locale, close callback, and existing `retryGenerationSlot`. Add `.task-result-button`, `.task-result-grid`, `.task-result-card`, and preview-state styles. Remove obsolete `.task-generation-details` rules.

- [x] **Step 7: Run focused tests and verify GREEN**

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx src/app/studio/TaskResultDrawer.test.tsx
```

Expected: both files PASS.

### Task 3: Regression And Visual Verification

**Files:**
- Verify: `src/app/studio/LibraryPages.tsx`
- Verify: `src/app/studio/TaskResultDrawer.tsx`
- Verify: `src/app/studio/library.css`
- Verify: `src/app/studio/LibraryPages.test.tsx`
- Verify: `src/app/studio/TaskResultDrawer.test.tsx`

- [x] **Step 1: Run automated gates**

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit successfully with no new warnings.

The model-task layout contract also verifies that the status track has a stable width, so every summary cell remains aligned with the header regardless of badge text width.

- [ ] **Step 2: Inspect the Electron task page**

Open Model Tasks and verify: type labels follow the selected language; every task row remains one line; clicking a candidate summary opens real previews; closing restores focus; failed slots use restrained status styling; the sticky header remains fixed.

- [x] **Step 3: Commit the implementation**

```bash
git add src/app/studio/LibraryPages.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/TaskResultDrawer.tsx src/app/studio/TaskResultDrawer.test.tsx src/app/studio/library.css docs/superpowers/plans/2026-10-14-model-task-result-drawer.md
git commit -m "fix: move model task results into drawer"
```
