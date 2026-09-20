# Workbench Selected Candidate Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move export from the canvas header to the right toolbar and export only the currently selected candidate as PNG while making the finalization icon visible.

**Architecture:** Keep candidate selection authoritative inside `Workbench`. Build an ephemeral single-image `DesignScene` from the selected `TaskCandidate` and pass it to the existing desktop `exportDocument` bridge; do not persist or finalize this scene. Reuse the existing icon-mask system with icon names that are present in `public/icons`.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Electron desktop bridge, CSS.

---

### Task 1: Specify selected-candidate export behavior

**Files:**
- Modify: `src/app/studio/Workbench.test.tsx`

- [x] **Step 1: Write a failing toolbar placement test**

Assert that the workbench header has no `导出` button, while the `上下文工具` toolbar contains `导出所选候选` and `定稿所选候选`, both disabled before selection.

- [x] **Step 2: Write a failing candidate export test**

Render a completed candidate, select it, click `导出所选候选`, and assert `exportDocument` receives `format: 'png'` plus a one-layer scene whose image `assetId` is the selected candidate asset.

- [x] **Step 3: Run the focused tests and verify RED**

Run: `pnpm exec vitest run src/app/studio/Workbench.test.tsx`

Expected: FAIL because export still lives in the header and the right toolbar has no export action.

### Task 2: Implement direct candidate export

**Files:**
- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/Studio.tsx`

- [x] **Step 1: Remove the header export action and obsolete callback prop**

Remove `onExport` from `WorkbenchProps`, the component destructuring, the header button, and both Studio call sites.

- [x] **Step 2: Add minimal export state and handler**

Resolve the selected candidate through `candidateFor`, create a document-sized scene with one visible content image layer, and call:

```ts
await getDesktopApi().exportDocument?.({
  workspaceId,
  projectId: project.id,
  documentId,
  format: 'png',
  scene: candidateScene,
});
```

Treat `null` as a cancelled save dialog, report success with its path, and report thrown failures through `notify`.

- [x] **Step 3: Add the right-toolbar action and fix the finalization icon**

Place an `IconButton` named `download` before finalization, disable it unless a candidate and persisted document are available, and change finalization from missing `check-circle` to existing `circle-check`.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run: `pnpm exec vitest run src/app/studio/Workbench.test.tsx src/app/Studio.test.tsx`

Expected: all tests pass.

### Task 3: Make critical toolbar actions legible

**Files:**
- Modify: `src/app/studio/workbench.css`
- Test: `src/app/studio/Workbench.test.tsx`

- [x] **Step 1: Add DOM assertions for icon names**

Assert the export icon mask references `download.svg` and the finalization icon mask references `circle-check.svg`.

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run src/app/studio/Workbench.test.tsx`

Expected: FAIL while finalization still references the missing icon.

- [x] **Step 3: Add shared critical-action styling**

Give enabled export and finalization actions distinct high-contrast foreground/background treatments, while disabled icons retain visible muted contrast.

- [x] **Step 4: Run focused verification**

Run: `pnpm exec vitest run src/app/studio/Workbench.test.tsx src/app/Studio.test.tsx`

Expected: all tests pass.

### Task 4: Full verification

**Files:**
- Verify only

- [x] **Step 1: Run unit tests**

Run: `pnpm test:unit`

Expected: zero failures.

- [x] **Step 2: Run integration tests**

Run: `pnpm test:integration`

Expected: zero failures.

- [x] **Step 3: Run static and build checks**

Run: `pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit successfully.
