# Designer Profile Card And Review Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared designer dossier presentation that renders the portfolio review step as a complete vertical profile and the designer repository as matching Avatar-led cards without changing the 520-pixel drawer or existing workflows.

**Architecture:** Add a focused `DesignerProfileCard` component that consumes an existing `PersonaProfile` and renders either a compact library presentation or the full review dossier. Keep selection and publishing in their current owners: `PersonaRepository` wraps the compact presentation in its button, while `DesignerLibrary` derives a transient profile from the current draft and generated artwork for review mode. Reuse `PersonaArtwork` for managed and built-in images, extending its existing failure state so broken images never surface as browser placeholders.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Playwright.

---

## File Map

- Create `src/app/studio/DesignerProfileCard.tsx`: shared compact and review dossier presentation, signal normalization, tag limiting, palette and negative-rule rendering.
- Create `src/app/studio/DesignerProfileCard.test.tsx`: component behavior, missing metrics, tag overflow, artwork failure, and accessible status coverage.
- Modify `src/app/studio/PersonaArtwork.tsx`: localize image and fallback labels and expose a stable accessible fallback when image loading fails.
- Modify `src/app/studio/PersonaArtwork.test.tsx`: update required locale input and verify localized fallback semantics.
- Modify `src/app/studio/DesignerHero.tsx`: pass its existing locale to `PersonaArtwork`.
- Modify `src/app/studio/PersonaCard.tsx`: pass its existing locale to `PersonaArtwork`.
- Modify `src/app/studio/PersonaInspector.tsx`: pass its existing locale to `PersonaArtwork`.
- Modify `src/app/studio/Studio.tsx`: pass the current application locale to its direct `PersonaArtwork` use.
- Modify `src/app/studio/PersonaRepository.tsx`: replace the legacy compact row contents with the shared library card while retaining filtering and whole-card selection.
- Modify `src/app/studio/PersonaRepository.test.tsx`: verify card content, selection, default state, filtering, and tag overflow.
- Modify `src/app/studio/DesignerLibrary.tsx`: construct the transient review profile and render the shared review dossier.
- Modify `src/app/studio/DesignerLibrary.test.tsx`: verify the review dossier, signal values, no extra generation request, back navigation, and publishing.
- Modify `src/app/studio/persona.css`: Avatar fallback, shared library card, stable card dimensions, selected/default/status states, and repository breakpoints.
- Modify `src/app/studio/library.css`: full review dossier, signal grid, DNA groups, rules, and drawer-responsive behavior.
- Modify `tests/e2e/designer-drawer.spec.ts`: review-step layout, overflow, footer, publishing, and screenshots at two viewports.
- Modify `tests/e2e/studio.spec.ts`: designer repository desktop/narrow card grid and content-resilience checks.

### Task 1: Build The Shared Dossier Presentation

**Files:**
- Create: `src/app/studio/DesignerProfileCard.tsx`
- Create: `src/app/studio/DesignerProfileCard.test.tsx`
- Modify: `src/app/studio/PersonaArtwork.tsx`
- Modify: `src/app/studio/PersonaArtwork.test.tsx`
- Modify: `src/app/studio/DesignerHero.tsx`
- Modify: `src/app/studio/PersonaCard.tsx`
- Modify: `src/app/studio/PersonaInspector.tsx`
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/studio/persona.css`

- [ ] **Step 1: Write failing shared-component tests**

Create `DesignerProfileCard.test.tsx` with a signal-rich fixture derived from `personaProfiles[0]` and these tests:

```tsx
it('renders the full review dossier from profile data', () => {
  render(<DesignerProfileCard locale="zh-CN" profile={profile} mode="review" />);

  const dossier = screen.getByRole('region', { name: '纸感排版设计师档案' });
  expect(within(dossier).getByRole('img', { name: /纸感排版/ })).toBeInTheDocument();
  expect(within(dossier).getByRole('heading', { name: '纸感排版' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: '核心指标' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: 'Style DNA' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: '否定规则' })).toBeInTheDocument();
  expect(within(dossier).getByRole('progressbar', { name: '留白占比' })).toHaveAttribute('aria-valuenow', '38');
  expect(within(dossier).getByText('#F4EFE7')).toBeInTheDocument();
});

