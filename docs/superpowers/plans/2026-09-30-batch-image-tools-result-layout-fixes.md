# Batch Image Tools Result Layout Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the batch image-tool result layout, remove duplicate labeling, restore the output-directory icon, add functional card sizing, and make transparency previews theme-aware.

**Architecture:** Keep the behavior local to `JobDetail`: one local card-size state controls a semantic grid modifier and two accessible buttons. Styling remains in the existing final image-tool override block so it extends, rather than rewrites, the current workbench. Existing theme tokens generate the transparency grid without adding a second theme system.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Playwright.

---

### Task 1: Lock the result-toolbar behavior with component tests

**Files:**
- Modify: `src/features/image-tools/ImageToolsPage.test.tsx`
- Test: `src/features/image-tools/ImageToolsPage.test.tsx`

- [ ] **Step 1: Add failing assertions for the single title and directory icon**

Add assertions to the workbench test that `处理结果` appears once, `逐图结果` is absent, and the `打开结果目录` button contains a `.ui-icon`.

- [ ] **Step 2: Add a failing card-size interaction test**

Render the page, assert the result grid begins with `is-compact`, click `大图卡片`, assert `is-large` and `aria-pressed="true"`, then click `紧凑卡片` and assert the grid returns to `is-compact`.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npx vitest run --config vitest.config.ts src/features/image-tools/ImageToolsPage.test.tsx`

Expected: FAIL because the duplicate title remains, `folder-output.svg` is missing, and the existing control has no state or click behavior.

### Task 2: Implement the accessible card-size control and supported icon

**Files:**
- Modify: `src/features/image-tools/ImageToolsPage.tsx`
- Test: `src/features/image-tools/ImageToolsPage.test.tsx`

- [ ] **Step 1: Add local card-size state**

Inside `JobDetail`, add `const [cardSize, setCardSize] = useState<"compact" | "large">("compact");`.

- [ ] **Step 2: Simplify the results heading**

Render only `<h3>{t(locale, "处理结果", "Results")}</h3>` and replace the decorative grid/list buttons with `紧凑卡片` and `大图卡片` buttons that update state and expose `aria-pressed`.

- [ ] **Step 3: Connect state to the result grid**

Set the grid class to `image-tools-result-grid is-${cardSize}` so CSS controls real card geometry.

- [ ] **Step 4: Replace unsupported directory icons**

Change both `folder-output` button icons in the new-job drawer and selected-job overview to the confirmed asset `folder-open`.

- [ ] **Step 5: Run the component test and verify GREEN**

Run: `npx vitest run --config vitest.config.ts src/features/image-tools/ImageToolsPage.test.tsx`

Expected: PASS.

### Task 3: Align columns and style both card sizes and the theme-aware grid

**Files:**
- Modify: `src/app/studio/library.css`
- Modify: `tests/e2e/image-tools-layout.spec.ts`
- Test: `tests/e2e/image-tools-layout.spec.ts`

- [ ] **Step 1: Add failing layout coverage**

Extend the Playwright fixture to include the workbench, sidebar, overview, compact/large grid modifiers, and a completed preview. Assert sidebar and overview top coordinates match, compact preview height is smaller than large preview height, and light/dark checkerboard computed backgrounds differ.

- [ ] **Step 2: Run the layout test and verify RED**

Run: `npx playwright test --config playwright.config.ts tests/e2e/image-tools-layout.spec.ts`

Expected: FAIL because the modifier styles and semantic checker colors do not exist.

- [ ] **Step 3: Add final scoped CSS overrides**

Set `.image-tools-job-detail` top padding to zero, style the size control as a compact segmented group, define compact and large grid/card geometry, and use `color-mix()` with `--surface-container-lowest`, `--surface-container-high`, and `--on-surface` for the checkerboard. Keep the result grid as the only scrolling element.

- [ ] **Step 4: Run the layout test and verify GREEN**

Run: `npx playwright test --config playwright.config.ts tests/e2e/image-tools-layout.spec.ts`

Expected: PASS.

### Task 4: Regression verification

**Files:**
- Verify: `src/features/image-tools/ImageToolsPage.tsx`
- Verify: `src/app/studio/library.css`
- Verify: `src/features/image-tools/ImageToolsPage.test.tsx`
- Verify: `tests/e2e/image-tools-layout.spec.ts`

- [ ] **Step 1: Run related unit tests**

Run: `npx vitest run --config vitest.config.ts src/features/image-tools/ImageToolsPage.test.tsx src/app/Studio.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run the focused end-to-end test**

Run: `npx playwright test --config playwright.config.ts tests/e2e/image-tools-layout.spec.ts`

Expected: PASS.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: PASS with no TypeScript or asset-resolution errors.
