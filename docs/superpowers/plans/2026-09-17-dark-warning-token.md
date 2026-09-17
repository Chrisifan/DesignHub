# Dark Warning Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make portfolio texture percentages and progress fills visible in dark mode with the approved warm amber warning colour.

**Architecture:** Define the missing semantic token in the existing shared dark-theme selector rather than adding a component-specific fallback. Verify the token at the stylesheet contract layer and verify its computed colour and percentage width in the existing portfolio drawer browser flow.

**Tech Stack:** CSS custom properties, Vitest, Playwright, React application fixtures.

---

### Task 1: Define and verify the dark warning token

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `tests/e2e/designer-drawer.spec.ts`
- Modify: `src/app/styles/tokens.css:1-59`

- [ ] **Step 1: Add the failing stylesheet contract assertion**

Add a focused test that reads `tokens.css`, extracts the first shared dark-theme block, and requires the approved token:

```ts
it('defines the warning accent in the shared dark theme', () => {
  const tokens = readStyle('../../src/app/styles/tokens.css');
  const darkTheme = tokens.match(/:root,\s*:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';

  expect(darkTheme).toMatch(/--warning:\s*#f6bd60;/u);
});
```

- [ ] **Step 2: Add the failing browser presentation assertion**

After the analysis report appears in `designer-drawer.spec.ts`, locate the `Grain` progressbar and its fill, then assert:

```ts
const grainProgress = drawer.getByRole('progressbar', { name: '纹理颗粒度' });
const grainPresentation = await grainProgress.evaluate((track) => {
  const fill = track.querySelector<HTMLElement>('i')!;
  return {
    token: getComputedStyle(document.documentElement).getPropertyValue('--warning').trim(),
    color: getComputedStyle(fill).backgroundColor,
    ratio: fill.getBoundingClientRect().width / track.getBoundingClientRect().width,
  };
});
expect(grainPresentation.token).toBe('#f6bd60');
expect(grainPresentation.color).toBe('rgb(246, 189, 96)');
expect(grainPresentation.ratio).toBeCloseTo(0.15, 2);
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts tests/integration/layout-contract.test.ts
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: the token contract fails because the dark block has no `--warning`, and the browser test fails because the computed token and fill colour are empty/transparent.

- [ ] **Step 4: Add the approved dark-theme token**

Add the semantic token alongside the other dark theme colours in `src/app/styles/tokens.css`:

```css
:root,
:root[data-theme='dark'] {
  /* existing tokens */
  --warning: #f6bd60;
}
```

Do not change the light-theme `--warning: #f59e0b` value or add a component-level colour fallback.

- [ ] **Step 5: Run focused verification and inspect screenshots**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts tests/integration/layout-contract.test.ts
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: the contract test passes, both browser viewport cases pass, the Grain fill is amber at 15%, and the generated analysis screenshots show visible amber texture-metric fills without overlap.

- [ ] **Step 6: Run the full verification suite**

Run:

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit successfully with no test failures or lint errors.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/app/styles/tokens.css tests/integration/layout-contract.test.ts tests/e2e/designer-drawer.spec.ts
git commit -m "fix: show portfolio metric fills in dark mode"
```