it('renders missing signals without fabricating percentages', () => {
  render(<DesignerProfileCard locale="en" profile={{ ...profile, styleDna: { ...profile.styleDna, signals: undefined } }} mode="review" />);

  expect(screen.getAllByText('--')).toHaveLength(5);
  expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
  expect(screen.getAllByRole('progressbar').every((metric) => !metric.hasAttribute('aria-valuenow'))).toBe(true);
});

it('limits compact tags and reports the hidden count', () => {
  render(<DesignerProfileCard locale="en" profile={{ ...profile, tags: [tag1, tag2, tag3, tag4] }} mode="library" isDefault />);

  expect(screen.getByText('Default')).toBeInTheDocument();
  expect(screen.getByText('+2')).toBeInTheDocument();
  expect(screen.queryByText(localize('en', tag3))).not.toBeInTheDocument();
});

it('replaces a failed managed Avatar with an accessible fallback', () => {
  render(<DesignerProfileCard locale="en" profile={{ ...profile, artworkUrl: 'designhub-artwork://missing' }} mode="review" />);
  fireEvent.error(screen.getByRole('img', { name: /Paper & Type/ }));
  expect(screen.getByRole('img', { name: 'Designer Avatar unavailable' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /Paper & Type/ })).not.toBeInTheDocument();
});
```

Use a fifth test to assert library mode renders whitespace and diffuse-light values but does not render full DNA prose or negative-rule rows.

- [ ] **Step 2: Run the component tests and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerProfileCard.test.tsx
```

Expected: FAIL because `DesignerProfileCard.tsx` does not exist.

- [ ] **Step 3: Implement localized Avatar failure behavior**

Extend `PersonaArtworkProps` with `locale: Locale` and render explicit accessible fallbacks:

```tsx
type PersonaArtworkProps = {
  personaId: string;
  crop: PersonaCrop;
  profile?: PersonaProfile;
  locale: Locale;
};

const unavailableLabel = t(locale, '设计师形象不可用', 'Designer Avatar unavailable');

if (!persona || failed || !persona.artworkUrl.trim()) {
  return (
    <span
      className={`persona-artwork persona-artwork--${crop} persona-artwork--unavailable`}
      role="img"
      aria-label={unavailableLabel}
    >
      <Icon name="image" size={20} />
      <span>{failed ? unavailableLabel : t(locale, '形象待生成', 'Avatar pending')}</span>
    </span>
  );
}
```

Pass `locale` at every existing `PersonaArtwork` call site in `DesignerHero.tsx`, `PersonaCard.tsx`, `PersonaInspector.tsx`, `PersonaRepository.tsx`, and `Studio.tsx`. Use the existing `image` icon; do not add a custom SVG.

- [ ] **Step 4: Implement `DesignerProfileCard`**

Export this interface:

```tsx
type DesignerProfileCardProps = {
  locale: Locale;
  profile: PersonaProfile;
  mode: 'library' | 'review';
  isDefault?: boolean;
};

export const DesignerProfileCard = ({ locale, profile, mode, isDefault = false }: DesignerProfileCardProps) => { /* presentation only */ };
```

Add a local `ProfileMetric` that clamps valid values to `0..100` and omits `aria-valuenow` for missing values:

```tsx
const metricValue = (value: number | undefined): number | undefined =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value!))) : undefined;
```

For `library` mode render:

