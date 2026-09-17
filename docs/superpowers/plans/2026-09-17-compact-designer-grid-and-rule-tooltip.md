# Compact Designer Grid and Rule Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show four compact designer dossier cards per desktop row and keep analysis negative rules on one ellipsized line with their complete text available on hover.

**Architecture:** Keep the existing `DesignerProfileCard` and whole-card button unchanged. Adjust the repository grid at its owning stylesheet, and wrap each negative-rule string in a dedicated text span so text truncation does not affect the fixed alert icon. Use the existing native `title` tooltip convention rather than adding a parallel tooltip system.

**Tech Stack:** React 19, TypeScript, CSS Grid/Flexbox, Vitest, Testing Library, Playwright.

---

### Task 1: Ellipsized Negative-Rule Tooltip

**Files:**
- Modify: `src/app/studio/DesignerLibrary.test.tsx:382-391`
- Modify: `src/app/studio/DesignerLibrary.tsx:1230-1235`
- Modify: `src/app/studio/library.css:817-836`

- [ ] **Step 1: Write the failing unit assertion**

Change the existing completed-analysis test to retain the rule element and require the full tooltip value:

```tsx
const negativeRule = within(report).getByText('避免霓虹渐变');
expect(negativeRule).toHaveAttribute('title', '避免霓虹渐变');
expect(negativeRule).toHaveClass('portfolio-analysis-rule__text');
```

- [ ] **Step 2: Run the focused unit test to verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: FAIL because the text is currently an anonymous text node without `title` or the dedicated class.

- [ ] **Step 3: Wrap each rule in a tooltip-bearing text element**

Replace the negative-rule mapping with:

```tsx
{negativeRules.map((rule) => (
  <li key={rule}>
    <Icon name="circle-alert" size={13} />
    <span className="portfolio-analysis-rule__text" title={rule}>{rule}</span>
  </li>
))}
```

- [ ] **Step 4: Add single-line ellipsis styles**

Keep the chip constrained and add a shrinkable text child:

```css
.portfolio-analysis-rules > li {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.portfolio-analysis-rules > li .ui-icon {
  flex: 0 0 auto;
}

.portfolio-analysis-rule__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run the focused unit test to verify GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: all `DesignerLibrary` tests pass.

- [ ] **Step 6: Commit the behavior**

```bash
git add src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/library.css
git commit -m "fix: truncate long analysis rules"
```

### Task 2: Four-Column Designer Repository

**Files:**
- Modify: `tests/e2e/studio.spec.ts:282-335`
- Modify: `src/app/studio/persona.css:890-900`

- [ ] **Step 1: Change the desktop browser expectation to four columns**

Update the existing repository layout assertion:

```ts
const desktopColumns = await repository.locator('.persona-repository__list').evaluate(
  (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length,
);
expect(desktopColumns).toBe(4);
```

Keep the existing long name/signature containment checks and the `680px` single-column assertion.

- [ ] **Step 2: Run the focused browser test to verify RED**

Run:

```bash
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/studio.spec.ts --grep "designer dossier cards"
```

Expected: FAIL with two desktop columns received instead of four.

- [ ] **Step 3: Implement the four-column desktop grid**

Change the grid declaration while preserving the existing narrow breakpoint:

```css
.persona-repository__list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-content: start;
  gap: 12px;
}

@media (max-width: 720px) {
  .persona-repository__list {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 4: Run the focused browser test to verify GREEN**

Run:

```bash
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/studio.spec.ts --grep "designer dossier cards"
```

Expected: PASS at four desktop columns and one narrow column, with all text contained.

- [ ] **Step 5: Commit the repository density change**

```bash
git add src/app/studio/persona.css tests/e2e/studio.spec.ts
git commit -m "style: compact designer repository grid"
```

### Task 3: Browser Rule Verification and Final Checks

**Files:**
- Modify: `tests/e2e/designer-drawer.spec.ts:18-149`

- [ ] **Step 1: Make the E2E candidate contain a deliberately long rule**

Define the rule next to the fixture and use it in the candidate:

```ts
const longNegativeRule = '避免使用会破坏安全边距、信息层级与主体识别度的霓虹渐变和高强度装饰效果';

negativeRules: [
  { zh: longNegativeRule, en: 'Avoid decorative effects that harm hierarchy and subject clarity' },
  { zh: '避免破坏安全边距', en: 'Keep safe margins' },
],
```

- [ ] **Step 2: Add layout and tooltip assertions**

After the analysis report appears, inspect the long rule:

```ts
const ruleText = drawer.getByText(longNegativeRule);
await expect(ruleText).toHaveAttribute('title', longNegativeRule);
const ruleLayout = await ruleText.evaluate((element) => ({
  scrollWidth: element.scrollWidth,
  clientWidth: element.clientWidth,
  whiteSpace: getComputedStyle(element).whiteSpace,
  textOverflow: getComputedStyle(element).textOverflow,
}));
expect(ruleLayout.scrollWidth).toBeGreaterThan(ruleLayout.clientWidth);
expect(ruleLayout.whiteSpace).toBe('nowrap');
expect(ruleLayout.textOverflow).toBe('ellipsis');
```

- [ ] **Step 3: Run the targeted browser suite and inspect screenshots**

Run:

```bash
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts tests/e2e/studio.spec.ts
```

Expected: all targeted browser tests pass. Inspect `portfolio-analysis-result-bottom.png`, `designer-dossier-grid.png`, and `designer-dossier-grid-narrow.png` for rule stability and card density.

- [ ] **Step 4: Run complete verification**

Run:

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts tests/e2e/studio.spec.ts
git diff --check
git status --short --branch
```

Expected: 0 test failures, 0 type errors, 0 lint warnings, successful production build, no diff-check errors, and only the intended browser-test changes before the final commit.

- [ ] **Step 5: Commit the browser regression coverage**

```bash
git add tests/e2e/designer-drawer.spec.ts
git commit -m "test: cover compact designer presentation"
```
