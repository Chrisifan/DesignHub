# Project Detail Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the project detail cover and summary into one compact header card so the cover remains restrained and the title, brief, attribution, storage state, and actions read as one coherent group.

**Architecture:** Keep `ProjectDetailPage` as the existing presentational boundary and preserve all callbacks and project data flow. Restructure only its header markup, add a stable empty-designer fallback, and replace the current fluid hero sizing with bounded responsive CSS. Extend component, integration-contract, and browser tests around structure, action count, height, and overflow.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Playwright.

---

## File map

- Modify `src/app/studio/ProjectDetailPage.tsx`: group the cover and summary inside one header card and remove the duplicate cover action.
- Modify `src/app/studio/project-detail.css`: define bounded cover heights, compact information grouping, two-line brief clamping, and responsive stacking.
- Modify `src/app/studio/ProjectDetailPage.test.tsx`: cover the unified card, single primary action, and stable empty states.
- Modify `src/app/Studio.test.tsx`: verify the integrated Studio route exposes the unified project header.
- Modify `tests/integration/layout-contract.test.ts`: protect the compact header and no-horizontal-overflow CSS contract.
- Modify `tests/e2e/studio.spec.ts`: verify wide and narrow cover dimensions, single action, and responsive layout.

### Task 1: Lock the unified header behavior with component tests

**Files:**
- Modify: `src/app/studio/ProjectDetailPage.test.tsx`

- [ ] **Step 1: Replace the cover-led test with a unified-card contract**

Add assertions that the cover, title, brief, metadata, and actions share one `project-detail-header`, and that only one “打开画布” button is rendered:

```tsx
it('groups the cover and project summary into one compact header card', () => {
  const { props } = renderPage();
  const header = screen.getByTestId('project-detail-header');

  expect(header).toContainElement(screen.getByRole('img', { name: '秋季发布会项目封面' }));
  expect(header).toContainElement(screen.getByRole('heading', { name: '秋季发布会' }));
  expect(header).toContainElement(screen.getByText(project.description));
  expect(screen.getAllByRole('button', { name: '打开画布' })).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: '打开画布' }));
  expect(props.onOpenDocument).toHaveBeenCalledWith('poster', 0);
});
```

- [ ] **Step 2: Add an explicit empty-designer test**

```tsx
it('keeps the brief and designer rows explicit when project metadata is missing', () => {
  renderPage({
    project: { ...project, description: '', enDescription: '' },
    activeDesignerId: '',
    designerLabel: '',
    contributorIds: [],
    contributorLabel: '',
  });

  expect(screen.getByText('暂无项目简介')).toBeInTheDocument();
  expect(screen.getByText('未设置设计师')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the component test and verify RED**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx
```

Expected: FAIL because `project-detail-header` is absent, two open-canvas actions are rendered, and an empty designer label has no fallback.

- [ ] **Step 4: Commit the failing contract**

```bash
git add src/app/studio/ProjectDetailPage.test.tsx
git commit -m "test: define compact project detail header"
```

### Task 2: Merge the cover and summary markup

**Files:**
- Modify: `src/app/studio/ProjectDetailPage.tsx`
- Test: `src/app/studio/ProjectDetailPage.test.tsx`

- [ ] **Step 1: Derive a localized designer fallback**

Add this display value alongside the existing `brief`, `saved`, and `projectStatus` derivations:

```tsx
const displayDesignerLabel = designerLabel.trim()
  || t(locale, '未设置设计师', 'No designer selected');
```

Use `displayDesignerLabel` in the design-credit `<strong>` instead of rendering `designerLabel` directly. Append `designerVersion` only when it exists.

- [ ] **Step 2: Introduce the unified header card**

Replace the sibling hero and summary blocks with this structure while retaining the existing cover, status, title, description, metadata, export callback, and localization:

