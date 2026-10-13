# Model Task List Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make model tasks display newest first with localized local-zone timestamps, a centered result column, and a sticky header.

**Architecture:** Keep the existing `TaskPage` polling and action flow intact. Derive a sorted filtered copy and separate presentation helpers for timestamp and result text, then map those values into a six-column CSS grid whose header is sticky inside the existing `.page-content` scroll container.

**Tech Stack:** React 19, TypeScript, CSS Grid, `Intl.DateTimeFormat`, Vitest, Testing Library.

---

### Task 1: Lock The Table Behavior With Tests

**Files:**
- Modify: `src/app/studio/LibraryPages.test.tsx`

- [ ] **Step 1: Write a failing newest-first and localized-time test**

Add a component test that returns an older task followed by a newer task, renders `TaskHarness`, and asserts that the article labels are ordered `task-new`, `task-old`. Build the expected display value with the same public platform primitive required by the design:

```tsx
const expectedTime = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date('2026-10-13T06:30:00.000Z'));

expect(screen.getByText(expectedTime)).toHaveClass('task-row__time');
expect(screen.queryByText('2026-10-13T06:30:00.000Z')).not.toBeInTheDocument();
```

- [ ] **Step 2: Update the structure assertions**

Change the header expectation to `任务类型状态任务摘要结果时间操作`. In the generation test, assert that `候选生成 2/3` belongs to `.task-row__result`, and in the image-result test assert that `2 张图` appears in the dedicated result cell.

- [ ] **Step 3: Run the focused component test and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx
```

Expected: FAIL because tasks are not sorted, ISO time is rendered directly, and `.task-row__result` / `.task-row__time` do not exist.

### Task 2: Implement The Six-Column Projection

**Files:**
- Modify: `src/app/studio/LibraryPages.tsx:727-870`
- Modify: `src/app/studio/library.css:3145-3210`

- [ ] **Step 1: Add timestamp helpers and stable sorting**

Add helpers local to `TaskPage` that parse `updatedAt ?? createdAt`, return zero for missing or invalid timestamps, format valid values with `Intl.DateTimeFormat(locale, { year, month, day, hour, minute })`, and format the full local value for `title`. Derive `visibleTasks` with `filter(...).toSorted(...)` or a spread plus `sort(...)`, sorting timestamp descending and then ID descending without mutating `tasks`.

- [ ] **Step 2: Separate result and time presentation**

Replace `taskMetadata` with a result projection. It returns generation progress or image count as primary text, an em dash when neither exists, and exposes cost as secondary result metadata. Render dedicated `.task-row__result` and `.task-row__time` cells, and change the localized headers to `结果 / Result` and `时间 / Time`.

- [ ] **Step 3: Keep generation details aligned with their result**

Keep the existing native `details` interaction and retry controls, but make the result cell the visible progress entry. Position expanded slot details from the result column through the actions column so details no longer begin beneath task type.

- [ ] **Step 4: Implement the six-column grid and sticky header**

Use a six-track grid with stable result and time tracks. Center `.task-row__result`; define `.task-row--header { position: sticky; top: 0; z-index: 2; }` with an opaque background and divider so body rows cannot bleed through.

- [ ] **Step 5: Run the component test and verify GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx
```

Expected: all tests in the file PASS.

### Task 3: Regression And Visual Verification

**Files:**
- Verify: `src/app/studio/LibraryPages.tsx`
- Verify: `src/app/studio/library.css`
- Verify: `src/app/studio/LibraryPages.test.tsx`

- [ ] **Step 1: Run automated gates**

Run:

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: every command exits successfully with no new warnings.

- [ ] **Step 2: Inspect the Electron page**

Start the app with `pnpm start`, open Model Tasks, and verify: the newest task is first; time is localized; result text is centered in its own column; the header remains visible when the page scrolls; expanded generation details do not overlap other columns.

- [ ] **Step 3: Commit the implementation**

```bash
git add src/app/studio/LibraryPages.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/library.css docs/superpowers/plans/2026-10-13-model-task-list-display.md
git commit -m "fix: refine model task list display"
```
