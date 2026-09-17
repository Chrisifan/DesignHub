# Designer Inspector and Loading Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the designer inspector use the review-and-publish dossier layout with an inspector-only curated portfolio, and replace repaint-heavy loading animations with smooth transform-only motion.

**Architecture:** Extract the existing review dossier markup into a focused exported `DesignerDossier` component inside `DesignerProfileCard.tsx`, then compose it from both review mode and `PersonaInspector`. Keep the inspector's portfolio and workspace note outside the shared component, and keep commands in the existing drawer footer. Change skeleton and indeterminate-progress animation to clipped pseudo-elements that animate only `transform`.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Playwright.

---

## File Map

- Modify `src/app/studio/DesignerProfileCard.tsx`: export the shared full dossier presentation while preserving the existing `library | review` facade.
- Modify `src/app/studio/DesignerProfileCard.test.tsx`: verify the shared dossier and existing review facade render the same profile contract, including empty rules.
- Modify `src/app/studio/PersonaInspector.tsx`: replace its duplicate profile hierarchy with `DesignerDossier`, retain curated portfolio and workspace note, and add an empty portfolio state.
- Modify `src/app/studio/PersonaInspector.test.tsx`: verify shared dossier sections, retained portfolio, removed legacy metrics, empty states, and inspector actions.
- Modify `src/app/studio/persona.css`: remove obsolete inspector hero/detail styling and style the inspector composition and portfolio empty state.
- Modify `src/app/studio/library.css`: replace `background-position` shimmer and alternating progress animation with transform-only pseudo-elements.
- Modify `tests/integration/layout-contract.test.ts`: lock the animation implementation to transform-only motion and reduced-motion fallbacks.
- Modify `tests/e2e/studio.spec.ts`: enrich the test designer data and verify inspector section order, portfolio content, drawer width, footer containment, and no overflow.
- Modify `tests/e2e/designer-drawer.spec.ts`: inspect loading-state computed styles and capture the analysis loading state before resolving the task.

### Task 1: Extract the Shared Dossier Presentation

**Files:**
- Modify: `src/app/studio/DesignerProfileCard.tsx`
- Modify: `src/app/studio/DesignerProfileCard.test.tsx`

- [ ] **Step 1: Write failing tests for the exported dossier and empty rules**

Add an import for `DesignerDossier` and these focused tests to `DesignerProfileCard.test.tsx`:

```tsx
it('exposes the full dossier independently of its review facade', () => {
  const { rerender } = render(<DesignerDossier locale="zh-CN" profile={profile} />);
  const directOrder = [...screen.getByRole('region', { name: '纸感排版设计师档案' }).children]
    .map((element) => element.className);

  rerender(<DesignerProfileCard locale="zh-CN" profile={profile} mode="review" />);
  const reviewOrder = [...screen.getByRole('region', { name: '纸感排版设计师档案' }).children]
    .map((element) => element.className);

  expect(reviewOrder).toEqual(directOrder);
  expect(directOrder).toEqual([
    'designer-profile-card__review-head',
    'designer-profile-card__signals',
    'designer-profile-card__dna',
    'designer-profile-card__rules',
  ]);
});

it('shows a localized empty state when the dossier has no negative rules', () => {
  render(<DesignerDossier locale="zh-CN" profile={{ ...profile, negativeRules: [] }} />);
  expect(screen.getByRole('region', { name: '否定规则' })).toHaveTextContent('未提取否定规则');
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerProfileCard.test.tsx
```

Expected: FAIL because `DesignerDossier` is not exported.

- [ ] **Step 3: Extract and export `DesignerDossier`**

Rename the current internal `ReviewProfile` function to `DesignerDossier`, export it, and change its parameter type from `Omit<DesignerProfileCardProps, 'mode' | 'isDefault'>` to the explicit props type below. Keep the existing function body unchanged; this is a symbol extraction, not a markup rewrite:

```tsx
type DesignerDossierProps = {
  locale: Locale;
  profile: PersonaProfile;
};
```

Apply this exact declaration replacement above the existing function body:

```diff
-const ReviewProfile = ({ locale, profile }: Omit<DesignerProfileCardProps, 'mode' | 'isDefault'>) => {
+export const DesignerDossier = ({ locale, profile }: DesignerDossierProps) => {
```

Keep `DesignerProfileCard` as the stable facade:

```tsx
export const DesignerProfileCard = ({ locale, profile, mode, isDefault = false }: DesignerProfileCardProps) =>
  mode === 'library'
    ? <LibraryProfile locale={locale} profile={profile} isDefault={isDefault} />
    : <DesignerDossier locale={locale} profile={profile} />;
```

Do not move selection, publication, drawer, or action behavior into `DesignerDossier`.

- [ ] **Step 4: Run the component test and confirm GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerProfileCard.test.tsx
```

Expected: all `DesignerProfileCard` tests pass.

- [ ] **Step 5: Commit the shared dossier extraction**

```bash
git add src/app/studio/DesignerProfileCard.tsx src/app/studio/DesignerProfileCard.test.tsx
git commit -m "refactor: share designer dossier presentation"
```

### Task 2: Compose the Dossier in the Inspector

**Files:**
- Modify: `src/app/studio/PersonaInspector.tsx`
- Modify: `src/app/studio/PersonaInspector.test.tsx`
- Modify: `src/app/studio/persona.css`

- [ ] **Step 1: Write failing inspector-layout tests**

Replace the existing broad inspector test with tests that assert the selected design:

```tsx
it('uses the shared dossier and retains the curated portfolio', () => {
  render(<PersonaInspector locale="zh-CN" profile={getPersona('paper-type')!} showActions={false} />);

  const dossier = screen.getByRole('region', { name: '纸感排版设计师档案' });
  expect(within(dossier).getByRole('region', { name: '核心指标' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: 'Style DNA' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: '否定规则' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '精选作品' })).toHaveTextContent('春生特刊');
  expect(screen.queryByText('项目引用')).not.toBeInTheDocument();
  expect(screen.queryByText('作品样张')).not.toBeInTheDocument();
  expect(screen.queryByText('会话默认')).not.toBeInTheDocument();
  expect(screen.queryByText('ARCHETYPE')).not.toBeInTheDocument();
});

it('shows an empty curated-portfolio state', () => {
  const profile = getPersona('paper-type')!;
  render(<PersonaInspector locale="en" profile={{ ...profile, portfolioSheets: [] }} showActions={false} />);
  expect(screen.getByRole('region', { name: 'Curated portfolio' })).toHaveTextContent('No curated work yet');
});
```

Retain the existing action test using `showActions` at its default value. It must still click `设默认` and `用于新建` and verify the current callbacks.

- [ ] **Step 2: Run the inspector test and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/PersonaInspector.test.tsx
```

Expected: FAIL because the inspector still renders its legacy hierarchy and has no portfolio empty state.

- [ ] **Step 3: Replace the duplicate inspector profile markup**

Update `PersonaInspector.tsx` imports and body:

```tsx
import { DesignerDossier } from './DesignerProfileCard';
import { localize, type PersonaProfile } from './personas';
import { ArtworkPreview, Button, Icon, t } from './ui';

return (
  <div className="details-panel persona-inspector">
    <DesignerDossier locale={locale} profile={profile} />
    {showActions ? actions : null}
    <section className="persona-inspector__portfolio" aria-label={t(locale, '精选作品', 'Curated portfolio')}>
      <div className="section-title">
        <h3>{t(locale, '精选作品', 'Curated Portfolio Sheets')}</h3>
        <span className="mono">{profile.portfolioSheets.length.toString().padStart(2, '0')}</span>
      </div>
      {profile.portfolioSheets.length > 0 ? (
        <div className="portfolio-strip">
          {profile.portfolioSheets.map((sheet) => (
            <div className="portfolio-item" key={sheet.id}>
              <ArtworkPreview kind={sheet.artwork} />
              <strong title={localize(locale, sheet.title)}>{localize(locale, sheet.title)}</strong>
              <small title={localize(locale, sheet.note)}>{localize(locale, sheet.note)}</small>
            </div>
          ))}
        </div>
      ) : <p className="persona-inspector__empty">{t(locale, '暂无精选作品', 'No curated work yet')}</p>}
    </section>
    {(readOnly || !workspaceId) && (
      <p className="panel-note">
        <Icon name="hard-drive" size={15} />
        {readOnly
          ? t(locale, '当前工作区只读。', 'Current workspace is read-only.')
          : t(locale, '档案保存到当前工作区。', 'Profiles are saved to the current workspace.')}
      </p>
    )}
  </div>
);
```