```tsx
<section className="project-detail-header" data-testid="project-detail-header">
  <div className="project-detail-hero" data-testid="project-detail-hero">
    <ProjectCoverImage
      workspaceId={project.workspaceId}
      projectId={project.id}
      coverAssetId={project.coverAssetId}
      previewUrl={project.coverPreviewUrl}
      alt={t(locale, `${projectTitle}项目封面`, `${projectTitle} project cover`)}
    />
    <div className="project-detail-hero__overlay">
      <span className="project-detail-hero__eyebrow">
        <Icon name="layers" size={15} />
        {project.documents} {t(locale, '份文档', 'documents')}
      </span>
    </div>
  </div>

  <header className="project-detail-summary">
    <div className="project-detail-summary__content">
      <div className="project-detail-summary__status">
        <span className="project-detail-status-dot" aria-hidden="true" />
        {projectStatus}
      </div>
      <h1>{projectTitle}</h1>
      <p className={`project-detail-summary__description ${brief ? '' : 'is-empty'}`}>
        {brief || t(locale, '暂无项目简介', 'No project brief yet')}
      </p>
      <div className="project-detail-summary__meta">
        <span className="project-detail-attribution" aria-label={t(locale, '版本署名', 'Revision credits')}>
          <span className="project-detail-attribution__avatars" aria-hidden="true">
            {contributorIds.slice(0, 3).map((designerId) => (
              <PersonaArtwork
                key={designerId}
                locale={locale}
                personaId={designerId}
                profile={profiles.find((profile) => profile.id === designerId)}
                crop="avatar"
              />
            ))}
          </span>
          <span>
            <small>{t(locale, '设计署名', 'Design credit')}</small>
            <strong>{displayDesignerLabel}{designerVersion ? ` · ${designerVersion}` : ''}</strong>
            {contributorLabel && contributorLabel !== designerLabel && (
              <span className="project-detail-attribution__contributors">{contributorLabel}</span>
            )}
          </span>
        </span>
        <span className="project-detail-storage">
          <Icon name={saved ? 'hard-drive' : 'clock'} size={15} />
          {saved ? t(locale, '本地保存', 'Saved locally') : t(locale, '仅当前会话', 'This session only')}
        </span>
      </div>
    </div>
    <div className="project-detail-summary__actions">
      {hasDocuments && (
        <Button icon="arrow-up-right" variant="primary" onClick={openPrimaryDocument}>
          {t(locale, '打开画布', 'Open canvas')}
        </Button>
      )}
      <Button icon="download" onClick={onExport}>
        {t(locale, '导出交付', 'Export')}
      </Button>
    </div>
  </header>
</section>
```

