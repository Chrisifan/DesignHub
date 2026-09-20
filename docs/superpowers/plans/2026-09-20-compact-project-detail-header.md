# Compact Project Detail Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress the project detail cover and summary card to about 330px without losing content, actions, or responsive behavior.

**Architecture:** Keep the existing `ProjectDetailPage` markup and make the change entirely through the page-scoped stylesheet. Extend the existing Playwright layout test to assert the desktop and narrow viewport height bounds, so future spacing changes cannot silently expand the header again.

**Tech Stack:** React, CSS, Playwright, Vitest, TypeScript

---

### Task 1: Lock the compact dimensions with a failing responsive test

**Files:**
- Modify: `tests/e2e/studio.spec.ts:543-573`

- [ ] **Step 1: Tighten the existing project detail layout assertions**

Replace the loose hero-only assertion with explicit header, hero, summary, and description measurements:

```ts
const header = page.getByTestId('project-detail-header');
const summary = page.locator('.project-detail-summary');
const description = page.locator('.project-detail-summary__description');

await expect(header).toBeVisible();
expect(await header.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(340);
expect(await hero.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(160);
expect(await hero.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(176);
expect(await summary.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(164);
expect(await description.evaluate((element) => getComputedStyle(element).webkitLineClamp)).toBe('1');
```

Repeat the header and hero height checks after switching to the `1024 × 900` viewport.

- [ ] **Step 2: Run the test and verify the compact assertions fail**

Run:

```bash
pnpm exec playwright test tests/e2e/studio.spec.ts:543 --config playwright.config.ts
```

Expected: FAIL because the current hero is `240px` and the complete header exceeds `340px`.

### Task 2: Compress the cover and summary spacing

**Files:**
- Modify: `src/app/studio/project-detail.css:1-262`
- Modify: `src/app/studio/project-detail.css:687-728`

- [ ] **Step 1: Apply the desktop compact dimensions**

Use the following page and header values:

```css
.page-content.project-detail-page {
  gap: 20px;
  padding: 20px clamp(24px, 4vw, 56px) 48px;
}

.project-detail-hero,
.project-detail-hero__overlay {
  min-height: 168px;
}

.project-detail-hero__overlay {
  padding: 18px 20px;
}

.project-detail-summary {
  gap: 12px 24px;
  padding: 14px 20px 16px;
}

.project-detail-summary__status {
  margin-bottom: 4px;
}

.project-detail-summary h1 {
  font-size: clamp(28px, 2.3vw, 32px);
}

.project-detail-summary__description {
  min-height: 1.5em;
  margin-top: 5px;
  white-space: normal;
  -webkit-line-clamp: 1;
}

.project-detail-summary__meta {
  min-height: 30px;
  margin-top: 8px;
}
```

- [ ] **Step 2: Preserve compact sizing on narrow screens**

In the `max-width: 720px` media query, keep the cover at `168px`, use `16px` summary padding, and retain the existing single-column action behavior:

```css
.project-detail-hero,
.project-detail-hero__overlay {
  min-height: 168px;
}

.project-detail-hero__overlay {
  padding: 16px;
}

.project-detail-summary {
  padding: 14px 16px 16px;
}
```

- [ ] **Step 3: Run the focused layout test**

Run:

```bash
pnpm build
pnpm exec playwright test tests/e2e/studio.spec.ts:543 --config playwright.config.ts
```

Expected: PASS in both tested viewport sizes.

- [ ] **Step 4: Run component tests**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx
```

Expected: all `ProjectDetailPage` tests pass.

### Task 3: Verify and commit

**Files:**
- Verify: `src/app/studio/project-detail.css`
- Verify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Run full validation**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:e2e
pnpm build
git diff --check
```

Expected: every command exits successfully; build may retain the existing chunk-size and Sharp externalization warnings.

- [ ] **Step 2: Commit the implementation**

```bash
git add src/app/studio/project-detail.css tests/e2e/studio.spec.ts
git commit -m "style: compact project detail header"
```
