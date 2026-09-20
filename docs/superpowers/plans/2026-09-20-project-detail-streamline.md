# Project Detail Streamline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the project detail page into a compact project summary followed by a full-width design-document list, with document creation in the breadcrumb toolbar.

**Architecture:** Keep project and document data unchanged. Move only presentation and command placement: `ProjectDetailPage` renders the combined state/count and the document list, while `Studio` owns the breadcrumb-toolbar create action and continues opening the existing creation drawer.

**Tech Stack:** React, TypeScript, Testing Library, Vitest, CSS.

---

### Task 1: Specify the simplified project detail DOM

**Files:**
- Modify: `src/app/studio/ProjectDetailPage.test.tsx`

- [ ] **Step 1: Replace the compact-header test with the new information hierarchy**

Assert the header contains the cover, title, brief, designer attribution, and one combined status/count label. Assert it does not contain `本地保存`, `打开画布`, or `导出交付`.

- [ ] **Step 2: Replace sidebar expectations with full-width document expectations**

Assert there is no `项目信息` complementary region, no brand/context/collaboration panels, and the design-document region has the full-width layout class.

- [ ] **Step 3: Remove tests for controls intentionally removed from this page**

Delete assertions for designer selectors, contributor checkboxes, brand fields, and the old section-level new-design button. Retain document opening, preview dimensions, localization, empty brief, empty designer, and empty-list tests.

- [ ] **Step 4: Run the focused test and verify RED**

Run: `pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx`

Expected: FAIL because the old actions, storage state, and sidebar still render.

### Task 2: Simplify ProjectDetailPage markup and styling

**Files:**
- Modify: `src/app/studio/ProjectDetailPage.tsx`
- Modify: `src/app/studio/project-detail.css`

- [ ] **Step 1: Remove obsolete props and imports**

Remove `onExport`, `onCreateDocument`, `onSwitchDesigner`, `onToggleContributor`, `Field`, `Select`, brand parsing, and sidebar-only profile helpers from `ProjectDetailPage`.

- [ ] **Step 2: Merge status and count in the cover overlay**

Render one `project-detail-hero__status` group containing the status dot, project status, a separator, and the actual document-list count.

- [ ] **Step 3: Reduce the summary and document section**

Keep title, brief, and attribution; remove storage and summary actions. Remove the section-level create button and all sidebar panels.

- [ ] **Step 4: Convert the lower layout to full width**

Make `project-detail-layout` a single-column block and allow the document grid to use responsive columns across the full available width. Remove sidebar-only CSS selectors that no longer have markup consumers.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx`

Expected: all tests pass.

### Task 3: Move document creation to the breadcrumb toolbar

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/Studio.test.tsx`

- [ ] **Step 1: Write the failing toolbar behavior test**

Open a saved project detail page, assert `新建设计稿` is present in the workspace toolbar, click it, and assert the existing `新建设计稿` dialog opens. Repeat with a read-only workspace fixture and assert the action is absent.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run src/app/Studio.test.tsx`

Expected: FAIL because the create command still lives inside `ProjectDetailPage`.

- [ ] **Step 3: Add the breadcrumb-toolbar action**

In the selected-project `toolbarActions` branch, add a `plus` IconButton labeled `新建设计稿` when the workspace is writable and the selected project is persisted. Wire it to `openDocumentDialog`. Remove obsolete ProjectDetailPage props from the Studio call site.

- [ ] **Step 4: Run focused UI tests**

Run: `pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx src/app/Studio.test.tsx`

Expected: all tests pass.

### Task 4: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run unit and integration tests**

Run: `pnpm test:unit && pnpm test:integration`

Expected: zero failures.

- [ ] **Step 2: Run static checks and production build**

Run: `pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit successfully.

