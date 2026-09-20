# Unified Page Content Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every regular studio page use one responsive page-padding contract while preserving canvas, welcome, dialog, drawer, and internal panel layouts.

**Architecture:** Define four page-padding custom properties in the shared token layer and update their values at the existing wide, compact, and narrow breakpoints. Make `.page-content` the only consumer of those properties, then remove page-level padding overrides from project detail and designer library styles while retaining their layout and scrolling behavior.

**Tech Stack:** CSS custom properties, responsive media queries, Vitest layout contract tests, React/Electron build tooling.

---

## File map

- `src/app/styles/tokens.css`: owns the responsive page-padding values.
- `src/app/styles/studio.css`: owns the generic `.page-content` container and existing viewport breakpoints.
- `src/app/studio/project-detail.css`: owns project-detail-specific layout, but no longer page-level padding.
- `src/app/studio/persona.css`: owns designer-library-specific layout and internal scrolling, but no longer page-level padding.
- `tests/integration/layout-contract.test.ts`: protects the shared spacing contract and prevents new page-level overrides.

Because these files already contain unrelated user changes on `main`, implementation steps must not create a mixed commit. Leave the implementation changes in the working tree unless the user later asks for a dedicated commit and the relevant hunks can be isolated safely.

### Task 1: Lock the unified spacing contract with a failing test

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`

- [ ] **Step 1: Add a focused layout-contract test**

Append this test after the existing shared-layout-token test:

```ts
it('uses one responsive page-content spacing contract across regular pages', () => {
  const tokens = readStyle('../../src/app/styles/tokens.css');
  const studioStyles = readStyle('../../src/app/styles/studio.css');
  const detailStyles = readStyle('../../src/app/studio/project-detail.css');
  const personaStyles = readStyle('../../src/app/studio/persona.css');

  expect(tokens).toMatch(/--page-content-padding-block-start:\s*24px/);
  expect(tokens).toMatch(/--page-content-padding-inline:\s*28px/);
  expect(tokens).toMatch(/--page-content-padding-block-end:\s*20px/);
  expect(tokens).toMatch(
    /@media \(min-width:\s*1440px\)[\s\S]*?--page-content-padding-block-start:\s*28px[\s\S]*?--page-content-padding-inline:\s*32px[\s\S]*?--page-content-padding-block-end:\s*24px/,
  );
  expect(tokens).toMatch(
    /@media \(max-width:\s*1279px\)[\s\S]*?--page-content-padding-block-start:\s*20px[\s\S]*?--page-content-padding-inline:\s*24px[\s\S]*?--page-content-padding-block-end:\s*16px/,
  );
  expect(tokens).toMatch(
    /@media \(max-width:\s*560px\)[\s\S]*?--page-content-padding-block-start:\s*16px[\s\S]*?--page-content-padding-inline:\s*16px[\s\S]*?--page-content-padding-block-end:\s*16px/,
  );

  const pageContentRule = studioStyles.match(/\.page-content\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const projectDetailRule = detailStyles.match(
    /\.page-content\.project-detail-page\s*\{([\s\S]*?)\n\}/u,
  )?.[1] ?? '';
  const designerLibraryRule = personaStyles.match(
    /\.page-content\.designer-library-page\s*\{([\s\S]*?)\n\}/u,
  )?.[1] ?? '';
  expect(pageContentRule).toMatch(/padding:\s*var\(--page-content-padding-block-start\)\s+var\(--page-content-padding-inline\)\s+var\(--page-content-padding-block-end\)/);
  expect(projectDetailRule).not.toMatch(/padding:/u);
  expect(designerLibraryRule).not.toMatch(/padding:/u);
  expect(detailStyles).not.toMatch(/\.page-content\.project-detail-page\s*\{[^}]*padding:/u);
  expect(personaStyles).not.toMatch(/\.designer-library-page\s*\{[^}]*padding:/u);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL because the `--page-content-padding-*` properties do not exist and the project-detail/designer rules still contain hard-coded page padding.

### Task 2: Introduce shared responsive spacing tokens

**Files:**
- Modify: `src/app/styles/tokens.css`
- Modify: `src/app/styles/studio.css`

- [ ] **Step 1: Add standard-window values to the shared layout-token block**

Add these declarations beside the existing toolbar and content layout tokens in the final `:root` block:

```css
--page-content-padding-block-start: 24px;
--page-content-padding-inline: 28px;
--page-content-padding-block-end: 20px;
```

- [ ] **Step 2: Add responsive token overrides after the final `:root` block**

```css
@media (min-width: 1440px) {
  :root {
    --page-content-padding-block-start: 28px;
    --page-content-padding-inline: 32px;
    --page-content-padding-block-end: 24px;
  }
}

@media (max-width: 1279px) {
  :root {
    --page-content-padding-block-start: 20px;
    --page-content-padding-inline: 24px;
    --page-content-padding-block-end: 16px;
  }
}

@media (max-width: 560px) {
  :root {
    --page-content-padding-block-start: 16px;
    --page-content-padding-inline: 16px;
    --page-content-padding-block-end: 16px;
  }
}
```

- [ ] **Step 3: Make `.page-content` consume the shared values**

Replace its literal padding declaration in `src/app/styles/studio.css` with:

```css
padding: var(--page-content-padding-block-start)
  var(--page-content-padding-inline)
  var(--page-content-padding-block-end);
```

- [ ] **Step 4: Remove the three now-redundant `.page-content` breakpoint overrides**

Delete only these declarations from `src/app/styles/studio.css`:

```css
@media (min-width: 1440px) {
  .page-content {
    padding: 28px 32px 24px;
  }
}
```

```css
@media (max-width: 1279px) {
  .page-content {
    padding: 20px 24px 16px;
  }
}
```

```css
@media (max-width: 560px) {
  .page-content {
    padding: 16px;
  }
}
```

Keep all other declarations inside those media queries unchanged.

- [ ] **Step 5: Run the focused test and confirm it still fails only on page-specific overrides**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL only because project detail and designer library still override page-level padding.

### Task 3: Remove page-specific padding without changing page behavior

**Files:**
- Modify: `src/app/studio/project-detail.css`
- Modify: `src/app/studio/persona.css`

- [ ] **Step 1: Remove project-detail page padding overrides**

Delete the `padding` declaration from the base `.page-content.project-detail-page` rule:

```css
padding: 20px clamp(24px, 4vw, 56px) 48px;
```

Delete only the padding declaration from the `@media (max-width: 720px)` project-detail rule:

```css
padding: 16px 14px 40px;
```

Keep its `gap: 18px` declaration and every other project-detail layout rule.

- [ ] **Step 2: Remove designer-library page padding overrides**

Delete the base declaration:

```css
padding: 24px 28px 18px;
```

Delete only `.designer-library-page { padding: ...; }` from the `max-width: 1080px` and `max-width: 560px` media queries. Keep the designer grid, inspector, heading, and internal-scroll declarations unchanged.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: PASS, including the pre-existing scrolling, fixed-card-width, and project-detail responsiveness assertions.

### Task 4: Regression verification

**Files:**
- Verify only; no additional production changes expected.

- [ ] **Step 1: Run related UI tests**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/ProjectDetailPage.test.tsx src/app/studio/DesignerProfileCard.test.tsx tests/integration/layout-contract.test.ts
```

Expected: all tests pass with no unhandled errors.

- [ ] **Step 2: Run static checks**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: both commands exit with code 0.

- [ ] **Step 3: Run the production build**

Run:

```bash
pnpm build
```

Expected: build exits with code 0; the existing bundle-size warning is acceptable.

- [ ] **Step 4: Check patch integrity and working-tree scope**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Existing unrelated modifications remain present and untouched; the spacing implementation appears only in the five files listed in this plan.

- [ ] **Step 5: Leave implementation uncommitted**

Do not create a mixed implementation commit from the already-dirty shared files. Report the verified changes and wait for an explicit user request before isolating or committing them.
