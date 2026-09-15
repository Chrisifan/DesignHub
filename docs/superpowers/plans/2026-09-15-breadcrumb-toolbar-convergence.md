# Breadcrumb Toolbar Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every applicable page filter, search field, view switch, and page action into the workspace breadcrumb toolbar in the approved fixed order.

**Architecture:** Add a shared React toolbar host/slot pair so page-owned controls can render in Studio’s persistent toolbar without moving their state out of the page that owns it. Studio composes project controls directly; library destinations portal their active controls into the same host. Existing page headers remain semantic/accessible context only, and obsolete content-level control bars are removed.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, existing DesignHub CSS tokens and UI primitives.

---

## File structure

- Create: `src/app/studio/PageToolbar.tsx` — reusable host and portal slot that mounts page controls in the Studio toolbar only while a destination is active.
- Create: `src/app/studio/PageToolbar.test.tsx` — unit coverage for slot placement and inactive-slot suppression.
- Modify: `src/app/studio/Studio.tsx` — host the global slot and compose the project-library/project-detail controls.
- Modify: `src/app/studio/LibraryPages.tsx` — pass active state into subpages and render asset/delivery controls through the slot.
- Modify: `src/app/studio/DesignerLibrary.tsx` — render the designer filter/search/create controls through the slot.
- Modify: `src/app/studio/PersonaRepository.tsx` — separate the repository’s visible list controls from the reusable toolbar control fragment.
- Modify: `src/app/studio/ui.tsx` — simplify `PageHeader` to semantic page context rather than a second action host.
- Modify: `src/app/styles/studio.css` — add shared compact segmented controls and responsive toolbar wrapping; remove project-content toolbar layout rules.
- Modify: `src/app/studio/library.css` and `src/app/studio/persona.css` — remove rules that only positioned migrated controls in page content.
- Modify: `src/app/Studio.test.tsx`, `src/app/studio/LibraryPages.test.tsx`, `src/app/studio/DesignerLibrary.test.tsx`, and `src/app/studio/PageHeader.test.tsx` — assert ownership, order, behavior, and accessibility after migration.

### Task 1: Create the shared toolbar host and slot

**Files:**

- Create: `src/app/studio/PageToolbar.tsx`
- Create: `src/app/studio/PageToolbar.test.tsx`

- [ ] **Step 1: Write the failing host/slot tests**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PageToolbarHost, PageToolbarSlot } from './PageToolbar';

it('mounts active page controls inside the shared toolbar host', () => {
  render(
    <PageToolbarHost>
      <PageToolbarSlot active><input aria-label="搜索素材" /></PageToolbarSlot>
    </PageToolbarHost>,
  );
  expect(screen.getByRole('banner')).toContainElement(screen.getByRole('searchbox', { name: '搜索素材' }));
});

it('does not mount controls from an inactive destination', () => {
  render(<PageToolbarHost><PageToolbarSlot active={false}><button>导入</button></PageToolbarSlot></PageToolbarHost>);
  expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/PageToolbar.test.tsx`

Expected: FAIL because `./PageToolbar` does not exist.

- [ ] **Step 3: Implement the portal host and slot**

```tsx
import { createContext, createPortal, useContext, useState, type ReactNode } from 'react';

const PageToolbarTarget = createContext<HTMLElement | null>(null);

export const PageToolbarHost = ({ children }: { children?: ReactNode }) => {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return (
    <PageToolbarTarget.Provider value={target}>
      <div ref={setTarget} className="toolbar-actions" aria-label="页面工具">
        {children}
      </div>
    </PageToolbarTarget.Provider>
  );
};

export const PageToolbarSlot = ({ active, children }: { active: boolean; children?: ReactNode }) => {
  const target = useContext(PageToolbarTarget);
  return active && target ? createPortal(children, target) : null;
};
```

Keep `PageToolbarHost` inside the existing `header[role=banner]` so the portal is part of the workspace toolbar in both DOM and accessibility order.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/PageToolbar.test.tsx`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/studio/PageToolbar.tsx src/app/studio/PageToolbar.test.tsx
git commit -m "feat: add shared page toolbar host"
```

### Task 2: Move project-library controls into the breadcrumb toolbar

**Files:**

- Modify: `src/app/studio/Studio.tsx:644-810`
- Modify: `src/app/styles/studio.css:438-531`
- Modify: `src/app/Studio.test.tsx:70-110`

- [ ] **Step 1: Write the failing project-toolbar order test**

```tsx
it('orders project controls in the workspace toolbar', () => {
  enter();
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });
  const controls = within(toolbar).getAllByRole('button');
  expect(controls.map((control) => control.getAttribute('aria-label') ?? control.textContent)).toEqual(expect.arrayContaining([
    '进行中', '已归档', '全部项目', '搜索项目', '网格视图', '列表视图', '新建项目',
  ]));
  expect(screen.queryByLabelText('项目状态')).not.toBeInTheDocument();
});
```

Also retain the existing assertion that `新建项目` has exactly one button instance.

- [ ] **Step 2: Run the focused Studio test to verify it fails**

Run: `pnpm vitest run --config vitest.config.ts src/app/Studio.test.tsx -t "orders project controls"`

Expected: FAIL because status/search/view controls still render under `.project-controls`.

- [ ] **Step 3: Compose project controls in `toolbarActions` and host them**

Replace the projects-list branch of `toolbarActions` with this ordered structure (using existing state setters and localized labels):

```tsx
<>
  <div className="toolbar-segmented" role="group" aria-label={t(locale, '项目状态', 'Project status')}>
    {(['active', 'archived', 'all'] as const).map((value) => (
      <button type="button" key={value} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>
        {projectFilterLabel(value)}
      </button>
    ))}
  </div>
  <label className="toolbar-search">
    <Icon name="search" size={16} />
    <span className="sr-only">{t(locale, '搜索项目', 'Search projects')}</span>
    <input type="search" aria-label={t(locale, '搜索项目', 'Search projects')} value={query} onChange={(event) => setQuery(event.target.value)} />
  </label>
  <div className="view-toggle" role="group" aria-label={t(locale, '展示方式', 'Display mode')}>{/* existing grid/list IconButtons */}</div>
  <IconButton name="plus" label={t(locale, '新建项目', 'New project')} onClick={() => openNewDesign()} />
