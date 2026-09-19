# Fixed Card Width Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep project, designer, and asset-library grid cards at a stable 280px width on large windows while preserving full-width list layouts and safe single-column behavior on narrow windows.

**Architecture:** Add one shared `--library-card-width` layout token, then make each resource grid use the same fixed-width auto-fill column contract with left alignment. Existing list modifiers and narrow-screen media queries remain the authority for full-width rows and one-column layouts.

**Tech Stack:** React, CSS Grid, TypeScript, Vitest, Playwright

---

### Task 1: Add the shared fixed-width grid contract

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `src/app/styles/tokens.css`
- Modify: `src/app/styles/studio.css`
- Modify: `src/app/studio/library.css`
- Modify: `src/app/studio/persona.css`

- [ ] **Step 1: Write the failing layout contract test**

Add this test to `tests/integration/layout-contract.test.ts`:

```ts
it('keeps resource cards at one shared fixed width without stretching the last row', () => {
  const tokens = readStyle('../../src/app/styles/tokens.css');
  const studioStyles = readStyle('../../src/app/styles/studio.css');
  const libraryStyles = readStyle('../../src/app/studio/library.css');
  const personaStyles = readStyle('../../src/app/studio/persona.css');
  const fixedColumns = /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*var\(--library-card-width\)\),\s*var\(--library-card-width\)\)\)/;

  expect(tokens).toMatch(/--library-card-width:\s*280px/);
  expect(studioStyles.match(/\.project-collection\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(fixedColumns);
  expect(studioStyles.match(/\.project-collection\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/justify-content:\s*start/);
  expect(libraryStyles.match(/\.asset-collection--grid\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(fixedColumns);
  expect(libraryStyles.match(/\.asset-collection--grid\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/justify-content:\s*start/);
  expect(personaStyles.match(/\.persona-repository__list\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(fixedColumns);
  expect(personaStyles.match(/\.persona-repository__list\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/justify-content:\s*start/);
  expect(studioStyles).toMatch(/\.project-collection--list\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  expect(libraryStyles).toMatch(/\.asset-collection--list\s*\{[\s\S]*display:\s*flex/);
});
```

- [ ] **Step 2: Run the contract test and verify the new assertion fails**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL in `keeps resource cards at one shared fixed width without stretching the last row` because `--library-card-width` and the fixed auto-fill columns do not exist yet.

- [ ] **Step 3: Add the shared token and fixed-width columns**

Add this token to the shared `:root` layout contract in `src/app/styles/tokens.css`:

```css
--library-card-width: 280px;
```

Replace the project grid definition in `src/app/styles/studio.css` with:

```css
.project-collection {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(min(100%, var(--library-card-width)), var(--library-card-width))
  );
  justify-content: start;
  gap: 20px;
}
```

Replace the asset grid definition in `src/app/studio/library.css` with:

```css
.asset-collection--grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(min(100%, var(--library-card-width)), var(--library-card-width))
  );
  justify-content: start;
  gap: 12px;
}
```

Update the legacy profile grid in `src/app/studio/library.css` to use the same columns and remove `.profile-library` from the `max-width: 1120px` and `max-width: 620px` equal-fraction overrides:

```css
.profile-library {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(min(100%, var(--library-card-width)), var(--library-card-width))
  );
  justify-content: start;
  align-content: start;
  gap: 16px;
  padding: 20px;
  background: var(--background);
}
```

Replace the designer repository columns in `src/app/studio/persona.css` with:

```css
.persona-repository__list {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(min(100%, var(--library-card-width)), var(--library-card-width))
  );
  justify-content: start;
  align-content: start;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  padding: 2px;
}
```

Keep the existing `@media (max-width: 720px)` designer override so narrow screens use one fluid column.

- [ ] **Step 4: Run contract and component tests**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts src/app/Studio.test.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/LibraryPages.test.tsx
```

Expected: PASS with the project, designer, and asset interactions unchanged.

- [ ] **Step 5: Commit the shared grid contract**

```bash
git add tests/integration/layout-contract.test.ts src/app/styles/tokens.css src/app/styles/studio.css src/app/studio/library.css src/app/studio/persona.css
git commit -m "fix: keep library cards at a stable width"
```

### Task 2: Update the browser-level responsive designer assertion

**Files:**
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Update the desktop assertion before running the implementation**

Replace the four-column-only assertion in `designer dossier cards keep a stable responsive grid` with an explicit fixed-width assertion:

```ts
  const desktopLayout = await repository.locator('.persona-repository__list').evaluate((grid) => ({
    columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    cardWidths: [...grid.querySelectorAll<HTMLElement>('.persona-repository-card-button')]
      .map((card) => card.getBoundingClientRect().width),
  }));
  expect(desktopLayout.columns).toBe(3);
  expect(desktopLayout.cardWidths.every((width) => Math.abs(width - 280) <= 1)).toBe(true);
```

- [ ] **Step 2: Run the focused browser test**

Run:

```bash
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "designer dossier cards keep a stable responsive grid"
```

Expected: PASS at 1280px with three 280px designer columns, then PASS at 680px with one contained fluid column.

- [ ] **Step 3: Commit the browser assertion**

```bash
git add tests/e2e/studio.spec.ts
git commit -m "test: verify fixed designer card width"
```

### Task 3: Verify the complete change

**Files:**
- Verify only

- [ ] **Step 1: Run all affected unit and integration tests**

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts src/app/Studio.test.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/LibraryPages.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run static validation**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit with status 0; the existing Vite chunk-size warning may remain.

- [ ] **Step 3: Inspect the final diff**

```bash
git diff --check HEAD~2..HEAD
git status --short --branch
```

Expected: no whitespace errors; unrelated pre-existing workspace modifications remain untouched.
