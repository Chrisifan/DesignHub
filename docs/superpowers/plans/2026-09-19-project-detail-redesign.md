# Project Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the project detail page around the approved cover-led console layout while preserving the product's existing project, document, designer, brand, export, and permission behavior.

**Architecture:** Extract the detail view from `Studio.tsx` into a presentational `ProjectDetailPage` that receives localized display values and callbacks from `Studio`. Keep all persistence and desktop API access in `Studio`; the new component owns only status derivation, markup, and responsive presentation. Use the existing project cover loader, artwork preview, form controls, localization helper, and design tokens.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Playwright, CSS modules-by-convention through imported global styles.

---

## File map

- Create `src/app/studio/ProjectDetailPage.tsx`: render the hero, summary, document collection, project context, collaboration controls, and brand snapshot.
- Create `src/app/studio/ProjectDetailPage.test.tsx`: component-level behavior and permission tests.
- Create `src/app/studio/project-detail.css`: page-scoped layout, surface, responsive, light/dark, and reduced-transparency styles.
- Modify `src/app/studio/Studio.tsx`: replace the inline detail JSX with the component and wire existing stateful operations into callbacks.
- Modify `src/app/Studio.test.tsx`: integration coverage for the extracted detail page inside the real `Studio` flow.
- Modify `tests/integration/layout-contract.test.ts`: static style contract for breakpoints and overflow protection.
- Modify `tests/e2e/studio.spec.ts`: browser-level wide/narrow layout and open-document behavior.

### Task 1: Define the project detail component contract

**Files:**
- Create: `src/app/studio/ProjectDetailPage.test.tsx`
- Create: `src/app/studio/ProjectDetailPage.tsx`
- Create: `src/app/studio/project-detail.css`

- [ ] **Step 1: Write failing tests for the data-led detail view**

Create `src/app/studio/ProjectDetailPage.test.tsx` with focused fixtures and these assertions:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { PersonaProfile } from './personas';
import type { Project } from './types';
import { ProjectDetailPage } from './ProjectDetailPage';

const project: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  documentId: 'poster',
  name: '秋季发布会',
  enName: 'Autumn launch',
  description: '为新品发布准备一套克制、具有材质感的视觉。',
  enDescription: 'A restrained, tactile visual system for the launch.',
  designers: ['林墨'],
  activeDesignerVersionId: 'designer-1',
  contributorDesignerVersionIds: ['designer-1', 'designer-2'],
  designerSnapshot: { version: 'v3.2' },
  brandSnapshot: {
    id: 'brand-1',
    version: 'v2',
    name: 'North Star',
    logo: '',
    colorPalette: ['#111827', '#f97316'],
    fonts: ['Noto Sans SC', 'Fraunces'],
    tone: '冷静、明确',
    fixedCopy: '',
    sizes: [],
  },
  artwork: 'market',
  documents: 2,
  documentEntries: [
    { id: 'poster', name: '主海报', width: 1080, height: 1440, finalizedRevisionId: 'revision-final' },
    { id: 'square', name: '社媒方图', width: 1080, height: 1080, sourceRevisionId: 'revision-source' },
  ],
};

const profiles = [
  { id: 'designer-1', version: 'v3.2', status: 'active', name: { zh: '林墨', en: 'Lin Mo' } },
  { id: 'designer-2', version: 'v1.0', status: 'active', name: { zh: '周野', en: 'Zhou Ye' } },
] as PersonaProfile[];

const renderPage = (overrides: Partial<ComponentProps<typeof ProjectDetailPage>> = {}) => {
  const props: ComponentProps<typeof ProjectDetailPage> = {
    locale: 'zh-CN',
    project,
    profiles,
    writable: true,
    projectTitle: '秋季发布会',
    activeDesignerId: 'designer-1',
    designerLabel: '林墨',
    contributorIds: ['designer-1', 'designer-2'],
    contributorLabel: '林墨、周野',
    onOpenDocument: vi.fn(),
    onExport: vi.fn(),
    onCreateDocument: vi.fn(),
    onSwitchDesigner: vi.fn(),
    onToggleContributor: vi.fn(),
    ...overrides,
  };
  render(<ProjectDetailPage {...props} />);
  return props;
};

