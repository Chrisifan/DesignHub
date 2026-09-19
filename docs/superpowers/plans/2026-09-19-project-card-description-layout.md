# Project Card Content Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align every project card’s cover, title, two-line description region, and 24px designer metadata row regardless of whether a brief or designer is present.

**Architecture:** Retain the existing project-card markup and two-line description clamp. Make grid cards use explicit cover/body rows, make the body a vertical flex container, and pin a fixed-height metadata row to its bottom so native button centering cannot shift shorter content. Keep list cards horizontal through their existing display override.

**Tech Stack:** React, TypeScript, CSS Grid/Flexbox, Vitest, Testing Library, Playwright

---

### Task 1: Preserve the two-line project description region

**Status:** Completed in the current `main` working tree.

**Files:**
- Modified: `src/app/Studio.test.tsx`
- Modified: `src/app/studio/Studio.tsx`
- Modified: `src/app/styles/studio.css`
- Modified: `tests/integration/layout-contract.test.ts`

- [x] Add a focused component test covering empty and long descriptions.
- [x] Give the description paragraph the `project-card-description` class.
- [x] Reserve two 16px lines and clamp overflow after line two.
- [x] Verify the component and style-contract tests pass.

### Task 2: Align card internals and designer metadata rows

**Files:**
- Modify: `tests/e2e/studio.spec.ts`
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `src/app/styles/studio.css`

- [ ] **Step 1: Add a failing browser regression test**

Add this test to `tests/e2e/studio.spec.ts` after the project-card responsive-grid test:

```ts
test('project cards align cover title and designer rows without a brief or designer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);

  await page.getByRole('button', { name: '新建项目', exact: true }).first().click();
  const drawer = page.getByRole('dialog', { name: '新建项目' });
  await drawer.getByRole('textbox', { name: '项目名称' }).fill('空简介项目');
  await drawer.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '项目库', exact: true }).click();

  const metrics = await page.locator('.project-card').evaluateAll((cards) => cards.map((card) => {
    const readRect = (selector: string) => {
      const bounds = card.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return { top: bounds.top, height: bounds.height };
    };
    return {
      cover: readRect('.project-cover'),
      title: readRect('.project-title-line'),
      metadata: readRect('.project-meta'),
    };
  }));

  expect(metrics).toHaveLength(2);
  expect(new Set(metrics.map(({ cover }) => cover.top)).size).toBe(1);
  expect(new Set(metrics.map(({ title }) => title.top)).size).toBe(1);
  expect(new Set(metrics.map(({ metadata }) => metadata.top)).size).toBe(1);
  expect(metrics.every(({ metadata }) => metadata.height === 24)).toBe(true);
});
```

- [ ] **Step 2: Run the browser test and verify RED**

Run:

```bash
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "project cards align cover title and designer rows" --workers=1
```

Expected: FAIL because the new no-designer card’s cover/title are shifted down and its `.project-meta` row is shorter than the seeded designer card.

- [ ] **Step 3: Extend the CSS contract test**

Append these assertions to `reserves two lines for every project description and clamps overflow` in `tests/integration/layout-contract.test.ts`:

```ts
const cardRule = styles.match(/\.project-card\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
const bodyRule = styles.match(/\.project-card-body\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
const metadataRule = styles.match(/\.project-meta\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';

expect(cardRule).toMatch(/display:\s*grid/);
expect(cardRule).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/);
expect(bodyRule).toMatch(/display:\s*flex/);
expect(bodyRule).toMatch(/flex-direction:\s*column/);
expect(metadataRule).toMatch(/min-height:\s*24px/);
expect(metadataRule).toMatch(/margin-top:\s*auto/);
```

- [ ] **Step 4: Run the CSS contract test and verify RED**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts -t "reserves two lines for every project description"
```

Expected: FAIL because the explicit card rows, vertical body layout, and fixed metadata height do not exist yet.

- [ ] **Step 5: Implement the explicit grid-card layout**

Add the following declarations to the existing rules in `src/app/styles/studio.css`:

```css
.project-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.project-card-body {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.project-meta {
  min-height: 24px;
  margin-top: auto;
}
```

Do not add a placeholder avatar. The existing `.project-collection--list .project-card { display: flex; }` rule continues to override the grid display in list mode and retains its horizontal layout.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts -t "reserves two lines for every project description"
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "project cards align cover title and designer rows" --workers=1
```

Expected: both commands exit with status 0. The browser measurements must show identical cover, title, and metadata top positions, with every metadata row exactly `24px` high.

- [ ] **Step 7: Run regression and static verification**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx tests/integration/layout-contract.test.ts
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit with status 0. Existing non-failing build warnings are permitted.

- [ ] **Step 8: Review only the scoped alignment changes**

Run:

```bash
git diff -- tests/e2e/studio.spec.ts tests/integration/layout-contract.test.ts src/app/styles/studio.css
```

Confirm the new changes are limited to the alignment regression tests and three CSS layout declarations. Do not reset, stage, or overwrite unrelated pre-existing edits in these shared files.