```tsx
<article className="designer-profile-card designer-profile-card--library">
  <div className="designer-profile-card__artwork">
    <PersonaArtwork locale={locale} personaId={profile.id} profile={profile} crop="avatar" />
    <span className={`designer-profile-card__status designer-profile-card__status--${profile.status}`}>{statusLabel}</span>
  </div>
  <div className="designer-profile-card__identity">
    <div><strong title={name}>{name}</strong>{isDefault && <Badge tone="primary">{defaultLabel}</Badge>}</div>
    <span title={signature}>{signature}</span>
  </div>
  <div className="designer-profile-card__tags">{firstTwoTags}{hiddenTagCount}</div>
  <div className="designer-profile-card__compact-metrics">{whitespace}{diffuseLight}</div>
  <small className="designer-profile-card__version mono">{profile.personaCode} / {profile.version}</small>
</article>
```

For `review` mode use one labelled `<section>` containing the identity header, a labelled four-metric region, a Style DNA region, and a Negative Rules region. Render only the first four palette entries. Put grain in the material subgroup, making five progressbars total in review mode.

- [ ] **Step 5: Add structural shared styles**

In `persona.css`, style the common Avatar and compact-card primitives:

```css
.designer-profile-card { min-width: 0; }
.designer-profile-card__artwork { position: relative; overflow: hidden; aspect-ratio: 4 / 3; }
.designer-profile-card__artwork .persona-artwork,
.designer-profile-card__artwork img { width: 100%; height: 100%; }
.designer-profile-card__identity strong,
.designer-profile-card__identity > span { overflow: hidden; text-overflow: ellipsis; }
.designer-profile-card__compact-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

Keep card corners at `6px`, use existing surface/border/theme tokens, give image and copy stable dimensions, and add visible focus styles to the eventual wrapping button rather than the presentation component.

- [ ] **Step 6: Run shared tests and confirm GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerProfileCard.test.tsx src/app/studio/PersonaArtwork.test.tsx
pnpm typecheck
```

Expected: all tests and typecheck pass. Update existing `PersonaArtwork.test.tsx` calls with `locale` and assert the localized accessible fallback.

- [ ] **Step 7: Commit the shared component**

```bash
git add src/app/studio/DesignerProfileCard.tsx src/app/studio/DesignerProfileCard.test.tsx src/app/studio/PersonaArtwork.tsx src/app/studio/PersonaArtwork.test.tsx src/app/studio/DesignerHero.tsx src/app/studio/PersonaCard.tsx src/app/studio/PersonaInspector.tsx src/app/studio/PersonaRepository.tsx src/app/studio/Studio.tsx src/app/studio/persona.css
git commit -m "feat: add shared designer dossier presentation"
```

### Task 2: Replace Repository Rows With Dossier Cards

**Files:**
- Modify: `src/app/studio/PersonaRepository.tsx`
- Modify: `src/app/studio/PersonaRepository.test.tsx`
- Modify: `src/app/studio/persona.css`

- [ ] **Step 1: Write failing repository-card tests**

Replace the compact-row wording and add assertions for the new card contract:

```tsx
it('renders selectable Avatar-led dossier cards', () => {
  const onSelect = vi.fn();
  render(<PersonaRepository locale="zh-CN" profiles={personaProfiles} selectedId="paper-type" sessionDefaultId="paper-type" onSelect={onSelect} />);

  const card = screen.getByRole('button', { name: /纸感排版/ });
  expect(card).toHaveAttribute('aria-pressed', 'true');
  expect(within(card).getByText('默认')).toBeInTheDocument();
  expect(within(card).getByText('留白占比')).toBeInTheDocument();
  expect(within(card).getByText('漫反射率')).toBeInTheDocument();
  fireEvent.click(card);
  expect(onSelect).toHaveBeenCalledWith('paper-type');
});
```

Add a long-content fixture and assert the name/signature nodes carry the complete `title`. Retain the existing filtering and empty-state tests.

- [ ] **Step 2: Run repository tests and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/PersonaRepository.test.tsx
```

Expected: FAIL because the repository still renders `.persona-repository-row` contents.

- [ ] **Step 3: Render the shared library mode**

Replace each legacy row body with:

```tsx
<button
  type="button"
  key={profile.id}
  className={`persona-repository-card-button ${selected ? 'is-selected' : ''}`}
  aria-pressed={selected}
  onClick={() => onSelect(profile.id)}
