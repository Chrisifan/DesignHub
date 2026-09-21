# Unified Corner Radius Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every ordinary rectangular DesignHub surface and control use the analysis-result panel's `10px` corner radius.

**Architecture:** Define one global `--radius-ui` token, then migrate the nine application stylesheets in independently testable groups. A CSS contract test scans every migrated file and permits only the shared rectangular token plus explicit semantic-shape exceptions.

**Tech Stack:** CSS custom properties, TypeScript, Vitest, React, Vite.

**Spec:** `docs/superpowers/specs/2026-09-21-unified-corner-radius-design.md`

## Global Constraints

- Ordinary rectangular panels, cards, buttons, inputs, menus, popovers, dialogs, thumbnails, and previews use exactly `var(--radius-ui)`.
- `--radius-ui` is exactly `10px`, matching the analysis-result panel.
- Preserve `0`, `50%`, `999px`, `inherit`, `45% 45% 16% 16%`, `40% 40% 30% 30%`, and `0 55% 55% 0` only for their documented square, circular, pill, inherited, or artwork shapes.
- Do not change colors, shadows, spacing, typography, dimensions, markup, or behavior.
- Preserve all pre-existing worktree changes; review any overlapping dirty file before staging it.

---

### Task 1: Add the shared radius token and contract-test foundation

**Files:**
- Create: `src/app-radius-contract.test.ts`
- Modify: `src/app/styles/tokens.css`

**Interfaces:**
- Produces: global CSS custom property `--radius-ui: 10px`.
- Produces: test helper `expectUnifiedRadii(paths: readonly string[]): void` for later migration tasks.

- [ ] **Step 1: Write the failing token contract**

Create `src/app-radius-contract.test.ts` with the scanner and token assertion:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readStyle = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');
const allowedRadii = new Set([
  'var(--radius-ui)',
  '0',
  '50%',
  '999px',
  'inherit',
  '45% 45% 16% 16%',
  '40% 40% 30% 30%',
  '0 55% 55% 0',
]);

const expectUnifiedRadii = (paths: readonly string[]): void => {
  const offenders = paths.flatMap((path) => {
    const source = readStyle(path);
    return Array.from(source.matchAll(/border-radius:\s*([^;]+);/gu)).flatMap((match) => {
      const value = match[1].trim();
      if (allowedRadii.has(value)) return [];
      const line = source.slice(0, match.index).split('\n').length;
      return [`${path}:${line}:${value}`];
    });
  });
  expect(offenders).toEqual([]);
};

describe('application corner radius contract', () => {
  it('defines the analysis-panel radius as the shared rectangular token', () => {
    expect(readStyle('src/app/styles/tokens.css')).toMatch(/--radius-ui:\s*10px;/u);
  });
});

export { expectUnifiedRadii };
```

- [ ] **Step 2: Run the contract and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app-radius-contract.test.ts
```

Expected: FAIL because `tokens.css` does not define `--radius-ui`.

- [ ] **Step 3: Add the global token**

In the shared layout-contract section of `src/app/styles/tokens.css`, add:

```css
--radius-ui: 10px;
```

Keep the token theme-independent; do not duplicate it in dark and light theme blocks.

- [ ] **Step 4: Run the contract and verify GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app-radius-contract.test.ts
```

Expected: 1 test passes.

- [ ] **Step 5: Commit the token foundation**

```bash
git add src/app-radius-contract.test.ts src/app/styles/tokens.css
git commit -m "style: add shared application radius token"
```

### Task 2: Migrate window and shared studio primitives

**Files:**
- Modify: `src/app-radius-contract.test.ts`
- Modify: `src/app/styles/window.css`
- Modify: `src/app/styles/studio.css`
- Modify: `src/app/styles/tokens.css`

**Interfaces:**
- Consumes: `--radius-ui` and `expectUnifiedRadii()` from Task 1.
- Produces: all ordinary rectangular shell and shared-control radii routed through `var(--radius-ui)`.

- [ ] **Step 1: Add the failing core-style contract**

Inside the existing `describe`, add:

```ts
it('uses the shared radius in window and studio primitives', () => {
  expectUnifiedRadii([
    'src/app/styles/window.css',
    'src/app/styles/studio.css',
  ]);
});
```

- [ ] **Step 2: Run the focused contract and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app-radius-contract.test.ts -t "window and studio primitives"
```

Expected: FAIL with fixed values such as `4px`, `6px`, `8px`, `10px`, and `14px` listed as offenders.

- [ ] **Step 3: Replace ordinary rectangular radii**

In `window.css` and `studio.css`, change every non-exempt declaration to:

```css
border-radius: var(--radius-ui);
```

Preserve circle and artwork declarations from Global Constraints. Replace the single `border-radius: var(--content-card-radius)` declaration with `border-radius: 0`, remove the now-unused `--content-card-radius`, replace `border-radius: var(--scrollbar-radius)` with `border-radius: 999px`, and remove the now-unused `--scrollbar-radius`.