Delete `DetailRow`, the old header, archetype hero, creative-principle block, legacy metrics, duplicate DNA and rules markup. Preserve `actions`, callbacks, permission checks, empty-profile handling, and note wording.

- [ ] **Step 4: Replace obsolete inspector styles**

In `persona.css`:

- Keep `.persona-inspector` as the scroll owner with existing padding and scrollbar behavior.
- Add `gap: 14px` so the shared dossier, actions, portfolio, and note remain distinct.
- Keep `.persona-inspector__actions` because the drawer footer and optional inline mode both use it.
- Add `.persona-inspector__portfolio` with the same compact outlined section treatment as the dossier sections.
- Add `.persona-inspector__portfolio .section-title` as a three-track header-equivalent without inventing a card inside a card.
- Add `.persona-inspector__empty` using `var(--on-surface-variant)`, `10px` text, and zero margin.
- Retain `.portfolio-strip` and `.portfolio-item` rules, including three columns and the existing two-column narrow breakpoint.
- Remove now-unreferenced `.persona-inspector__head`, `__path`, `__hero`, `__portrait`, `__identity`, `__archetype`, `__code`, `__summary`, `__principle`, `__metrics`, `__detail-grid`, `.style-palette`, `.details-list--compact`, and `.negative-rules` overrides after `rg` confirms they have no production consumers.

