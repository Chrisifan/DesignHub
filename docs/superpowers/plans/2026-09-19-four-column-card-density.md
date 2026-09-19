# Four-Column Card Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce shared resource cards to 216px so a standard 1280px application window shows at least four cards per row.

**Architecture:** Keep the existing shared fixed-width grid contract and change only its shared width token. Tighten the project cover height to 192px so the narrower card retains a balanced landscape-library proportion, while existing single-column responsive rules continue to protect narrow windows.

**Tech Stack:** CSS Grid, TypeScript, Vitest, Playwright

---

### Task 1: Lock the denser shared card dimensions

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `src/app/styles/tokens.css`
- Modify: `src/app/styles/studio.css`

- [ ] **Step 1: Change the layout contract test to require 216px cards and a 192px project cover**

In `tests/integration/layout-contract.test.ts`, change the shared width expectation and add project-cover assertions:

```ts
  const largeWindowStyles = studioStyles.match(
    /@media \(min-width: 1440px\)\s*\{([\s\S]*?)\n\}\n@media \(max-width: 1279px\)/u,
  )?.[1] ?? '';

  expect(tokens).toMatch(/--library-card-width:\s*216px/);
  expect(studioStyles.match(/\.project-cover\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/height:\s*192px/);
  expect(largeWindowStyles).not.toMatch(/\.project-cover/);
```

Keep the existing assertions that project, designer, and asset grids all consume `--library-card-width` and that list layouts remain unchanged.

- [ ] **Step 2: Run the contract test and verify it fails for the old dimensions**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL because the token is still `280px`, `.project-cover` is still `256px`, and the wide-screen override still sets it to `296px`.

- [ ] **Step 3: Implement the denser shared dimensions**

In `src/app/styles/tokens.css`, change:

```css
--library-card-width: 216px;
```

In `src/app/styles/studio.css`, change the base project cover and remove its large-window override:

```css
.project-cover {
  height: 192px;
  position: relative;
  overflow: hidden;
}
```

The `@media (min-width: 1440px)` block must retain the studio column and page padding rules but no longer contain a `.project-cover` rule.

- [ ] **Step 4: Run affected integration and component tests**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts src/app/Studio.test.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/LibraryPages.test.tsx
```

Expected: PASS with all existing project, designer, and asset interactions unchanged.

- [ ] **Step 5: Commit the density implementation**

```bash
git add tests/integration/layout-contract.test.ts src/app/styles/tokens.css src/app/styles/studio.css
git commit -m "fix: fit four resource cards in the standard window"
```

### Task 2: Verify four columns in the production browser build

**Files:**
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Change the desktop browser assertion before rebuilding**

Update the desktop part of `designer dossier cards keep a stable responsive grid`:

```ts
  expect(desktopLayout.columns).toBeGreaterThanOrEqual(4);
  expect(desktopLayout.cardWidths.every((width) => Math.abs(width - 216) <= 1)).toBe(true);
```

Keep the 680px assertions that require one column, no internal overflow, and fully contained cards.

- [ ] **Step 2: Run the focused browser test against the old build and verify it fails**

Run:

```bash
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "designer dossier cards keep a stable responsive grid"
```

Expected: FAIL because the current production build still renders 280px cards and fewer than four columns.

- [ ] **Step 3: Build the updated production assets**

Run:

```bash
pnpm build
```

Expected: PASS; the existing Vite chunk-size and Sharp externalization warnings may remain.

- [ ] **Step 4: Re-run the focused browser test**

Run:

```bash
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "designer dossier cards keep a stable responsive grid"
```

Expected: PASS with at least four 216px columns at 1280px and one contained column at 680px.

- [ ] **Step 5: Commit the browser assertion**

```bash
git add tests/e2e/studio.spec.ts
git commit -m "test: require four cards in the standard window"
```

### Task 3: Verify the complete adjustment

**Files:**
- Verify only

- [ ] **Step 1: Run all affected tests**

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts src/app/Studio.test.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/LibraryPages.test.tsx
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "designer dossier cards keep a stable responsive grid"
```

Expected: all tests pass.

- [ ] **Step 2: Run static validation and production build**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit with status 0; only the existing build warnings may remain.

- [ ] **Step 3: Check the final workspace state**

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; unrelated pre-existing workspace modifications remain untouched.