- [ ] **Step 4: Verify the focused contract and stylesheet references**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app-radius-contract.test.ts -t "window and studio primitives"
rg -n -- "--content-card-radius|--scrollbar-radius" src/app
```

Expected: the test passes and `rg` returns no matches.

- [ ] **Step 5: Commit the shared primitive migration**

```bash
git add src/app-radius-contract.test.ts src/app/styles/window.css src/app/styles/studio.css src/app/styles/tokens.css
git commit -m "style: unify shared control radii"
```

### Task 3: Migrate home, project, canvas, conversation, and workbench surfaces

**Files:**
- Modify: `src/app-radius-contract.test.ts`
- Modify: `src/app/studio/studio-home.css`
- Modify: `src/app/studio/project-detail.css`
- Modify: `src/app/studio/project-canvas.css`
- Modify: `src/app/studio/conversation-dock.css`
- Modify: `src/app/studio/workbench.css`

**Interfaces:**
- Consumes: `--radius-ui` and `expectUnifiedRadii()` from Task 1.
- Produces: a consistent `10px` rectangular radius across primary creation, project, canvas, and editing workflows.

- [ ] **Step 1: Add the failing primary-workflow contract**

Inside the contract suite, add:

```ts
it('uses the shared radius in primary creation and editing workflows', () => {
  expectUnifiedRadii([
    'src/app/studio/studio-home.css',
    'src/app/studio/project-detail.css',
    'src/app/studio/project-canvas.css',
    'src/app/studio/conversation-dock.css',
    'src/app/studio/workbench.css',
  ]);
});
```

- [ ] **Step 2: Run the focused contract and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app-radius-contract.test.ts -t "primary creation and editing workflows"
```

Expected: FAIL with the existing fixed rectangular radii, including the conversation dock's `22px` and the mobile override's `18px`.

- [ ] **Step 3: Replace primary-workflow rectangular radii**

In all five listed stylesheets, use:

```css
border-radius: var(--radius-ui);
```

Keep only the Global Constraints exceptions. In particular, keep avatar/status circles and pill actions unchanged, remove or normalize the compact conversation dock's responsive `18px` override, and change the analysis panel's literal `10px` to the shared token so it remains the reference without duplicating the value.

- [ ] **Step 4: Run focused visual-component tests and the contract**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/app-radius-contract.test.ts \
  src/project-canvas-styles.test.ts \
  src/app/studio/ProjectCanvas.test.tsx \
  src/app/studio/ConversationDock.test.tsx \
  src/app/studio/ProjectDetailPage.test.tsx
```

Expected: all selected tests pass. If `src/project-canvas-styles.test.ts` is still untracked from the approved canvas work, keep it and include it only with that work's eventual commit.

- [ ] **Step 5: Review and commit only approved hunks**

Run `git diff -- src/app/studio/project-canvas.css` before staging because that file already contains approved background and shadow work. Then stage the five migrated stylesheets and the radius contract without discarding or rewriting the existing changes:

```bash
git add src/app-radius-contract.test.ts \
  src/app/studio/studio-home.css \
  src/app/studio/project-detail.css \
  src/app/studio/project-canvas.css \
  src/app/studio/conversation-dock.css \
  src/app/studio/workbench.css
git diff --cached --check
git commit -m "style: unify project workflow radii"
```

### Task 4: Migrate designer and library surfaces

**Files:**
- Modify: `src/app-radius-contract.test.ts`
- Modify: `src/app/studio/persona.css`
- Modify: `src/app/studio/library.css`

**Interfaces:**
- Consumes: `--radius-ui` and `expectUnifiedRadii()` from Task 1.
- Produces: a consistent rectangular radius across designer profiles, drawers, library cards, forms, previews, and dialogs.

- [ ] **Step 1: Add the failing designer/library contract**

Inside the contract suite, add:

```ts
it('uses the shared radius in designer and library surfaces', () => {
  expectUnifiedRadii([
    'src/app/studio/persona.css',
    'src/app/studio/library.css',
  ]);
});
```

- [ ] **Step 2: Run the focused contract and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app-radius-contract.test.ts -t "designer and library surfaces"
```

Expected: FAIL with fixed rectangular values from `2px` through `12px`.

- [ ] **Step 3: Replace designer/library rectangular radii**

Change ordinary rectangular declarations in both files to:

```css
border-radius: var(--radius-ui);
```

Preserve `50%`, `999px`, `inherit`, and the persona artwork shape `45% 45% 16% 16%`. Do not change artwork geometry, avatar clipping, or pill controls.

- [ ] **Step 4: Run the focused contract and component tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/app-radius-contract.test.ts \
  src/app/studio/DesignerProfileCard.test.tsx \
  src/app/studio/LibraryPages.test.tsx
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit the designer/library migration**

```bash
git add src/app-radius-contract.test.ts src/app/studio/persona.css src/app/studio/library.css
git diff --cached --check
git commit -m "style: unify designer and library radii"
```

### Task 5: Verify the complete radius system

**Files:**
- Verify: `src/app-radius-contract.test.ts`
- Verify: all nine migrated application stylesheets

**Interfaces:**
- Consumes: all prior migration tasks.
- Produces: evidence that the CSS contract, application build, and representative UI remain valid.

- [ ] **Step 1: Verify no unapproved radius values remain**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app-radius-contract.test.ts
rg -n --glob '*.css' "border-radius" src/app
```

Expected: the contract passes; manual output contains only `var(--radius-ui)` and Global Constraints exceptions.

- [ ] **Step 2: Run lint, typecheck, and production build**

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Expected: lint and build pass. If typecheck still reports the pre-existing `src/app/studio/Studio.tsx:576` `generationRatio` mismatch, record it separately and verify no new type errors appear.

- [ ] **Step 3: Run the complete unit suite**

```bash
pnpm test:unit
```

Expected: the new radius contract passes. Compare failures against the known baseline of 23 unrelated failures in `Studio.test.tsx` and `Workbench.test.tsx`; no new failure may be introduced.

- [ ] **Step 4: Inspect representative application surfaces**

Start the desktop application with `pnpm start` and inspect light-theme home, project detail, project canvas, workbench, designer library, modal, and popover surfaces. Confirm ordinary rectangles are `10px`, circles remain circles, pills remain pills, artwork shapes are unchanged, and no clipping or focus-ring regression is visible.

- [ ] **Step 5: Record final evidence**

Run:

```bash
git diff --check
git status --short
```

Summarize passing focused tests, build/lint status, the known baseline failures, and every file changed. Do not claim the complete suite is green while baseline failures remain.