The hero overlay must contain only the document-count eyebrow; do not leave a second “打开画布” button in the cover.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx
```

Expected: all `ProjectDetailPage` tests PASS.

- [ ] **Step 4: Commit the component change**

```bash
git add src/app/studio/ProjectDetailPage.tsx src/app/studio/ProjectDetailPage.test.tsx
git commit -m "refactor: unify project detail cover and summary"
```

### Task 3: Implement compact and stable responsive styling

**Files:**
- Modify: `src/app/studio/project-detail.css`
- Modify: `tests/integration/layout-contract.test.ts`

- [ ] **Step 1: Add a failing static layout contract**

Extend the project-detail assertions in `layout-contract.test.ts`:

```ts
expect(styles).toMatch(/\.project-detail-header\s*\{[\s\S]*?overflow:\s*hidden/);
expect(styles).toMatch(/\.project-detail-hero\s*\{[\s\S]*?min-height:\s*240px/);
expect(styles).toMatch(/\.project-detail-summary__description\s*\{[\s\S]*?-webkit-line-clamp:\s*2/);
expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*?\.project-detail-hero\s*\{[\s\S]*?min-height:\s*180px/);
```

- [ ] **Step 2: Run the integration contract and verify RED**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL because the unified header and bounded cover declarations are absent.

- [ ] **Step 3: Replace the separate hero and summary surfaces with one card**

Implement these core rules, preserving the existing theme tokens:

```css
.project-detail-header {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 22px;
  background: var(--surface-container-low);
  box-shadow: 0 24px 56px color-mix(in srgb, var(--surface-container-lowest) 28%, transparent);
}

.project-detail-hero {
  position: relative;
  isolation: isolate;
  min-height: 240px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--surface-container-low);
  box-shadow: none;
}

.project-detail-hero__overlay {
  min-height: 240px;
  padding: 24px;
}

.project-detail-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px 28px;
  align-items: center;
  padding: 22px 24px 24px;
  border-top: 1px solid var(--border-subtle);
}
```

Remove the hero's standalone outer border, rounded corners, large fluid `clamp(260px, 34vw, 440px)` sizing, and the summary's bottom-border treatment.

- [ ] **Step 4: Tighten the information group and clamp the brief**

```css
.project-detail-summary h1 {
  font-size: clamp(30px, 2.6vw, 36px);
}

.project-detail-summary__description {
  display: -webkit-box;
  min-height: 3em;
  max-width: 72ch;
  margin: 8px 0 0;
  overflow: hidden;
  line-height: 1.5;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.project-detail-summary__meta {
  gap: 16px;
  min-height: 34px;
  margin-top: 12px;
}
```

- [ ] **Step 5: Add bounded narrow-screen behavior**

Under `@media (max-width: 720px)`, replace the old hero and summary overrides with:

```css
@media (max-width: 720px) {
  .project-detail-header {
    border-radius: 16px;
  }

  .project-detail-hero,
  .project-detail-hero__overlay {
    min-height: 180px;
  }

  .project-detail-hero__overlay,
  .project-detail-summary {
    padding: 18px;
  }

  .project-detail-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .project-detail-summary__meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .project-detail-summary__actions {
    justify-content: stretch;
  }

  .project-detail-summary__actions .ui-button {
    flex: 1 1 150px;
  }
}
```

Preserve `.page-content.project-detail-page { overflow-x: clip; }`.

- [ ] **Step 6: Run CSS contracts and component tests**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts src/app/studio/ProjectDetailPage.test.tsx
```

Expected: both test files PASS.

- [ ] **Step 7: Commit the responsive styling**

```bash
git add src/app/studio/project-detail.css tests/integration/layout-contract.test.ts
git commit -m "style: compact project detail header"
```

### Task 4: Verify the integrated and browser layouts

**Files:**
- Modify: `src/app/Studio.test.tsx`
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Update the Studio integration assertion**

In the existing project-detail test, assert the unified header rather than only the standalone hero:

```tsx
const header = screen.getByTestId('project-detail-header');
expect(header).toContainElement(screen.getByTestId('project-detail-hero'));
expect(header).toContainElement(screen.getByRole('heading', { name: '春间市集' }));
expect(screen.getAllByRole('button', { name: '打开画布' })).toHaveLength(1);
```

- [ ] **Step 2: Extend the Playwright density checks**

In the existing project-detail E2E test, measure the hero and action count at both viewports:

```ts
const hero = page.getByTestId('project-detail-hero');
await expect(page.getByTestId('project-detail-header')).toBeVisible();
await expect(page.getByRole('button', { name: '打开画布', exact: true })).toHaveCount(1);
expect(await hero.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(260);

await page.setViewportSize({ width: 700, height: 900 });
expect(await hero.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(180);
expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
```

Keep the existing wide two-column and narrower one-column content-layout assertions.

- [ ] **Step 3: Run the integration tests**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/ProjectDetailPage.test.tsx
```

Expected: all selected tests PASS.

- [ ] **Step 4: Run the focused E2E test**

Run:

```bash
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "project detail uses"
```

Expected: the focused project-detail scenario PASSes at wide, medium, and narrow viewport checks.

- [ ] **Step 5: Commit the integrated coverage**

```bash
git add src/app/Studio.test.tsx tests/e2e/studio.spec.ts
git commit -m "test: cover compact project detail layout"
```

### Task 5: Final regression verification

**Files:**
- Verify only; no expected source changes.

- [ ] **Step 1: Run the focused unit and integration suite**

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx src/app/Studio.test.tsx tests/integration/layout-contract.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 2: Run static verification**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all three commands exit with code `0`.

- [ ] **Step 3: Review the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated pre-existing working-tree changes remain untouched.