- [ ] **Step 5: Run inspector and library tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/PersonaInspector.test.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/DesignerProfileCard.test.tsx
pnpm typecheck
```

Expected: all selected tests and typecheck pass.

- [ ] **Step 6: Commit the inspector composition**

```bash
git add src/app/studio/PersonaInspector.tsx src/app/studio/PersonaInspector.test.tsx src/app/studio/persona.css
git commit -m "style: align designer inspector with review dossier"
```

### Task 3: Replace Repaint-Heavy Loading Motion

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `src/app/studio/library.css`

- [ ] **Step 1: Write a failing CSS contract test**

Add this test to `layout-contract.test.ts`:

```ts
it('uses compositor-friendly continuous portfolio loading motion', () => {
  const styles = readStyle('../../src/app/studio/library.css');
  const skeletonRule = styles.match(/\.portfolio-analysis-skeleton i,\s*\.portfolio-artwork-skeleton i\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const shimmerRule = styles.match(/\.portfolio-analysis-skeleton i::after,\s*\.portfolio-artwork-skeleton i::after\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const progressRule = styles.match(/\.portfolio-analysis-progress > span::after\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
  const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';

  expect(skeletonRule).toMatch(/position:\s*relative/);
  expect(skeletonRule).toMatch(/overflow:\s*hidden/);
  expect(shimmerRule).toMatch(/animation:\s*portfolio-skeleton\s+1\.8s\s+linear\s+infinite/);
  expect(shimmerRule).toMatch(/will-change:\s*transform/);
  expect(progressRule).toMatch(/animation:\s*portfolio-progress\s+1\.8s\s+linear\s+infinite/);
  expect(progressRule).not.toMatch(/alternate/);
  expect(styles).not.toMatch(/@keyframes portfolio-skeleton\s*\{[^}]*background-position/s);
  expect(styles).toMatch(/@keyframes portfolio-skeleton\s*\{[\s\S]*translate3d/);
  expect(reducedMotion).toMatch(/\.portfolio-analysis-skeleton i::after/);
  expect(reducedMotion).toMatch(/animation:\s*none/);
});
```

- [ ] **Step 2: Run the contract test and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts tests/integration/layout-contract.test.ts
```

Expected: FAIL because skeletons animate `background-position` and progress uses `alternate`.

- [ ] **Step 3: Implement transform-only shimmer**

Replace the animated backgrounds in `library.css` with a shared static base and pseudo-element:

```css
.portfolio-analysis-skeleton i,
.portfolio-artwork-skeleton i {
  position: relative;
  display: block;
  overflow: hidden;
  background: var(--surface-container);
}

.portfolio-analysis-skeleton i::after,
.portfolio-artwork-skeleton i::after {
  position: absolute;
  inset: 0 auto 0 -52%;
  width: 48%;
  content: '';
  background: linear-gradient(105deg, transparent, var(--surface-container-high), transparent);
  transform: translate3d(0, 0, 0);
  will-change: transform;
  animation: portfolio-skeleton 1.8s linear infinite;
}

@keyframes portfolio-skeleton {
  to { transform: translate3d(320%, 0, 0); }
}
```

Keep the existing analysis block heights, Avatar square aspect ratio, border radii, and grid layout.

- [ ] **Step 4: Make progress motion continuous**

Change the fill so it starts and resets outside the clipped track:

```css
.portfolio-analysis-progress > span::after {
  width: 45%;
  transform: translate3d(-105%, 0, 0);
  will-change: transform;
  animation: portfolio-progress 1.8s linear infinite;
}

@keyframes portfolio-progress {
  to { transform: translate3d(325%, 0, 0); }
}
```

Update reduced motion to disable animation on `i::after` instead of `i`, hide the shimmer pseudo-elements, and retain the static `58%` progress fill:

```css
@media (prefers-reduced-motion: reduce) {
  .portfolio-analysis-progress > span::after,
  .portfolio-analysis-skeleton i::after,
  .portfolio-artwork-skeleton i::after { animation: none; }

  .portfolio-analysis-skeleton i::after,
  .portfolio-artwork-skeleton i::after { display: none; }

  .portfolio-analysis-progress > span::after {
    width: 58%;
    transform: none;
  }
}
```

- [ ] **Step 5: Run animation and loading-state tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts tests/integration/layout-contract.test.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: all contract and loading-state tests pass.

- [ ] **Step 6: Commit the animation fix**

```bash
git add tests/integration/layout-contract.test.ts src/app/studio/library.css
git commit -m "perf: smooth portfolio loading motion"
```

### Task 4: Verify the Browser Layout and Motion Contract

**Files:**
- Modify: `tests/e2e/test-workspace.ts`
- Modify: `tests/e2e/studio.spec.ts`
- Modify: `tests/e2e/designer-drawer.spec.ts`

- [ ] **Step 1: Enrich the E2E profile fixture**

Give `paper` in `test-workspace.ts` representative dossier data:

```ts
tags: [{ zh: '编辑网格', en: 'Editorial grid' }, { zh: '纸张质感', en: 'Paper texture' }],
styleDna: {
  palette: ['#F4EFE7', '#24262B', '#8C7057'],
  typography: { zh: '衬线标题与紧凑说明', en: 'Serif titles with compact copy' },
  composition: { zh: '窄栏对齐与明确基线', en: 'Narrow columns and clear baseline' },
  texture: { zh: '纸纤维与低对比颗粒', en: 'Paper fiber and low-contrast grain' },
  signals: {
    contrast: 68,
    darkAiriness: 82,
    whitespace: 38,
    grain: 15,
    diffuseLight: 92,
    typeFamily: { zh: '衬线倾向', en: 'Serif tendency' },
    typeWeight: { zh: '半粗体', en: 'Semibold' },
    tracking: { zh: '紧凑', en: 'Compact' },
    compositionTopology: { zh: '非对称垂直流', en: 'Asymmetric vertical flow' },
    rendering: { zh: '纸张漫反射', en: 'Paper diffusion' },
  },
},
negativeRules: [{ zh: '不使用霓虹高饱和色', en: 'No neon saturation' }],
portfolioSheets: [{
  id: 'e2e-sheet', artwork: 'market',
  title: { zh: '春生特刊', en: 'Spring issue' },
  note: { zh: '编辑展览海报', en: 'Editorial exhibition poster' },
}],
```

- [ ] **Step 2: Add inspector browser assertions**

In `studio.spec.ts`, after opening the designer inspector, assert section order and layout:

```ts
const inspector = page.getByRole('dialog', { name: '设计师检查器' });
const dossier = inspector.getByRole('region', { name: '清晰商业设计师档案' });
await expect(dossier.getByRole('region', { name: '核心指标' })).toBeVisible();
await expect(dossier.getByRole('region', { name: 'Style DNA' })).toBeVisible();
await expect(dossier.getByRole('region', { name: '否定规则' })).toBeVisible();
await expect(inspector.getByRole('region', { name: '精选作品' })).toContainText('春生特刊');
await expect(inspector.getByText('项目引用')).toHaveCount(0);
```

Open the `paper` profile for the portfolio assertion, or give `commerce` the same fixture details explicitly. At `1024x720`, verify:

```ts
const drawerBox = await inspector.boundingBox();
expect(drawerBox).not.toBeNull();
expect(Math.abs(drawerBox!.width - Math.min(520, 1024 * 0.92))).toBeLessThanOrEqual(1);
expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
```

Capture `designer-inspector.png`, then repeat the no-overflow and footer-containment assertions at a `560x720` viewport and capture `designer-inspector-narrow.png`.

- [ ] **Step 3: Add loading-motion browser assertions**

In `designer-drawer.spec.ts`, replace the immediate completed analysis task with a controllable promise for the first submission. While the loading UI is visible, inspect the first skeleton:

```ts
const motion = await drawer.getByTestId('portfolio-analysis-skeleton').locator('i').first().evaluate((element) => {
  const base = getComputedStyle(element);
  const shimmer = getComputedStyle(element, '::after');
  return {
    baseAnimation: base.animationName,
    shimmerAnimation: shimmer.animationName,
    shimmerWillChange: shimmer.willChange,
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
  };
});
expect(motion.baseAnimation).toBe('none');
expect(motion.shimmerAnimation).toBe('portfolio-skeleton');
expect(motion.shimmerWillChange).toContain('transform');
expect(motion.width).toBeGreaterThan(0);
expect(motion.height).toBeGreaterThan(0);
```

Capture `portfolio-analysis-loading.png`, resolve the task, and continue the current analysis-result, Avatar, regeneration, back-navigation, and publish assertions unchanged.

- [ ] **Step 4: Run targeted E2E tests**

Run:

```bash
pnpm exec playwright test --config playwright.config.ts tests/e2e/studio.spec.ts tests/e2e/designer-drawer.spec.ts
```

Expected: both desktop and narrow inspector checks pass, loading computed styles identify the pseudo-element animation, and screenshots contain no overlap or blank content.

- [ ] **Step 5: Inspect screenshots**

Open the new desktop, narrow, and loading screenshots. Verify:

- The inspector hierarchy matches the review dossier.
- The curated portfolio follows the negative rules.
- Text remains inside the 520px or `92vw` drawer.
- Footer buttons do not overlap.
- Skeleton blocks retain stable dimensions and the screenshot is nonblank.

If any visual defect appears, add the smallest failing assertion before changing CSS, then rerun Step 4.

- [ ] **Step 6: Commit browser coverage**

```bash
git add tests/e2e/test-workspace.ts tests/e2e/studio.spec.ts tests/e2e/designer-drawer.spec.ts
git commit -m "test: cover designer inspector and loading motion"
```

### Task 5: Run Full Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Run unit and integration suites**

```bash
pnpm test:unit
pnpm test:integration
```

Expected: all tests pass with no warnings caused by this change.

- [ ] **Step 2: Run static checks**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit successfully.

- [ ] **Step 3: Run the full browser suite**

```bash
pnpm test:e2e
```

Expected: all browser tests pass.

- [ ] **Step 4: Confirm repository state**

```bash
git status --short --branch
git log -5 --oneline
```

Expected: no uncommitted changes; `main` contains the specification plus four implementation commits.