>
  <DesignerProfileCard
    locale={locale}
    profile={profile}
    mode="library"
    isDefault={profile.id === activeDefaultId}
  />
</button>
```

Do not add inner action buttons. Preserve search, status filters, create action, selection callback, and empty state unchanged.

- [ ] **Step 4: Replace row CSS with responsive card CSS**

Change `.persona-repository__list` to a two-column grid with stable tracks and make `.persona-repository-card-button` a full-card button. Remove or leave unreferenced legacy row rules only after `rg "persona-repository-row" src` confirms no production references.

Add a narrow breakpoint that switches the repository grid to one column. Preserve `min-width: 0`, line clamps, `title` values, and fixed artwork aspect ratio so long content cannot resize cards.

- [ ] **Step 5: Run repository and page tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/PersonaRepository.test.tsx src/app/studio/LibraryPages.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit the repository cards**

```bash
git add src/app/studio/PersonaRepository.tsx src/app/studio/PersonaRepository.test.tsx src/app/studio/persona.css
git commit -m "style: present designers as dossier cards"
```

### Task 3: Build The Full Review Dossier

**Files:**
- Modify: `src/app/studio/DesignerLibrary.tsx`
- Modify: `src/app/studio/DesignerLibrary.test.tsx`
- Modify: `src/app/studio/library.css`

- [ ] **Step 1: Write failing review-workflow assertions**

Extend `requests artwork for a selected candidate and adopts the managed image before publishing` immediately after clicking `下一步：预览发布`:

```tsx
const dossier = screen.getByRole('region', { name: '未来编辑设计师档案' });
expect(within(dossier).getByRole('img', { name: /未来编辑形象/ })).toHaveAttribute('src', 'designhub-artwork://artwork-portrait-1');
expect(within(dossier).getByRole('region', { name: '核心指标' })).toBeInTheDocument();
expect(within(dossier).getByRole('region', { name: 'Style DNA' })).toBeInTheDocument();
expect(within(dossier).getByRole('region', { name: '否定规则' })).toHaveTextContent('避免霓虹渐变');
expect(submitDesignerArtworkGeneration).toHaveBeenCalledTimes(1);
```

Add a separate test where `saveDesignerState` rejects. Assert the dossier remains present, the generated Avatar remains present, and the localized publish error is shown.

- [ ] **Step 2: Run the workflow tests and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: FAIL because the review step still renders the minimal candidate-review section.

- [ ] **Step 3: Derive a transient review profile**

Inside `DesignerLibrary`, derive the display profile only when draft, source profile, and generated artwork exist:

```tsx
const reviewProfile = analysisDraft && analysisProfile && artwork
  ? {
      ...profileFromDraft(analysisDraft, analysisProfile, locale),
      artworkAssetId: artwork.assetId,
      artworkUrl: artwork.artworkUrl,
    }
  : undefined;
```

Pass `reviewProfile` to `PortfolioCreationDrawer`. Do not store it in state and do not submit another generation request.

- [ ] **Step 4: Replace the minimal review markup**

In the review branch render:

```tsx
<section className="portfolio-review">
  <p className="section-kicker">{t(locale, '预览发布', 'Preview and publish')}</p>
  {reviewProfile && <DesignerProfileCard locale={locale} profile={reviewProfile} mode="review" />}
  {publishedInSession && <p className="panel-note portfolio-review__published"><Icon name="check" size={15} />{t(locale, '已发布。', 'Published.')}</p>}
  {error && <p className="form-error" role="alert">{error}</p>}
