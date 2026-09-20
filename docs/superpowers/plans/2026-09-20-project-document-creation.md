# Project Document Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the project-level “New size” action with a “New design” flow that creates either an independent blank document or a finalized-document size variant.

**Architecture:** Keep document creation inside `Studio.tsx` and persist through the existing project metadata API. Reuse the existing revision loading and `resizeScene` path only for the size-variant mode; blank documents require no scene write. Keep `ProjectDetailPage` presentational by retaining its existing callback boundary.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing DesignHub desktop API and project metadata model.

---

### Task 1: Rename the project-detail action

**Files:**
- Modify: `src/app/studio/ProjectDetailPage.tsx`
- Test: `src/app/studio/ProjectDetailPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Change the writable-state assertion to click a button named `新建设计稿`, and change the read-only assertion to verify that button is absent.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx`

Expected: FAIL because the component still renders `新建尺寸`.

- [ ] **Step 3: Write minimal implementation**

Change the visible localized label from `新建尺寸 / New size` to `新建设计稿 / New design` without changing the callback contract.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx`

Expected: PASS.

### Task 2: Add blank-document creation

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Test: `src/app/Studio.test.tsx`

- [ ] **Step 1: Write the failing test**

Add an integration-style component test that opens a project without a finalized revision, clicks `新建设计稿`, submits the default blank mode, and expects `updateProjectMetadata` to receive a new document with the entered name and dimensions and without `sourceDocumentId` or `sourceRevisionId`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/Studio.test.tsx -t "creates an independent blank design document"`

Expected: FAIL because the existing handler refuses to open unless the source is finalized.

- [ ] **Step 3: Write minimal implementation**

Replace `relatedDialog` with a creation-dialog state and introduce a `blank | variant` mode. Open the dialog without requiring a finalized source. On blank submission, append this metadata entry and skip revision loading and scene saving:

```ts
{
  id: `doc-${crypto.randomUUID()}`,
  name: documentName.trim(),
  width,
  height,
  finalizedRevisionId: null,
}
```

Render the mode selector, name, width, height, validation copy, and `创建设计稿` submit action in the existing modal system.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/Studio.test.tsx -t "creates an independent blank design document"`

Expected: PASS.

### Task 3: Preserve finalized-source size variants

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Test: `src/app/Studio.test.tsx`

- [ ] **Step 1: Update the existing tests to exercise variant mode**

In both related-size tests, open `新建设计稿`, select `尺寸变体`, choose the finalized source when needed, and submit with `创建设计稿`. Keep assertions for source attribution and scaled scene geometry.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/app/Studio.test.tsx -t "related-size|copies and scales"`

Expected: FAIL until the new mode controls and labels exist.

- [ ] **Step 3: Complete the variant implementation**

Build the finalized-source options from `selected.documentEntries`, validate the selected source at submit time, append `sourceDocumentId` and `sourceRevisionId`, then reuse the existing `loadDocumentRevisions`, `resizeScene`, and `saveDocumentScene` sequence.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/ProjectDetailPage.test.tsx`

Expected: PASS.

### Task 4: Verify the feature

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run type and lint checks**

Run: `pnpm typecheck && pnpm lint`

Expected: both commands exit 0.

- [ ] **Step 2: Run the relevant test suite**

Run: `pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/ProjectDetailPage.test.tsx`

Expected: all tests pass.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check && git diff -- src/app/studio/Studio.tsx src/app/studio/ProjectDetailPage.tsx src/app/Studio.test.tsx src/app/studio/ProjectDetailPage.test.tsx`

Expected: no whitespace errors and only the scoped document-creation changes.
