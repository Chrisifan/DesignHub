# Shell Glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the DesignHub window bar, global toolbar, and desktop navigation shelf as restrained glass surfaces while preserving the approved responsive shell dimensions.

**Architecture:** Keep the React tree unchanged and define shared shell material tokens in `tokens.css`. Apply those tokens only to `window.css` and the shell selectors in `studio.css`; a Playwright contract inspects computed dimensions and CSS material in real Chromium.

**Tech Stack:** React 19, CSS custom properties, Vite, Playwright 1.63, Vitest.

---

### Task 1: Lock the Shell Contract

**Files:**

- Modify: `tests/e2e/studio.spec.ts`

- [x] **Step 1: Write the failing browser test**

```ts
test("desktop shell uses the approved dimensions and glass material", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() =>
    localStorage.setItem("designhub.ui.theme", "dark"),
  );
  await page.goto("/?preview=1");
  const shell = await page.evaluate(() => {
    const inspect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const style = getComputedStyle(element);
      return {
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        backdropFilter: style.backdropFilter,
        backgroundImage: style.backgroundImage,
      };
    };
    return {
      sidebar: inspect(".studio-sidebar"),
      windowBar: inspect(".window-bar"),
      toolbar: inspect(".studio-toolbar"),
    };
  });
  expect(shell.sidebar.width).toBe(280);
  expect(shell.windowBar.height).toBe(40);
  expect(shell.toolbar.height).toBe(44);
  for (const surface of [shell.sidebar, shell.windowBar, shell.toolbar]) {
    expect(surface.backdropFilter).toContain("blur(");
    expect(surface.backgroundImage).not.toBe("none");
  }
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `DESIGNHUB_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm exec playwright test --config playwright.ui.config.ts --grep 'desktop shell uses the approved dimensions'`

Expected: FAIL because the current computed `backdropFilter` is `none` and the shell background image is `none`.

### Task 2: Add Theme-Aware Shell Material

**Files:**

- Modify: `src/app/styles/tokens.css`
- Modify: `src/app/styles/window.css`
- Modify: `src/app/styles/studio.css`

- [x] **Step 1: Add semantic material tokens**

```css
:root[data-theme="dark"] {
  --shell-glass: linear-gradient(
    135deg,
    rgba(20, 28, 46, 0.9),
    rgba(9, 13, 22, 0.8)
  );
  --shell-glass-border: rgba(255, 255, 255, 0.09);
  --shell-backdrop: blur(20px) saturate(150%);
}
```

- [x] **Step 2: Apply them only to shell surfaces**

```css
.window-bar,
.studio-sidebar,
.studio-toolbar {
  background: var(--shell-glass);
  border-color: var(--shell-glass-border);
  backdrop-filter: var(--shell-backdrop);
  -webkit-backdrop-filter: var(--shell-backdrop);
}
```

- [x] **Step 3: Preserve solid accessibility fallback**

```css
@media (prefers-reduced-transparency: reduce) {
  :root,
  :root[data-theme='dark'],
  :root[data-theme='light'],
  :root:not([data-theme='dark']) {
    --shell-glass: var(--shell-solid);
    --shell-backdrop: none;
  }
}
```

- [x] **Step 4: Run the focused browser test**

Run: `DESIGNHUB_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm exec playwright test --config playwright.ui.config.ts --grep 'desktop shell uses the approved dimensions'`

Expected: PASS.

### Task 3: Cover Theme and Accessibility Variants

**Files:**

- Modify: `tests/e2e/studio.spec.ts`

- [x] **Step 1: Extend the shell material contract to dark and light themes**

The browser contract checks each theme's computed alpha gradient as well as the
approved shell dimensions and 1280px workbench shelf.

- [x] **Step 2: Write the reduced-transparency regression and verify it fails**

The test emulates `prefers-reduced-transparency: reduce` through Chrome DevTools.
It first failed because the later-loaded window bar rule overrode the fallback
declared in `studio.css`.

- [x] **Step 3: Move the fallback to shared material tokens and rerun the focused suite**

The media query now changes `--shell-glass` and `--shell-backdrop`, so every
shell consumer receives the solid treatment regardless of CSS import order.

### Task 4: Verify Appearance and Regression Scope

**Files:**

- Modify: `.superpowers/sdd/2026-09-09-ui-framework/browser-review.mjs`
- Modify: `docs/verification/UI-FRAMEWORK.md`

- [x] **Step 1: Capture dark and light shell screenshots at 1280px and the compact rail at 1024px**

Run: `node .superpowers/sdd/2026-09-09-ui-framework/browser-review.mjs`

Expected: no page errors and no document overflow.

- [x] **Step 2: Run full regression checks**

Run: `pnpm test:unit && pnpm lint && pnpm typecheck && pnpm build`

Expected: all checks exit 0.

- [x] **Step 3: Run the existing UI browser matrix**

Run: `DESIGNHUB_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm exec playwright test --config playwright.ui.config.ts`

Expected: all browser tests pass.

- [x] **Step 4: Commit the focused change**

```bash
git add src/app/styles/tokens.css src/app/styles/window.css src/app/styles/studio.css tests/e2e/studio.spec.ts docs/superpowers/specs/2026-09-10-shell-glass-design.md docs/superpowers/plans/2026-09-10-shell-glass.md docs/verification/UI-FRAMEWORK.md
git commit -m "feat(ui): refine shell glass surfaces"
```