</section>
```

Keep the existing review footer callbacks and button states unchanged.

- [ ] **Step 5: Add review-specific layout styles**

In `library.css`, add the selected vertical dossier direction:

- Identity panel: `112px minmax(0, 1fr)` at normal drawer width.
- Core signals: two columns.
- DNA groups and negative rules: one vertical flow.
- Palette: no more than four stable swatches.
- A container query or the existing narrow media query changes identity and signals to one column when the available drawer content is too narrow.
- All headings use compact panel typography; do not introduce viewport-scaled font sizes.
- Use project theme variables and primary/secondary/warning/error accents, with no new gradient decoration.

- [ ] **Step 6: Run DesignerLibrary tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerProfileCard.test.tsx src/app/studio/DesignerLibrary.test.tsx
pnpm typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 7: Commit the review dossier**

```bash
git add src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/library.css
git commit -m "feat: add designer dossier review"
```

### Task 4: Verify Responsive Layout And Complete The Change

**Files:**
- Modify: `tests/e2e/designer-drawer.spec.ts`
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Add failing drawer browser assertions**

After entering review in `designer-drawer.spec.ts`, assert:

```ts
const dossier = drawer.getByRole('region', { name: '纸间秩序设计师档案' });
await expect(dossier).toBeVisible();
await expect(dossier.getByRole('progressbar')).toHaveCount(5);
await expect(dossier.getByRole('region', { name: 'Style DNA' })).toBeVisible();
await expect(dossier.getByRole('region', { name: '否定规则' })).toBeVisible();
expect(Math.abs((await drawer.boundingBox())!.width - expectedWidth)).toBeLessThanOrEqual(1);
```

Reuse the existing overflow collector on the review phase, scroll the drawer to the bottom, assert the publish footer is visible, and capture `portfolio-review.png` and `portfolio-review-bottom.png` in both viewports.

- [ ] **Step 2: Add failing repository-grid browser assertions**

In `studio.spec.ts`, navigate to Designers with seeded preview profiles and assert each visible profile control contains `.designer-profile-card--library`. At a desktop viewport assert two computed grid columns; at the narrow test viewport assert one. Add a long-content fixture through the existing preview/init mechanism and verify its name bounding box remains inside the card.

- [ ] **Step 3: Run both browser specs and confirm RED or expose missing layout constraints**

Run:

```bash
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts tests/e2e/studio.spec.ts
```

Expected before final CSS/test-fixture alignment: new review or repository assertions fail. If they already pass because Tasks 1-3 fully satisfy the contract, verify the new assertions fail when the new shared component class is temporarily renamed, then restore it and rerun to preserve regression-test evidence.

- [ ] **Step 4: Fix only browser-discovered layout issues**

Adjust `persona.css` or `library.css` only for concrete failures such as overflow, unstable card height, clipped footer, or wrong breakpoint. Do not change the approved information hierarchy.

- [ ] **Step 5: Re-run browser specs and inspect screenshots**

Run:

```bash
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts tests/e2e/studio.spec.ts
```

Expected: both specs pass. Inspect all review and repository screenshots at desktop and narrow viewports. Confirm readable hierarchy, loaded Avatar, stable cards, no horizontal overflow, and non-overlapping footer controls.

- [ ] **Step 6: Run the full verification gate**

Run fresh:

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts tests/e2e/studio.spec.ts
git diff --check
git status --short --branch
```

Expected: all commands exit `0`; the only uncommitted files are the Task 4 browser tests and any browser-driven CSS adjustments.

- [ ] **Step 7: Commit the responsive regression coverage**

```bash
git add tests/e2e/designer-drawer.spec.ts tests/e2e/studio.spec.ts src/app/studio/persona.css src/app/studio/library.css
git commit -m "test: cover designer dossier layouts"
```

Inspect `git status --short` before staging and omit CSS files when Task 4 required no CSS changes.

- [ ] **Step 8: Confirm the final repository state**

Run:

```bash
git diff --check
git status --short --branch
git log -5 --oneline
```

Expected: clean worktree on `main`, with the dossier component, repository cards, review layout, and browser coverage committed.
