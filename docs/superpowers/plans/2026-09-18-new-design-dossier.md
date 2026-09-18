# New Design Designer Dossier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the review-and-publish designer dossier on the new-project page and remove the top divider.

**Architecture:** Replace the new page's `DesignerHero` with the existing `DesignerDossier`, keyed from the selected profile. Keep all dossier internals shared and limit layout changes to the new-design page wrapper.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Playwright

---

### Task 1: Lock the shared dossier behavior

**Files:**
- Modify: `src/app/studio/NewDesignPage.test.tsx`

- [ ] **Step 1: Write the failing unit test**

Add assertions that the selected profile appears in a region named `<name>设计师档案`, including `核心指标`, `Style DNA`, and `否定规则`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/NewDesignPage.test.tsx`

Expected: FAIL because `NewDesignPage` still renders `DesignerHero` and does not expose the dossier sections.

- [ ] **Step 3: Replace the hero with the shared dossier**

In `NewDesignPage.tsx`, import `DesignerDossier`, resolve the selected profile once, and render it inside a `new-design-dossier` wrapper when present.

- [ ] **Step 4: Run the focused unit test**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/NewDesignPage.test.tsx`

Expected: PASS.

### Task 2: Remove the divider and constrain the layout

**Files:**
- Modify: `src/app/studio/persona.css`
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Write the failing end-to-end assertions**

Open the new-project page and assert `.new-design-layout` has `border-top-width: 0px`, the dossier is visible, the desktop dossier scrolls independently, and document width does not exceed viewport width.

- [ ] **Step 2: Run the focused end-to-end test to verify it fails**

Run: `pnpm playwright test tests/e2e/studio.spec.ts --config playwright.config.ts -g "new project uses the review designer dossier"`

Expected: FAIL because the layout currently has a one-pixel top border.

- [ ] **Step 3: Update the new-design layout styles**

Remove the layout's top border, replace the direct-child hero selectors with `new-design-dossier` selectors, and add min-width, padding, desktop internal scrolling, and responsive rules that keep the dossier inside the page.

- [ ] **Step 4: Run the focused end-to-end test**

Run: `pnpm playwright test tests/e2e/studio.spec.ts --config playwright.config.ts -g "new project uses the review designer dossier"`

Expected: PASS.

### Task 3: Verify and commit

**Files:**
- Verify all modified source, test, and documentation files.

- [ ] **Step 1: Run unit tests, typecheck, lint, and build**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 2: Run the complete studio end-to-end suite**

Run: `pnpm playwright test tests/e2e/studio.spec.ts --config playwright.config.ts`

Expected: all tests pass.

- [ ] **Step 3: Inspect the desktop and narrow screenshots**

Confirm the dossier matches review-and-publish, the top divider is absent, and no text or content overflows.

- [ ] **Step 4: Commit the implementation**

```bash
git add docs/superpowers/specs/2026-09-18-new-design-dossier-design.md docs/superpowers/plans/2026-09-18-new-design-dossier.md src/app/studio/NewDesignPage.tsx src/app/studio/NewDesignPage.test.tsx src/app/studio/persona.css tests/e2e/studio.spec.ts
git commit -m "feat: reuse designer dossier for new projects"
```
