# Project Detail Fixed Document Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render project-detail document cards at a fixed `360px` desktop width without stretching incomplete rows.

**Architecture:** Keep the existing `ProjectDetailPage` markup and document-card component unchanged. Enforce the behavior entirely in the document grid CSS, and update the integration layout contract so future changes cannot reintroduce stretching.

**Tech Stack:** CSS Grid, React, TypeScript, Vitest.

---

### Task 1: Lock and implement fixed-width document cards

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `src/app/studio/project-detail.css`

- [ ] **Step 1: Write the failing layout contract**

Replace the current flexible-grid expectation with assertions that require a fixed `360px` column, prevent stretching, and preserve left alignment:

```ts
expect(styles).toMatch(
  /\.project-detail-document-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*360px\),\s*360px\)\)/,
);
expect(styles).toMatch(
  /\.project-detail-document-grid\s*\{[\s\S]*?justify-content:\s*start/,
);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL because the grid currently uses `auto-fit` and a flexible `1fr` maximum.

- [ ] **Step 3: Implement the fixed-width grid**

Update the desktop grid rule in `src/app/studio/project-detail.css`:

```css
.project-detail-document-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 360px));
  justify-content: start;
  gap: 16px;
}
```

Keep the existing `@media (max-width: 720px)` single-column override so cards shrink to the available viewport width on small screens.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts src/app/studio/ProjectDetailPage.test.tsx src/app/Studio.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 5: Run static and build verification**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits successfully.

- [ ] **Step 6: Commit the focused change**

```bash
git add tests/integration/layout-contract.test.ts src/app/studio/project-detail.css docs/superpowers/plans/2026-09-20-project-detail-fixed-document-cards.md
git commit -m "fix: keep project document cards at fixed width"
```
