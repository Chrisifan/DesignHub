# Page Empty State Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the designer repository title row and center full-page empty states in the available page-content area.

**Architecture:** Keep `EmptyState` as the reusable content component and add a page-level wrapper class only at full-page call sites. The wrapper owns available-height sizing and two-axis centering, while embedded panels retain their existing layout. The designer repository removes its local visual header without changing toolbar, list, filtering, or drawer state.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library.

---

### Task 1: Remove the designer repository title row and center its empty state

**Files:**

- Modify: `src/app/studio/PersonaRepository.tsx:67-160`
- Modify: `src/app/studio/persona.css:787-870`
- Modify: `src/app/studio/PersonaRepository.test.tsx`
- Modify: `src/app/studio/DesignerLibrary.test.tsx`

- [ ] **Step 1: Write failing tests for the removed heading and page-level empty wrapper**

```tsx
it('omits the local repository heading while retaining the repository label', () => {
  render(<PersonaRepository locale="zh-CN" profiles={personaProfiles} selectedId="paper-type" onSelect={vi.fn()} />);
  expect(screen.getByLabelText('设计师档案库')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '设计师档案' })).not.toBeInTheDocument();
  expect(screen.queryByText('PERSONA REPOSITORY')).not.toBeInTheDocument();
});

it('wraps an empty designer repository in the page-level empty-state region', () => {
  render(<PersonaRepository locale="zh-CN" profiles={[]} selectedId="" onSelect={vi.fn()} />);
  expect(screen.getByRole('heading', { name: '暂无设计师档案' }).closest('.page-empty-state')).not.toBeNull();
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/PersonaRepository.test.tsx`

Expected: FAIL because the heading and unwrapped empty state are still present.

- [ ] **Step 3: Remove the repository header and apply the full-page empty wrapper**

Delete the `persona-repository__head` JSX from `PersonaRepository`. Change the no-results branch to render the existing `EmptyState` inside `<div className="page-empty-state">`. Keep the `aria-label="设计师档案库"` root, controlled query/status behavior, row selection, and toolbar portal unchanged.

```tsx
{filteredProfiles.length ? <div className="persona-repository__list">{/* existing rows */}</div> : (
  <div className="page-empty-state">
    <EmptyState icon="search" title={...} description={...} />
  </div>
)}
```

Remove the now-unused `.persona-repository__head`, `.persona-repository__title-line`, `.persona-repository__count`, and related responsive rules from `persona.css`. Ensure `.persona-repository` can stretch its child empty region with `flex: 1 1 auto`.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/PersonaRepository.test.tsx src/app/studio/DesignerLibrary.test.tsx`

Expected: PASS; filtering, selection, drawer behavior, and empty repository text remain functional.

- [ ] **Step 5: Commit**

```bash
git add src/app/studio/PersonaRepository.tsx src/app/studio/persona.css src/app/studio/PersonaRepository.test.tsx src/app/studio/DesignerLibrary.test.tsx
git commit -m "refactor: remove designer repository heading"
```

### Task 2: Introduce shared page-level empty-state layout and apply it to full-page cases

**Files:**

- Modify: `src/app/styles/studio.css:1092-1120`
- Modify: `src/app/studio/Studio.tsx:860-905,995-1010`
- Modify: `src/app/studio/LibraryPages.tsx:380-405,512-515,650-680,830-875,1040-1060,1350-1370`
- Modify: `src/app/Studio.test.tsx`
- Modify: `src/app/studio/LibraryPages.test.tsx`

- [ ] **Step 1: Write failing tests for page-level empty wrappers**

```tsx
it('wraps an empty project library in the page-level empty-state region', () => {
  render(<Studio locale="zh-CN" theme="system" onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);
  expect(screen.getByRole('heading', { name: '暂无项目' }).closest('.page-empty-state')).not.toBeNull();
});

it('keeps an asset details failure local to its details panel', async () => {
  // existing failing asset fixture
  expect(screen.getByRole('heading', { name: '素材读取失败' }).closest('.details-panel')).not.toBeNull();
  expect(screen.getByRole('heading', { name: '素材读取失败' }).closest('.page-empty-state')).toBeNull();
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm vitest run --config vitest.config.ts src/app/Studio.test.tsx src/app/studio/LibraryPages.test.tsx -t "page-level empty|details failure"`

Expected: FAIL because full-page empty states have no common wrapper.

- [ ] **Step 3: Add the shared CSS contract**

Add this class near the existing `.empty-state` rules:

```css
.page-empty-state {
  display: grid;
  flex: 1 1 auto;
  min-block-size: clamp(320px, 100%, 720px);
  place-items: center;
}
.page-empty-state > .empty-state {
  width: min(100%, 480px);
}
```

Tune the block-size against the actual `.page-content` and collection flex/grid parents so it fills the scrollable content region without creating viewport overflow. Do not modify `.empty-state` itself.

- [ ] **Step 4: Wrap only full-page empty states**

Apply `<div className="page-empty-state">` around the existing page-primary `EmptyState` instances:

- empty project collection and no project-search results in `Studio.tsx`;
- empty/no-match asset collection in `LibraryPages.tsx` when it is the main collection;
- loading, failure, and no-brand states that replace the entire brands page;
- full-page connections, tasks, storage, and delivery empty states;
- the designer repository state from Task 1.

Do not wrap `details-panel` failures, drawer content, delivery preview internals, split-panel empty panels, or compact loading text. Preserve current buttons, event handlers, and accessible headings.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `pnpm vitest run --config vitest.config.ts src/app/Studio.test.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/PersonaRepository.test.tsx`

Expected: PASS; page-primary empty states have `.page-empty-state`, embedded asset failure remains local, and existing interactions remain unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/app/styles/studio.css src/app/studio/Studio.tsx src/app/studio/LibraryPages.tsx src/app/Studio.test.tsx src/app/studio/LibraryPages.test.tsx
git commit -m "feat: center page empty states"
```

### Task 3: Verify responsive centering and repository-wide behavior

**Files:**

- Modify: `src/app/styles/studio.css:1540-1600` only if the shared empty-state layout needs a narrow-screen override.

- [ ] **Step 1: Add a narrow-layout CSS rule only if needed**

If the desktop class causes overflow under the existing 560px or 720px breakpoints, add this targeted override:

```css
@media (max-width: 560px) {
  .page-empty-state {
    min-block-size: 280px;
  }
}
```

Do not add an override when the desktop rule already fits; avoid duplicate responsive styling.

- [ ] **Step 2: Run full automated verification**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 3: Manually verify at desktop and 560px widths**

Run: `pnpm start`

Inspect the empty project library, empty designer repository, no-match asset collection, empty brands page, connections, tasks, storage, and delivery. Confirm the empty message is centered in the full page-content area, the designer title row is absent, toolbars remain at the top, and panel-level errors remain local.

- [ ] **Step 4: Commit any responsive-only adjustment**

```bash
git add src/app/styles/studio.css
git commit -m "fix: preserve empty state centering on narrow screens"
```