</>
```

Render `<PageToolbarHost>{toolbarActions}</PageToolbarHost>` in place of the raw `.toolbar-actions` container. Delete the duplicated `.project-controls` markup from the projects page. Move project-detail `PageHeader` children (rename, duplicate, archive) into its `toolbarActions` branch as `IconButton`s, preserving current writable and archived guards; leave export/open-workbench in that same action position.

- [ ] **Step 4: Add shared toolbar styles and remove project-content placement styles**

Replace `.project-controls`, `.project-search-tools`, and the underlined `.tab-strip` styling used only for projects with `.toolbar-segmented`, `.toolbar-search`, and `.toolbar-actions` rules. The segmented group must use a shared quiet container, a padded active item, and no underline. Keep existing `--toolbar-control-height`, tokenized borders, `aria-pressed` active color, and the 32px control height.

- [ ] **Step 5: Run focused Studio tests to verify they pass**

Run: `pnpm vitest run --config vitest.config.ts src/app/Studio.test.tsx -t "breadcrumb toolbar|orders project controls|preserves project search"`

Expected: PASS; search still retains its value across destination changes.

- [ ] **Step 6: Commit**

```bash
git add src/app/studio/Studio.tsx src/app/styles/studio.css src/app/Studio.test.tsx
git commit -m "feat: converge project controls in breadcrumb toolbar"
```

### Task 3: Portal asset and designer controls into the shared toolbar

**Files:**

- Modify: `src/app/studio/Studio.tsx:1120-1148`
- Modify: `src/app/studio/LibraryPages.tsx:173-329,1620-1670`
- Modify: `src/app/studio/DesignerLibrary.tsx:760-790`
- Modify: `src/app/studio/PersonaRepository.tsx:35-116`
- Modify: `src/app/studio/library.css:365-422,1533-1557`
- Modify: `src/app/studio/persona.css:361-389,765-779,919-952`
- Modify: `src/app/studio/LibraryPages.test.tsx:70-105`
- Modify: `src/app/studio/DesignerLibrary.test.tsx:15-40`

- [ ] **Step 1: Write failing toolbar-placement tests for assets and designers**

```tsx
it('places asset type, search, view, and import controls in the toolbar order', () => {
  render(<Studio /* existing preview props */ />);
  fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '素材库' }));
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });
  expect(within(toolbar).getByRole('group', { name: '类型' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('searchbox', { name: '搜索素材' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('group', { name: '视图' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: '导入' })).toBeInTheDocument();
});

it('places designer status before its search without adding a view switch', () => {
  render(<DesignerLibrary /* existing preview props plus active toolbar host */ />);
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });
  expect(within(toolbar).getByRole('group', { name: '档案状态' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('searchbox', { name: '搜索档案' })).toBeInTheDocument();
  expect(within(toolbar).queryByRole('group', { name: '视图' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx src/app/studio/DesignerLibrary.test.tsx -t "toolbar"`

Expected: FAIL because the controls remain within `.asset-toolbar` and `.persona-repository__toolbar`.

- [ ] **Step 3: Thread active destination state to library pages**

Pass `active={surface === item.view && view === item.view}` from the `Studio` destination map to `LibraryPages`. Add `active: boolean` to `LibraryPagesProps` and forward it only to the active-capable Assets and Designers components. This prevents all persistently mounted hidden destinations from portaling competing controls into the one host.

- [ ] **Step 4: Build and portal the assets sequence**

In `AssetsPage`, replace the content-level `.asset-toolbar` with an active `PageToolbarSlot` containing exactly:

```tsx
<div className="toolbar-segmented" role="group" aria-label={t(locale, '类型', 'Type')}>
  {assetTypes.map(({ value, label }) => <button type="button" key={value} aria-pressed={type === value} className={type === value ? 'is-active' : ''} onClick={() => onTypeChange(value)}>{label}</button>)}
</div>
<label className="toolbar-search">{/* existing search icon, sr-only label, and controlled search input */}</label>
<div className="view-toggle" role="group" aria-label={t(locale, '视图', 'View')}>{/* existing grid/list IconButtons */}</div>
{usingManagedAssets && <><input id={inputId} type="file" multiple hidden onChange={...} /><IconButton name="upload" label={importing ? t(locale, '导入中', 'Importing') : t(locale, '导入', 'Import')} disabled={readOnly || importing} onClick={() => document.getElementById(inputId)?.click()} /></>}
```

Do not move the result count; it remains by the asset collection as content metadata. Preserve controlled query/type/layout values and import error/read-only behavior.

- [ ] **Step 5: Build and portal the designers sequence**

Add `toolbarActive` to `DesignerLibrary` and `PersonaRepository`. Move only PersonaRepository’s status filter, search input, and existing create icon from `.persona-repository__toolbar` into `PageToolbarSlot`; render the fragment as compact segmented status → search → create action. Keep the repository title/count and list in the content panel. Preserve the component’s controlled-or-local fallback behavior and the existing create callback.

- [ ] **Step 6: Remove obsolete local positioning CSS**

Delete `.asset-toolbar` and `.persona-repository__toolbar` layout selectors once no JSX uses those classes. Update shared `.search-control` styles to apply to `.toolbar-search` where necessary, but keep component-local search styles that are still used outside the workspace toolbar.

- [ ] **Step 7: Run focused suites to verify the behavior stays green**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/PersonaRepository.test.tsx`

Expected: PASS; asset filtering, asset drawer selection, designer filtering, and designer drawer selection still work.

- [ ] **Step 8: Commit**

```bash
git add src/app/studio/Studio.tsx src/app/studio/LibraryPages.tsx src/app/studio/DesignerLibrary.tsx src/app/studio/PersonaRepository.tsx src/app/studio/library.css src/app/studio/persona.css src/app/studio/LibraryPages.test.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/PersonaRepository.test.tsx
git commit -m "feat: move library controls into breadcrumb toolbar"
```

### Task 4: Migrate remaining header actions, simplify PageHeader, and verify responsive behavior

**Files:**

- Modify: `src/app/studio/LibraryPages.tsx:495-510,981-1004`
- Modify: `src/app/studio/ui.tsx:202-223`
- Modify: `src/app/studio/PageHeader.test.tsx`
- Modify: `src/app/styles/studio.css:1540-1635`
- Modify: `src/app/Studio.test.tsx`

- [ ] **Step 1: Write failing tests for legacy header actions and narrow toolbar structure**

```tsx
it('does not render page actions inside PageHeader', () => {
  render(<PageHeader title="项目库"> <button type="button">新建</button> </PageHeader>);
  expect(screen.queryByRole('button', { name: '新建' })).not.toBeInTheDocument();
});

it('keeps delivery package export in the workspace toolbar', () => {
  render(<LibraryPages /* persisted delivery fixture, active toolbar host */ />);
  expect(within(screen.getByRole('banner', { name: '工作区工具栏' })).getByRole('button', { name: '导出项目包' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/PageHeader.test.tsx src/app/studio/LibraryPages.test.tsx -t "PageHeader|workspace toolbar"`

Expected: FAIL because `PageHeader` still renders children and delivery’s export action remains inside it.

- [ ] **Step 3: Complete remaining action migration**

Remove the `children` API and `.page-heading__actions` wrapper from `PageHeader`, then remove all page-header children at call sites. For delivery, use an active `PageToolbarSlot` with its existing `IconButton` for `导出项目包`; do not invent controls for brands, connections, tasks, storage, settings, workbench, or new-design flows that do not already have page-header-level actions. Retain their semantic page headers and existing body tabs.

- [ ] **Step 4: Implement mobile wrapping without horizontal overflow**

At the existing 720px breakpoint, allow `.studio-toolbar` and `.toolbar-actions` to wrap, preserve `.toolbar-location` as the first row, and make `.toolbar-search` flex between a minimum readable width and the available row width. Keep `.toolbar-segmented`, view buttons, and icon actions in document order; do not hide controls or introduce horizontal page scrolling.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/PageHeader.test.tsx src/app/studio/LibraryPages.test.tsx src/app/Studio.test.tsx`

Expected: PASS with no duplicate toolbar actions and no regression in existing Studio navigation behavior.

- [ ] **Step 6: Run full automated verification**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 7: Perform manual visual verification**

Run: `pnpm start`

At desktop and at 560px-wide viewport, inspect projects, assets, designers, brands, connections, tasks, delivery, storage, and settings. Confirm the toolbar has only applicable controls; assets use type → search → view → import; designers use status → search → create; project state/search/view/new-project use the same sequence; and each control remains keyboard reachable.

- [ ] **Step 8: Commit**

```bash
git add src/app/studio/LibraryPages.tsx src/app/studio/ui.tsx src/app/studio/PageHeader.test.tsx src/app/styles/studio.css src/app/Studio.test.tsx src/app/studio/LibraryPages.test.tsx
git commit -m "refactor: consolidate page header actions"
```