describe('ProjectDetailPage', () => {
  it('renders the cover-led summary and opens the primary document', () => {
    const props = renderPage();
    expect(screen.getByRole('img', { name: '秋季发布会项目封面' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '秋季发布会' })).toBeInTheDocument();
    expect(screen.getByText(project.description)).toBeInTheDocument();
    expect(screen.getByText('2 份文档')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '打开画布' })[0]);
    expect(props.onOpenDocument).toHaveBeenCalledWith('poster', 0);
  });

  it('opens the document represented by each card and labels its revision state', () => {
    const props = renderPage();
    expect(screen.getByText('已定稿')).toBeInTheDocument();
    expect(screen.getByText('衍生稿')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开社媒方图' }));
    expect(props.onOpenDocument).toHaveBeenCalledWith('square', 1);
  });

  it('shows real brand fields for a valid snapshot', () => {
    renderPage();
    expect(screen.getByText('North Star')).toBeInTheDocument();
    expect(screen.getByText('Noto Sans SC · Fraunces')).toBeInTheDocument();
    expect(screen.getByText('冷静、明确')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(document.querySelectorAll('.project-detail-brand-swatch')).toHaveLength(2);
  });

  it('keeps empty brief and brand states explicit', () => {
    renderPage({ project: { ...project, description: '', enDescription: '', brandSnapshot: undefined } });
    expect(screen.getByText('暂无项目简介')).toBeInTheDocument();
    expect(screen.getByText('未附加品牌包')).toBeInTheDocument();
  });

  it('does not render an unusable primary action without documents', () => {
    renderPage({ project: { ...project, documents: 0, documentId: undefined, documentEntries: [] } });
    expect(screen.queryByRole('button', { name: '打开画布' })).not.toBeInTheDocument();
    expect(screen.getByText('暂无设计文档')).toBeInTheDocument();
  });

  it('shows editing controls only for a writable saved project', () => {
    const props = renderPage();
    fireEvent.click(screen.getByRole('button', { name: '新建尺寸' }));
    expect(props.onCreateDocument).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('设计师')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /周野/ })).toBeInTheDocument();

    renderPage({ writable: false });
    expect(screen.getAllByText('秋季发布会')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '新建尺寸' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx
```

Expected: FAIL because `./ProjectDetailPage` does not exist.

- [ ] **Step 3: Add the minimal component API and semantic page structure**

Create `src/app/studio/ProjectDetailPage.tsx` with this public contract and helpers:

```tsx
import type { Locale } from '../i18n';
import { isBrand } from '../../features/brands/constraints';
import { ProjectCoverImage } from './ProjectCoverImage';
import { PersonaArtwork } from './PersonaArtwork';
import { localize, type PersonaProfile } from './personas';
import type { Project } from './types';
import { ArtworkPreview, Badge, Button, EmptyState, Field, Icon, Select, t } from './ui';
import './project-detail.css';

export type ProjectDetailPageProps = {
  locale: Locale;
  project: Project;
  profiles: PersonaProfile[];
  writable: boolean;
  projectTitle: string;
  activeDesignerId: string;
  designerLabel: string;
  contributorIds: string[];
  contributorLabel: string;
  onOpenDocument: (documentId: string | undefined, index: number) => void;
  onExport: () => void;
  onCreateDocument: () => void;
  onSwitchDesigner: (designerId: string) => void;
  onToggleContributor: (designerId: string) => void;
};

const documentStatus = (locale: Locale, entry: NonNullable<Project['documentEntries']>[number] | undefined) => {
  if (!entry) return t(locale, '未保存', 'Unsaved');
  if (entry.finalizedRevisionId) return t(locale, '已定稿', 'Final');
  if (entry.sourceRevisionId) return t(locale, '衍生稿', 'Derived');
  return t(locale, '进行中', 'In progress');
};

export const ProjectDetailPage = (props: ProjectDetailPageProps) => {
  const { locale, project } = props;
  const documents = project.documentEntries ?? Array.from({ length: project.documents }, () => undefined);
  const firstDocumentId = project.documentEntries?.[0]?.id ?? project.documentId;
  const brand = isBrand(project.brandSnapshot) ? project.brandSnapshot : null;
  const activeProfiles = props.profiles.filter((profile) => profile.status !== 'archived');

  // Render one `.project-detail-page` root containing, in order:
  // 1. `.project-detail-hero` with ProjectCoverImage, a dark readable overlay,
  //    document-count eyebrow and conditional primary “打开画布” action.
  // 2. `.project-detail-summary` with project status, title, brief fallback,
  //    designer attribution, storage label, conditional open action, and export.
  // 3. `.project-detail-layout`: document section on the left and sidebar on the right.
  // 4. Document cards call onOpenDocument(entry?.id, index), show dimensions,
  //    local/unsaved Badge, and documentStatus(locale, entry).
  // 5. Sidebar panels for project context, collaboration, and brand snapshot.
  // 6. Collaboration editing controls render only when writable && project.workspaceId.
  // 7. Brand values render only from `brand`; otherwise show “未附加品牌包”.
};
```

Implement the commented render sections directly, using buttons for actionable document cards, headings in logical order, real `ProjectCoverImage` props, the existing `Select`, and native labeled checkboxes. Do not add project fields or call `getDesktopApi()` from this component.

- [ ] **Step 4: Add only the structural CSS needed by the component tests**

Create `src/app/studio/project-detail.css` with scoped foundations so the markup has stable class contracts before visual refinement:

```css
.project-detail-page {
  min-width: 0;
}

.project-detail-hero,
.project-detail-summary,
.project-detail-panel,
.project-detail-document-card {
  min-width: 0;
}

.project-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
}

.project-detail-document-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

- [ ] **Step 5: Run the component test and verify GREEN**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the isolated component foundation**

```bash
git add src/app/studio/ProjectDetailPage.tsx src/app/studio/ProjectDetailPage.test.tsx src/app/studio/project-detail.css
git commit -m "feat: add project detail page component"
```

### Task 2: Wire the detail page into Studio

**Files:**
- Modify: `src/app/Studio.test.tsx`
- Modify: `src/app/studio/Studio.tsx`

- [ ] **Step 1: Add failing Studio integration assertions**

Extend the existing project selection test in `src/app/Studio.test.tsx`, using its current render helpers and workspace fixtures, with assertions equivalent to:

```tsx
fireEvent.click(screen.getByRole('button', { name: /项目封面/ }));

expect(screen.getByTestId('project-detail-page')).toBeInTheDocument();
expect(screen.getByRole('heading', { name: projectName })).toBeInTheDocument();
expect(screen.queryByText('设计简报')).not.toBeInTheDocument();
expect(screen.getByText('设计文档')).toBeInTheDocument();
expect(screen.getByText('项目上下文')).toBeInTheDocument();
expect(screen.getByText('设计协作')).toBeInTheDocument();
```

Add one interaction assertion that clicks a document card and expects the existing workbench/canvas marker to appear. Reuse the current desktop API mocks; do not introduce a second project-loading mock layer.

- [ ] **Step 2: Run the Studio test and verify RED**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx
```

Expected: FAIL because the current inline page has no `project-detail-page` test id and still renders the duplicate design-brief section.

- [ ] **Step 3: Replace the inline detail JSX with `ProjectDetailPage`**

In `src/app/studio/Studio.tsx`:

1. Add:

```tsx
import { ProjectDetailPage } from './ProjectDetailPage';
```

2. Replace the entire `selected && !documentOpen` inline detail block with:

```tsx
{surface === 'projects' && view === 'projects' && selected && !documentOpen && (
  <ProjectDetailPage
    locale={locale}
    project={selected}
    profiles={designerOptions}
    writable={workspace?.openMode === 'writable' && Boolean(selected.workspaceId)}
    projectTitle={projectName(selected)}
    activeDesignerId={projectPersonaId(selected)}
    designerLabel={projectDesignerLabel(selected)}
    contributorIds={projectContributorIds(selected)}
    contributorLabel={projectContributorLabel(selected)}
    onOpenDocument={(documentId, index) => {
      if (documentId || index === 0) {
        openDocument(selected, documentId);
        return;
      }
      notify(t(
        locale,
        '当前可打开主海报预览，其他尺寸稿将在文档能力接入后提供。',
        'Open the main poster preview. Other sizes will be available with document storage.',
      ));
    }}
    onExport={() => openDelivery(selected)}
    onCreateDocument={openRelatedDialog}
    onSwitchDesigner={(designerId) => { void switchProjectDesigner(designerId); }}
    onToggleContributor={(designerId) => { void toggleProjectContributor(designerId); }}
  />
)}
```

3. Remove only imports made unused by deleting this block. Keep `Field`, `Select`, `ArtworkPreview`, `Badge`, and `EmptyState` if another route in `Studio.tsx` still uses them.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx src/app/Studio.test.tsx
```

Expected: PASS, including existing project rename, duplicate, archive, designer, contributor, document creation, and cover flows.

- [ ] **Step 5: Commit only the integration changes**

Because `Studio.tsx` and `Studio.test.tsx` already contain unrelated working-tree changes, stage only the new import, replaced detail block, and matching test hunks with `git add -p`:

```bash
git add -p src/app/studio/Studio.tsx src/app/Studio.test.tsx
git diff --cached --check
git commit -m "refactor: use project detail page"
```

### Task 3: Refine the approved responsive visual system

**Files:**
- Modify: `src/app/studio/ProjectDetailPage.test.tsx`
- Modify: `src/app/studio/project-detail.css`

- [ ] **Step 1: Add failing accessibility and class-contract tests**

Add tests that verify the visual structure has stable semantic hooks without testing browser-computed CSS in jsdom:

```tsx
it('exposes the approved layout regions without nested horizontal scrollers', () => {
  renderPage();
  expect(screen.getByTestId('project-detail-page')).toHaveClass('project-detail-page');
  expect(screen.getByTestId('project-detail-hero')).toHaveClass('project-detail-hero');
  expect(screen.getByTestId('project-detail-layout')).toHaveClass('project-detail-layout');
  expect(screen.getByRole('region', { name: '设计文档' })).toHaveClass('project-detail-documents');
  expect(screen.getByRole('complementary', { name: '项目信息' })).toHaveClass('project-detail-sidebar');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx
```

Expected: FAIL until the test IDs and landmark labels are present.

- [ ] **Step 3: Add landmarks and implement the complete page-scoped styling**

Add `data-testid` values and `aria-label` landmarks in `ProjectDetailPage.tsx`, then expand `project-detail.css` with the following concrete system:

```css
.project-detail-page {
  display: grid;
  gap: 24px;
  width: min(100%, 1480px);
  margin-inline: auto;
  padding: 24px clamp(20px, 4vw, 56px) 64px;
  overflow-x: clip;
}

.project-detail-hero {
  position: relative;
  isolation: isolate;
  min-height: clamp(260px, 34vw, 440px);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 24px;
  background: var(--surface-container-low);
}

.project-detail-hero .project-cover__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-detail-hero::after {
  content: '';
  position: absolute;
  z-index: 0;
  inset: 0;
  background: linear-gradient(90deg, rgb(10 14 20 / 78%), rgb(10 14 20 / 18%) 65%, transparent);
  pointer-events: none;
}

.project-detail-hero__overlay {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 14px;
  min-height: inherit;
  padding: clamp(28px, 5vw, 64px);
  color: #fff;
}

.project-detail-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px 32px;
  align-items: end;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-subtle);
}

.project-detail-summary__description {
  max-width: 72ch;
  min-height: 3em;
  margin: 8px 0 0;
  color: var(--on-surface-variant);
}

.project-detail-summary__actions,
.project-detail-panel__header,
.project-detail-document-card__meta,
.project-detail-brand-colors {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.project-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 24px;
  align-items: start;
}

.project-detail-documents,
.project-detail-sidebar {
  min-width: 0;
}

.project-detail-sidebar {
  display: grid;
  gap: 16px;
}

.project-detail-panel {
  padding: 20px;
  border: 1px solid var(--border-subtle);
  border-radius: 18px;
  background: color-mix(in srgb, var(--surface-container) 90%, transparent);
  box-shadow: 0 18px 48px rgb(0 0 0 / 8%);
}

.project-detail-context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.project-detail-context-grid small,
.project-detail-brand-row small {
  display: block;
  margin-bottom: 4px;
  color: var(--on-surface-variant);
  letter-spacing: .06em;
}

.project-detail-document-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.project-detail-document-card {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  background: var(--surface-container-low);
  color: var(--on-surface);
  text-align: left;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.project-detail-document-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--primary) 55%, var(--border-subtle));
  box-shadow: 0 18px 38px rgb(0 0 0 / 12%);
}

.project-detail-document-card:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}

.project-detail-document-card__preview {
  min-height: 164px;
}

.project-detail-document-card__body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
}

.project-detail-brand-swatch {
  width: 28px;
  height: 28px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%);
}

@media (max-width: 1100px) {
  .project-detail-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .project-detail-page {
    gap: 18px;
    padding: 16px 14px 40px;
  }

  .project-detail-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .project-detail-summary__actions {
    justify-content: stretch;
  }

  .project-detail-summary__actions .ui-button {
    flex: 1 1 160px;
  }

  .project-detail-document-grid,
  .project-detail-context-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .project-detail-document-card {
    grid-template-columns: 108px minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .project-detail-document-card {
    transition: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .project-detail-panel {
    background: var(--surface-container);
  }
}
```

Use existing token names confirmed in `src/app/styles/studio.css`. If a listed token does not exist, substitute the nearest existing `--surface-*` or `--on-surface-*` token instead of introducing an isolated color system. Keep fixed white only for text over the dark hero scrim.

- [ ] **Step 4: Run the component suite and verify GREEN**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx src/app/Studio.test.tsx
```

Expected: PASS with no React accessibility warnings.

- [ ] **Step 5: Commit the visual refinement**

```bash
git add src/app/studio/ProjectDetailPage.tsx src/app/studio/ProjectDetailPage.test.tsx src/app/studio/project-detail.css
git diff --cached --check
git commit -m "style: refine project detail layout"
```

### Task 4: Lock responsive behavior with integration and E2E coverage

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Add a failing static layout contract**

Extend `tests/integration/layout-contract.test.ts` using its existing CSS-reading helper:

```ts
it('keeps the project detail page responsive without horizontal overflow', () => {
  const css = readStyle('../../src/app/studio/project-detail.css');
  expect(css).toContain('grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr)');
  expect(css).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.project-detail-layout\s*{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.project-detail-document-grid[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  expect(css).toMatch(/\.project-detail-page\s*{[\s\S]*?overflow-x: clip/);
});
```

- [ ] **Step 2: Run the layout contract and verify RED if any required rule is missing**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL until every approved breakpoint and overflow rule is present exactly once in `project-detail.css`.

- [ ] **Step 3: Add a project detail E2E scenario**

Extend the existing authenticated/stubbed studio fixture in `tests/e2e/studio.spec.ts` rather than bootstrapping a new app. Add a scenario tagged in its name with `project detail`:

```ts
test('project detail uses a wide console layout and opens the primary document', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoTestWorkspace(page);
  await page.getByRole('button', { name: /Spring in bloom|春间市集/ }).click();

  const detail = page.getByTestId('project-detail-page');
  await expect(detail).toBeVisible();
  await expect(page.getByTestId('project-detail-layout')).toHaveCSS('grid-template-columns', /\d+px \d+px/);
  expect(await detail.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 1024, height: 900 });
  const layout = page.getByTestId('project-detail-layout');
  const columns = await layout.evaluate((node) => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
  expect(columns).toBe(1);

  await page.getByRole('button', { name: '打开画布' }).first().click();
  await expect(page.locator('.workbench')).toBeVisible();
});
```

Use the helpers and locale selected by the existing suite. Add a writable assertion for “新建尺寸” and, where the existing fixture can open a read-only workspace, assert that the same button is absent.

- [ ] **Step 4: Run E2E and fix only test-proven layout defects**

Run:

```bash
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "project detail" --workers=1
```

Expected: PASS at 1440px and 1024px with no horizontal overflow, and the primary action opens the workbench.

- [ ] **Step 5: Commit the regression coverage**

The test files contain unrelated working-tree changes, so stage only this feature's hunks:

```bash
git add -p tests/integration/layout-contract.test.ts tests/e2e/studio.spec.ts
git diff --cached --check
git commit -m "test: cover responsive project detail layout"
```

### Task 5: Full verification and cleanup

**Files:**
- Review: all files changed by Tasks 1–4

- [ ] **Step 1: Run focused verification**

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx src/app/Studio.test.tsx tests/integration/layout-contract.test.ts
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "project detail" --workers=1
```

Expected: all focused suites PASS.

- [ ] **Step 2: Run repository verification**

```bash
pnpm test:unit
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: each command exits 0. If a pre-existing unrelated failure appears, capture its exact command and error separately; do not rewrite unrelated dirty files.

- [ ] **Step 3: Inspect the final diff for scope and old-layout removal**

```bash
git diff -- src/app/studio/ProjectDetailPage.tsx src/app/studio/ProjectDetailPage.test.tsx src/app/studio/project-detail.css src/app/studio/Studio.tsx src/app/Studio.test.tsx tests/integration/layout-contract.test.ts tests/e2e/studio.spec.ts
rg -n "brief-summary|project-context|document-collection" src/app/studio/Studio.tsx
git status --short
```

Expected: the feature diff contains only the new detail page and its wiring; the removed inline detail classes do not remain in the selected-project block; unrelated worktree changes remain untouched.

- [ ] **Step 4: Produce the completion report**

Report the resulting page hierarchy, responsive breakpoints, preserved operations, and exact verification commands. Do not claim a command passed unless its output was observed in this session.
