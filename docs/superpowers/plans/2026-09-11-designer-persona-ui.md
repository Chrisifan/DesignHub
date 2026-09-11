# Designer Persona UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the example design gallery, new-design surface, designer library, and designer-creation flow around a session-only AI designer persona with three selectable character candidates.

**Architecture:** Keep formal M02/M03/M06 behavior untouched. Add a presentation-only persona model and static generated example artwork, then compose small display components into the existing React studio. The new-design route owns the brief draft; the designer library owns only example profile/candidate state; existing Studio remains the coordinator for navigation and preview-project creation.

**Tech Stack:** React 19, TypeScript, existing Vite/Vitest/Playwright stack, existing local SVG icon set, CSS variables and native `<dialog>` primitives. No additional package is introduced.

---

## File Map

- Create `src/app/studio/personas.ts`: localizable, session-only profile/candidate data and lookup helpers.
- Create `src/app/studio/personas.test.ts`: profile/candidate invariants and localization tests.
- Create `src/app/studio/PersonaArtwork.tsx`: stable avatar/half/full crop renderer with loading fallback.
- Create `src/app/studio/PersonaArtwork.test.tsx`: semantic image and fallback contract.
- Create `src/app/studio/PersonaCard.tsx`: candidate card presentation with accessible selection state.
- Create `src/app/studio/DesignerHero.tsx`: active-designer hero for project details and new-design surface.
- Create `src/app/studio/NewDesignPage.tsx`: manual and conversation creation modes with a character hero.
- Create `src/app/studio/NewDesignPage.test.tsx`: draft retention, designer switching, and unavailable-model behavior.
- Create `src/app/studio/PersonaRepository.tsx`: P10 compact profile rows, repository filter/search, and selected-profile handoff.
- Create `src/app/studio/PersonaRepository.test.tsx`: repository filtering and accessible selected-row coverage.
- Create `src/app/studio/PersonaInspector.tsx`: P12 identity, Style DNA, negative rules, curated sheets, and session-only action surface.
- Create `src/app/studio/PersonaInspector.test.tsx`: inspector details, default, derive, and new-design handoff coverage.
- Create `src/app/studio/DesignerLibrary.tsx`: P10/P11 session coordinator, two creation modes, three-candidate selection, and explicit preview publish.
- Create `src/app/studio/DesignerLibrary.test.tsx`: candidate selection, rights gate, and session-only publish behavior.
- Create `src/app/studio/persona.css`: persona card, artwork, hero, creation-page, candidate-grid, responsive, focus, and reduced-motion rules.
- Create `public/personas/paper-type.png`, `public/personas/clear-commerce.png`, `public/personas/natural-story.png`: generated example character portraits for the local UI only.
- Modify `src/app/studio/types.ts`: add `StudioView`, `CreationMode`, and presentation-only persona references without changing workspace storage types.
- Modify `src/app/studio/examples.ts`: associate each example project with stable persona IDs.
- Modify `src/app/studio/Studio.tsx`: replace project creation modal usage with the new-design route; render compact attribution and active-designer hero; retain the existing session-only project-creation behavior.
- Modify `src/app/studio/LibraryPages.tsx`: delegate `designers` to `DesignerLibrary`; remove duplicated designer card/form state after its behavior moves.
- Modify `src/app/styles/studio.css`: import/use the persona stylesheet and reserve responsive page-region space without changing shell dimensions.
- Modify `src/app/Studio.test.tsx`, `src/app/studio/LibraryPages.test.tsx`, `tests/e2e/studio.spec.ts`: assert persona flows and preserve prior project/workbench journeys.
- Modify `docs/verification/UI-FRAMEWORK.md`: record changed UI scope and exact command evidence after execution.

### Task 1: Persona Data, Example Artwork, and Image Primitive

**Files:**
- Create: `src/app/studio/personas.ts`
- Create: `src/app/studio/personas.test.ts`
- Create: `src/app/studio/PersonaArtwork.tsx`
- Create: `src/app/studio/PersonaArtwork.test.tsx`
- Create: `src/app/studio/persona.css`
- Create: `public/personas/paper-type.png`
- Create: `public/personas/clear-commerce.png`
- Create: `public/personas/natural-story.png`

- [ ] **Step 1: Generate three bundled example portraits and record their truthful purpose.**

Use the `imagegen` skill to produce three non-photorealistic, full-body editorial character portraits with distinct silhouettes. Give each a neutral background and compose the subject to survive avatar, half-body, and full-body crops. Use prompts equivalent to:

```text
paper-type: stylized editorial design persona, warm paper textures, geometric bob haircut,
indigo smock, full body, front three-quarter pose, neutral studio background, no text, no logo

clear-commerce: stylized commercial design persona, clear product-minded visual language,
tailored teal jacket, full body, front three-quarter pose, neutral studio background, no text, no logo

natural-story: stylized narrative design persona, botanical and collage-inspired details,
rust red overshirt, full body, front three-quarter pose, neutral studio background, no text, no logo
```

Save the selected bitmap output under the three exact `public/personas/*.png` paths. Each visible UI usage must label these as bundled example artwork, never a model result created during the user session.

- [ ] **Step 2: Write the failing data and image tests.**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { PersonaArtwork } from './PersonaArtwork';
import { getPersona, personaCandidates } from './personas';

it('keeps exactly three ready example candidates with localized identity data', () => {
  expect(personaCandidates).toHaveLength(3);
  expect(personaCandidates.every((candidate) => candidate.status === 'ready')).toBe(true);
  expect(getPersona('paper-type')?.name.zh).toBe('纸感排版');
  expect(getPersona('missing')).toBeUndefined();
});

it('renders an accessible fixed-ratio persona image and an honest unavailable fallback', () => {
  const { rerender } = render(<PersonaArtwork personaId="paper-type" crop="full" />);
  expect(screen.getByRole('img', { name: '纸感排版的人物形象' })).toHaveAttribute('src', '/personas/paper-type.png');
  rerender(<PersonaArtwork personaId="missing" crop="avatar" />);
  expect(screen.getByText('形象不可用')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the focused tests and observe Red.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/personas.test.ts src/app/studio/PersonaArtwork.test.tsx`

Expected: FAIL because the new modules do not exist. Do not count an asset-generation or browser-environment error as behavioral Red.

- [ ] **Step 4: Implement the smallest complete session-only model and artwork primitive.**

```ts
import type { Artwork } from './types';

export type LocalizedText = { zh: string; en: string };
export type PersonaCrop = 'avatar' | 'half' | 'full';
export type PersonaCandidateStatus = 'idle' | 'generating' | 'ready' | 'failed';

export type PersonaProfile = {
  id: string;
  name: LocalizedText;
  signature: LocalizedText;
  summary: LocalizedText;
  principle: LocalizedText;
  personaCode: string;
  version: string;
  status: 'built-in' | 'published' | 'draft';
  artworkUrl: string;
  artworkAlt: LocalizedText;
  tags: LocalizedText[];
  referenceCount: number;
  styleDna: {
    palette: string[];
    typography: LocalizedText;
    composition: LocalizedText;
    texture: LocalizedText;
  };
  negativeRules: LocalizedText[];
  portfolioSheets: Array<{
    id: string;
    artwork: Artwork;
    title: LocalizedText;
    note: LocalizedText;
  }>;
};

export type PersonaCandidate = {
  id: string;
  personaId: string;
  ordinal: 1 | 2 | 3;
  status: PersonaCandidateStatus;
};

export const localize = (locale: 'zh-CN' | 'en', value: LocalizedText): string =>
  locale === 'zh-CN' ? value.zh : value.en;

export const personaCandidates: PersonaCandidate[] = [
  { id: 'candidate-paper', personaId: 'paper-type', ordinal: 1, status: 'ready' },
  { id: 'candidate-commerce', personaId: 'clear-commerce', ordinal: 2, status: 'ready' },
  { id: 'candidate-story', personaId: 'natural-story', ordinal: 3, status: 'ready' },
];

export const getPersona = (id: string): PersonaProfile | undefined =>
  personaProfiles.find((profile) => profile.id === id);
```

```tsx
export const PersonaArtwork = ({
  personaId,
  crop,
}: {
  personaId: string;
  crop: PersonaCrop;
}) => {
  const persona = getPersona(personaId);
  if (!persona) return <span className="persona-artwork persona-artwork--unavailable">形象不可用</span>;
  return (
    <span className={`persona-artwork persona-artwork--${crop}`}>
      <img src={persona.artworkUrl} alt={`${persona.artworkAlt.zh}的人物形象`} />
    </span>
  );
};
```

Use `aspect-ratio`, `object-fit: cover`, explicit crop positions, `overflow: hidden`, stable `min-width: 0`, and a non-animated fallback. All authored functions remain arrows.

- [ ] **Step 5: Run focused tests and inspect the asset build.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/personas.test.ts src/app/studio/PersonaArtwork.test.tsx && pnpm build`

Expected: both focused test files pass; the renderer build copies all three persona assets.

- [ ] **Step 6: Commit the isolated foundation.**

```bash
git add public/personas src/app/studio/personas.ts src/app/studio/personas.test.ts src/app/studio/PersonaArtwork.tsx src/app/studio/PersonaArtwork.test.tsx src/app/studio/persona.css
git commit -m "feat(ui): add designer persona assets and primitives"
```

### Task 2: Persona Components and Design Attribution

**Files:**
- Create: `src/app/studio/PersonaCard.tsx`
- Create: `src/app/studio/DesignerHero.tsx`
- Modify: `src/app/studio/types.ts`
- Modify: `src/app/studio/examples.ts`
- Modify: `src/app/studio/Studio.tsx:49-143,327-375,439-565`
- Modify: `src/app/studio/persona.css`
- Modify: `src/app/Studio.test.tsx`

- [ ] **Step 1: Write failing integration-facing UI tests.**

```tsx
it('shows a design cover with its designer avatar, name, and version', () => {
  enter();
  const project = screen.getByRole('button', { name: '春间市集' });
  expect(within(project).getByRole('img', { name: '纸感排版的人物形象' })).toBeInTheDocument();
  expect(within(project).getByText('纸感排版 · v1.4')).toBeInTheDocument();
});

it('shows the active persona with a working-principle when opening a project', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: '春间市集' }));
  expect(screen.getByLabelText('当前设计师')).toHaveTextContent('先建立文字层级');
  expect(screen.getByRole('img', { name: '纸感排版的人物形象' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the new assertions and observe Red.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/Studio.test.tsx -t "designer avatar|active persona"`

Expected: FAIL because project cards still use letter dots and project detail only exposes text metadata.

- [ ] **Step 3: Implement the view-model mapping and compact/display components.**

```ts
export type Project = {
  id: string;
  name: string;
  enName: string;
  description: string;
  enDescription: string;
  designerIds: string[];
  artwork: Artwork;
  documents: number;
  archived?: boolean;
};

export const getProjectPersona = (project: Project) =>
  getPersona(project.designerIds[0]) ?? getPersona('paper-type')!;
```

```tsx
type DesignerHeroProps = { personaId: string; locale: Locale; compact?: boolean; label?: string };

export const DesignerHero = ({ personaId, locale, compact = false, label }: DesignerHeroProps) => {
  const persona = getPersona(personaId)!;
  return (
    <section className={`designer-hero ${compact ? 'designer-hero--compact' : ''}`} aria-label={label ?? t(locale, '当前设计师', 'Active designer')}>
      <PersonaArtwork personaId={persona.id} crop={compact ? 'avatar' : 'half'} />
      <div><span>{t(locale, '当前设计师', 'Active designer')}</span><strong>{localize(locale, persona.name)} · {persona.version}</strong><p>{localize(locale, persona.principle)}</p></div>
    </section>
  );
};
```

Replace the `designer-dot` content in project cards with `PersonaArtwork` and one-line metadata. Insert `DesignerHero` in project detail above `project-context`. Preserve artwork-first card cover, the existing button accessible name, example-session disclosure, and document-opening behavior.

- [ ] **Step 4: Add responsive attribution CSS.**

```css
.design-attribution { display:flex; align-items:center; gap:8px; min-width:0; }
.design-attribution strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.design-attribution .persona-artwork--avatar { inline-size:24px; block-size:24px; flex:0 0 24px; }
.designer-hero { display:grid; grid-template-columns:104px minmax(0,1fr); min-height:132px; overflow:hidden; }
@media (max-width: 1279px) { .designer-hero { grid-template-columns:72px minmax(0,1fr); } }
```

- [ ] **Step 5: Run the focused and existing Studio tests.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/Studio.test.tsx`

Expected: all Studio assertions pass, including prior search, document, delivery, theme, and session-only project tests.

- [ ] **Step 6: Commit the attribution slice.**

```bash
git add src/app/studio/types.ts src/app/studio/examples.ts src/app/studio/PersonaCard.tsx src/app/studio/DesignerHero.tsx src/app/studio/persona.css src/app/studio/Studio.tsx src/app/Studio.test.tsx
git commit -m "feat(ui): attribute designs to persona profiles"
```

### Task 3: Full New-Design Surface with Character Hero

**Files:**
- Create: `src/app/studio/NewDesignPage.tsx`
- Create: `src/app/studio/NewDesignPage.test.tsx`
- Modify: `src/app/studio/types.ts`
- Modify: `src/app/studio/Studio.tsx:49-143,240-428,671-760`
- Modify: `src/app/studio/persona.css`
- Modify: `src/app/Studio.test.tsx`
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Write failing new-design page tests.**

```tsx
const NewDesignHarness = () => {
  const [draft, setDraft] = useState<NewDesignDraft>(initialDraft);
  return <NewDesignPage locale="zh-CN" draft={draft} onDraftChange={setDraft} onCreate={vi.fn()} onBack={vi.fn()} />;
};

it('keeps manual and conversation input in one session draft while the hero follows the selected designer', () => {
  render(<NewDesignHarness />);
  fireEvent.click(screen.getByRole('button', { name: '通过对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '创作想法' }), { target: { value: '春季市集宣传图' } });
  fireEvent.click(screen.getByRole('button', { name: '纸感排版' }));
  expect(screen.getByLabelText('新建设计的当前设计师')).toHaveTextContent('纸感排版');
  expect(screen.getByText('模型未连接，想法已保留在示例草稿中。')).toBeInTheDocument();
});
```

```tsx
it('opens the page instead of a project-creation modal and creates only a session preview', () => {
  enter();
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  expect(screen.getByRole('heading', { name: '新建设计' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: '新建项目' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused tests and observe Red.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/NewDesignPage.test.tsx src/app/Studio.test.tsx -t "new-design|session preview"`

Expected: FAIL because the page module and `new-design` surface do not exist, and creation still opens a modal.

- [ ] **Step 3: Introduce the bounded page route and draft contract.**

```ts
export type CreationMode = 'manual' | 'conversation';
export type StudioSurface = View | 'new-design';
export type NewDesignDraft = {
  name: string;
  goal: string;
  brief: string;
  personaId: string;
  size: '1080 × 1440';
  mode: CreationMode;
};
```

```tsx
export const NewDesignPage = ({ locale, draft, onDraftChange, onCreate, onBack }: NewDesignPageProps) => (
  <section className="new-design-page" aria-labelledby="new-design-title">
    <header><Button icon="arrow-left" variant="ghost" onClick={onBack}>{t(locale, '返回', 'Back')}</Button><h1 id="new-design-title">{t(locale, '新建设计', 'New design')}</h1></header>
    <div className="new-design-layout">
      <form className="new-design-form" onSubmit={onCreate}>
        <label>{t(locale, '项目名称', 'Project name')}<input value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} /></label>
        <button type="button" onClick={() => onDraftChange({ ...draft, mode: 'manual' })}>{t(locale, '手动填写', 'Manual')}</button>
        <button type="button" onClick={() => onDraftChange({ ...draft, mode: 'conversation' })}>{t(locale, '通过对话', 'Chat')}</button>
        {draft.mode === 'conversation' && <label>{t(locale, '创作想法', 'Creative idea')}<textarea value={draft.brief} onChange={(event) => onDraftChange({ ...draft, brief: event.target.value })} /></label>}
      </form>
      <DesignerHero personaId={draft.personaId} locale={locale} label={t(locale, '新建设计的当前设计师', 'New design active designer')} />
    </div>
  </section>
);
```

In `Studio`, retain one `NewDesignDraft` state through locale/theme changes. Replace every project-creation trigger with `openNewDesign(mode, personaId?)`, render `NewDesignPage` only for `surface === 'new-design'`, and have the existing preview-project creator consume the same draft. Its success path must reset only after it creates the in-memory project, select that project, return to `projects`, and show the existing session-only notice. Pass `onUseForNewDesign={(personaId) => openNewDesign('manual', personaId)}` through `LibraryPages` so the P12 action selects the profile for a new in-memory draft rather than mutating a project.

- [ ] **Step 4: Implement desktop and narrow layouts without changing shell geometry.**

```css
.new-design-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(300px, 38%); min-height:0; border-top:1px solid var(--border-subtle); }
.new-design-form { padding:24px; min-width:0; }
.new-design-page > .designer-hero { min-height:calc(100dvh - 176px); }
@media (max-width:1279px) { .new-design-layout { grid-template-columns:minmax(0,1fr); } .new-design-page > .designer-hero { min-height:148px; } }
@media (prefers-reduced-motion:reduce) { .persona-artwork img { transition:none; } }
```

Use actual form controls for title, goal, conversation idea, and designer selection. Keep Chinese visible primary actions at or under four Han characters: `创建`, `返回`, `切换`, `选用`. Use an icon plus accessible label for low-frequency inspection.

- [ ] **Step 5: Run focused UI tests and browser creation journey.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/NewDesignPage.test.tsx src/app/Studio.test.tsx && pnpm test:e2e -- tests/e2e/studio.spec.ts`

Expected: unit tests pass; the browser suite opens the page, switches to conversation mode, shows the persona hero at 1280px and compact hero at 1024px, and detects no horizontal overflow.

- [ ] **Step 6: Commit the new-design route.**

```bash
git add src/app/studio/NewDesignPage.tsx src/app/studio/NewDesignPage.test.tsx src/app/studio/types.ts src/app/studio/persona.css src/app/studio/Studio.tsx src/app/Studio.test.tsx tests/e2e/studio.spec.ts
git commit -m "feat(ui): add persona-led new design surface"
```

### Task 4: Persona Repository, Inspector, Candidate Review, and Preview Publish

**Files:**
- Create: `src/app/studio/PersonaRepository.tsx`
- Create: `src/app/studio/PersonaRepository.test.tsx`
- Create: `src/app/studio/PersonaInspector.tsx`
- Create: `src/app/studio/PersonaInspector.test.tsx`
- Create: `src/app/studio/DesignerLibrary.tsx`
- Create: `src/app/studio/DesignerLibrary.test.tsx`
- Modify: `src/app/studio/personas.ts`
- Modify: `src/app/studio/personas.test.ts`
- Modify: `src/app/studio/LibraryPages.tsx:1-420,1353-1496`
- Modify: `src/app/studio/LibraryPages.test.tsx`
- Modify: `src/app/studio/Studio.tsx:49-143,580-610`
- Modify: `src/app/studio/persona.css`
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Extend the profile contract and write failing repository/inspector tests.**

First extend `personas.test.ts` with a data assertion for the structured inspection fields. Then create the following component tests before creating either production component:

```tsx
it('keeps a creative-persona code, Style DNA, rules, and curated sheets for each example profile', () => {
  const profile = getPersona('paper-type');
  expect(profile?.personaCode).toBe('INTP-A');
  expect(profile?.styleDna.palette).toHaveLength(3);
  expect(profile?.negativeRules).toHaveLength(3);
  expect(profile?.portfolioSheets).toHaveLength(3);
});
```

```tsx
it('filters compact profile rows and identifies the selected profile without making a second navigation rail', () => {
  render(
    <PersonaRepository
      locale="zh-CN"
      profiles={personaProfiles}
      selectedId="paper-type"
      sessionDefaultId="paper-type"
      onSelect={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('设计师档案库')).toHaveTextContent('纸感排版');
  expect(screen.getByRole('button', { name: /纸感排版/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索档案' }), { target: { value: '商业' } });
  expect(screen.getByRole('button', { name: /清晰商业/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /纸感排版/ })).not.toBeInTheDocument();
});
```

```tsx
it('shows the selected profile as a creative identity and only emits session actions', () => {
  const onSetDefault = vi.fn();
  const onUseForNewDesign = vi.fn();
  render(
    <PersonaInspector
      locale="zh-CN"
      profile={getPersona('paper-type')!}
      isSessionDefault={false}
      onSetDefault={onSetDefault}
      onDeriveDraft={vi.fn()}
      onUseForNewDesign={onUseForNewDesign}
    />,
  );
  expect(screen.getByText('创意代号')).toBeInTheDocument();
  expect(screen.getByLabelText('风格 DNA')).toHaveTextContent('排版');
  expect(screen.getByLabelText('禁用规则')).toHaveTextContent('霓虹');
  expect(screen.getByLabelText('精选作品')).toHaveTextContent('春生特刊');
  expect(screen.queryByText(/GPU|云端任务|完成率/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '设默认' }));
  fireEvent.click(screen.getByRole('button', { name: '用于新建' }));
  expect(onSetDefault).toHaveBeenCalledWith('paper-type');
  expect(onUseForNewDesign).toHaveBeenCalledWith('paper-type');
});
```

- [ ] **Step 2: Run the repository/inspector assertions and observe Red.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/personas.test.ts src/app/studio/PersonaRepository.test.tsx src/app/studio/PersonaInspector.test.tsx`

Expected: FAIL because the profile contract has no structured inspector data and the repository/inspector modules do not exist. The failure must be about the missing behavior, not a missing test setup dependency.

- [ ] **Step 3: Implement the presentation data and two focused P10/P12 components.**

Add `personaCode`, localizable `styleDna`, exactly three localizable `negativeRules`, and exactly three curated `portfolioSheets` to each `PersonaProfile`. The sheet artwork must reuse the existing example artwork kinds and be labeled as bundled example references. Do not add a model name, source URL fetch, hardware metric, progress percentage, or generated-result claim.

```tsx
type PersonaRepositoryProps = {
  locale: Locale;
  profiles: PersonaProfile[];
  selectedId: string;
  sessionDefaultId: string;
  onSelect: (personaId: string) => void;
};

export const PersonaRepository = ({ locale, profiles, selectedId, sessionDefaultId, onSelect }: PersonaRepositoryProps) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'built-in'>('all');
  const visibleProfiles = profiles.filter((profile) => {
    const matchesFilter = filter === 'all' || profile.status === filter;
    const queryText = `${localize(locale, profile.name)} ${profile.personaCode} ${profile.tags.map((tag) => localize(locale, tag)).join(' ')}`;
    return matchesFilter && queryText.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  return (
    <section className="persona-repository" aria-label={t(locale, '设计师档案库', 'Persona repository')}>
      <header className="persona-repository__header">
        <p className="panel-label">{t(locale, '创意档案库', 'Persona repository')}</p>
        <div className="persona-repository__controls" role="group" aria-label={t(locale, '档案筛选', 'Profile filters')}>
          {(['all', 'published', 'built-in'] as const).map((value) => (
            <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {value === 'all' ? t(locale, '全部', 'All') : value === 'published' ? t(locale, '已发布', 'Published') : t(locale, '内置', 'Built-in')}
            </button>
          ))}
        </div>
        <label className="search-input"><Icon name="search" size={16} /><span className="sr-only">{t(locale, '搜索档案', 'Search profiles')}</span><input type="search" aria-label={t(locale, '搜索档案', 'Search profiles')} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </header>
      <div className="persona-repository__list">
        {visibleProfiles.map((profile) => <button type="button" key={profile.id} className="persona-repository__row" aria-pressed={profile.id === selectedId} onClick={() => onSelect(profile.id)} title={`${localize(locale, profile.name)} · ${profile.personaCode}`}>
          <PersonaArtwork personaId={profile.id} crop="avatar" />
          <span className="persona-repository__copy"><strong>{localize(locale, profile.name)}</strong><span className="persona-repository__meta">{profile.personaCode} · {profile.version} · {profile.status === 'built-in' ? t(locale, '内置', 'Built-in') : profile.status === 'published' ? t(locale, '已发布', 'Published') : t(locale, '草稿', 'Draft')}</span><span className="persona-repository__tags">{profile.tags.map((tag) => localize(locale, tag)).join(' · ')}</span><span className="persona-repository__meta">{profile.id === sessionDefaultId && <><Icon name="check" size={12} />{t(locale, '本次默认', 'Session default')} · </>}{t(locale, `${profile.referenceCount} 个关联项目`, `${profile.referenceCount} linked projects`)}</span></span>
        </button>)}
      </div>
    </section>
  );
};
```

Each repository row is a native `button` with a `PersonaArtwork` avatar, localized name, `personaCode`, version/status, one-line tag list, and local example-project reference count. Apply `aria-pressed`, a check icon plus text for the session default, and a full `title` for clipped labels. The filter labels are `全部`, `已发布`, `内置`; the search has a `<label>` and uses the existing search icon. Do not add a second global navigation rail.

```tsx
type PersonaInspectorProps = {
  locale: Locale;
  profile: PersonaProfile;
  isSessionDefault: boolean;
  onSetDefault: (personaId: string) => void;
  onDeriveDraft: (personaId: string) => void;
  onUseForNewDesign: (personaId: string) => void;
};

export const PersonaInspector = ({ profile, isSessionDefault, onSetDefault, onDeriveDraft, onUseForNewDesign, locale }: PersonaInspectorProps) => (
  <aside className="persona-inspector" aria-label={t(locale, '设计师详情', 'Persona details')}>
    <section className="persona-inspector__identity">
      <PersonaArtwork personaId={profile.id} crop="half" />
      <div><p className="section-kicker">{t(locale, '创意代号', 'Creative persona code')} · {profile.personaCode}</p><h2>{localize(locale, profile.name)} · {profile.version}</h2><p>{localize(locale, profile.summary)}</p><p>{isSessionDefault ? t(locale, '本次会话默认', 'Session default') : t(locale, '未设为本次默认', 'Not this session default')}</p><div className="persona-inspector__actions"><Button type="button" icon="check" variant="secondary" disabled={isSessionDefault} onClick={() => onSetDefault(profile.id)}>{t(locale, '设默认', 'Set default')}</Button><Button type="button" icon="copy" variant="ghost" onClick={() => onDeriveDraft(profile.id)}>{t(locale, '派生', 'Derive')}</Button><Button type="button" icon="plus" variant="primary" onClick={() => onUseForNewDesign(profile.id)}>{t(locale, '用于新建', 'Use for new')}</Button></div></div>
    </section>
    <div className="persona-inspector__detail-grid">
      <section className="persona-inspector__panel" aria-label={t(locale, '风格 DNA', 'Style DNA')}><h3>{t(locale, '风格 DNA', 'Style DNA')}</h3><dl><dt>{t(locale, '色彩', 'Palette')}</dt><dd>{profile.styleDna.palette.join(' · ')}</dd><dt>{t(locale, '排版', 'Typography')}</dt><dd>{localize(locale, profile.styleDna.typography)}</dd><dt>{t(locale, '构图', 'Composition')}</dt><dd>{localize(locale, profile.styleDna.composition)}</dd><dt>{t(locale, '质感', 'Texture')}</dt><dd>{localize(locale, profile.styleDna.texture)}</dd></dl></section>
      <section className="persona-inspector__panel" aria-label={t(locale, '禁用规则', 'Negative rules')}><h3>{t(locale, '禁用规则', 'Negative rules')}</h3><ul>{profile.negativeRules.map((rule) => <li key={rule.zh}><Icon name="circle-alert" size={14} />{localize(locale, rule)}</li>)}</ul></section>
    </div>
    <section className="persona-inspector__sheets" aria-label={t(locale, '精选作品', 'Curated portfolio')}><h3>{t(locale, '精选作品', 'Curated portfolio')}</h3><div className="persona-sheet-grid">{profile.portfolioSheets.map((sheet) => <article key={sheet.id}><ArtworkPreview kind={sheet.artwork} /><strong>{localize(locale, sheet.title)}</strong><p>{localize(locale, sheet.note)}</p></article>)}</div></section>
    <p className="panel-note">{t(locale, '动作仅在本次示例会话中生效，不会写入磁盘。', 'Actions affect this example session only; nothing is written to disk.')}</p>
  </aside>
);
```

`PersonaInspector` uses short actions `设默认`, `派生`, and `用于新建` (`Set default`, `Derive`, `Use for new`). The default action changes only the local session marker. The derive action opens a prefilled designer draft in the library. The new-design action calls an injected callback; it does not create or alter a persisted project.

- [ ] **Step 4: Write failing orchestration tests for the P10/P11 handoffs.**

```tsx
it('synchronizes a selected repository row with its inspector and changes only the session default', () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} onUseForNewDesign={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /清晰商业/ }));
  expect(screen.getByLabelText('设计师详情')).toHaveTextContent('清晰商业');
  fireEvent.click(screen.getByRole('button', { name: '设默认' }));
  expect(screen.getByLabelText('设计师详情')).toHaveTextContent('本次会话默认');
  expect(screen.getByText(/不会写入磁盘/)).toBeInTheDocument();
});

it('requires portfolio rights confirmation before entering candidate review', () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} onUseForNewDesign={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  fireEvent.click(screen.getByRole('button', { name: '作品集' }));
  fireEvent.click(screen.getByRole('button', { name: '生成' }));
  expect(screen.getByText('请先确认拥有分析这些来源的权利。')).toBeInTheDocument();
});

it('presents exactly three candidates, supports selection, and marks preview publish as session-only', () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} onUseForNewDesign={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  fireEvent.change(screen.getByRole('textbox', { name: '风格描述' }), { target: { value: '纸张、城市与留白' } });
  fireEvent.click(screen.getByRole('button', { name: '生成' }));
  const candidates = screen.getAllByRole('button', { name: /候选/ });
  expect(candidates).toHaveLength(3);
  fireEvent.click(candidates[1]!);
  expect(candidates[1]).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '发布预览' }));
  expect(screen.getByText('已在本次示例会话中发布，不会写入磁盘。')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run the orchestration assertions and observe Red.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx src/app/studio/LibraryPages.test.tsx -t "session default|portfolio rights|three candidates|preview publish"`

Expected: FAIL because `DesignerLibrary` does not exist and `LibraryPages` still owns the obsolete generic designer dialog.

- [ ] **Step 6: Compose P10/P11 state and route the cross-page action through Studio.**

```tsx
type DesignerLibraryProps = {
  locale: Locale;
  notify: (message: string) => void;
  onUseForNewDesign: (personaId: string) => void;
};

export const DesignerLibrary = ({ locale, notify, onUseForNewDesign }: DesignerLibraryProps) => {
  const [selectedId, setSelectedId] = useState('paper-type');
  const [sessionDefaultId, setSessionDefaultId] = useState('paper-type');
  const [screen, setScreen] = useState<'library' | 'create'>('library');
  const [source, setSource] = useState<'description' | 'portfolio'>('description');
  const [candidatePhase, setCandidatePhase] = useState<'form' | 'review'>('form');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>();
  const [publishedInSession, setPublishedInSession] = useState(false);
  const [derivedPersonaId, setDerivedPersonaId] = useState<string>();
  const [error, setError] = useState('');
  const selectedProfile = getPersona(selectedId) ?? personaProfiles[0]!;
  const setSessionDefault = (personaId: string) => {
    setSessionDefaultId(personaId);
    notify(t(locale, '已设为本次会话默认，不会写入磁盘。', 'Set as this session default; nothing was written to disk.'));
  };
  const requestCandidates = () => {
    if (source === 'portfolio' && !rightsConfirmed) {
      setError(t(locale, '请先确认拥有分析这些来源的权利。', 'Confirm rights before analysing these sources.'));
      return;
    }
    setError('');
    setCandidatePhase('review');
  };
  const publishPreview = () => {
    if (!selectedCandidateId) {
      setError(t(locale, '请先选用一个候选。', 'Select a candidate first.'));
      return;
    }
    setError('');
    setPublishedInSession(true);
    notify(t(locale, '已在本次示例会话中发布，不会写入磁盘。', 'Published in this example session only; nothing was written to disk.'));
  };
  return screen === 'library' ? (
    <section className="page-content library-page">
      <PageHeader title={t(locale, '设计师', 'Designers')} eyebrow={t(locale, '创意档案', 'Creative profiles')} description={t(locale, '管理示例中的创作身份、规则与版本。', 'Manage example creative identities, rules, and versions.')}><Button type="button" variant="primary" icon="plus" onClick={() => { setDerivedPersonaId(undefined); setCandidatePhase('form'); setScreen('create'); }}>{t(locale, '创建', 'Create')}</Button></PageHeader>
      <div className="persona-repository-shell"><PersonaRepository locale={locale} profiles={personaProfiles} selectedId={selectedProfile.id} sessionDefaultId={sessionDefaultId} onSelect={setSelectedId} /><PersonaInspector locale={locale} profile={selectedProfile} isSessionDefault={selectedProfile.id === sessionDefaultId} onSetDefault={setSessionDefault} onDeriveDraft={(personaId) => { setDerivedPersonaId(personaId); setCandidatePhase('form'); setScreen('create'); }} onUseForNewDesign={onUseForNewDesign} /></div>
    </section>
  ) : (
    <section className="page-content designer-creation" aria-labelledby="create-designer-title"><header><Button type="button" variant="ghost" icon="arrow-left" onClick={() => setScreen('library')}>{t(locale, '返回', 'Back')}</Button><h1 id="create-designer-title">{t(locale, '创建设计师', 'Create designer')}</h1></header><div role="group" aria-label={t(locale, '来源方式', 'Source mode')}><button type="button" aria-pressed={source === 'description'} onClick={() => setSource('description')}>{t(locale, '描述', 'Description')}</button><button type="button" aria-pressed={source === 'portfolio'} onClick={() => setSource('portfolio')}>{t(locale, '作品集', 'Portfolio')}</button></div>{candidatePhase === 'form' ? <DesignerSourceForm key={derivedPersonaId ?? 'new'} locale={locale} source={source} initialDescription={derivedPersonaId ? localize(locale, getPersona(derivedPersonaId)!.summary) : ''} rightsConfirmed={rightsConfirmed} error={error} onRightsConfirmed={setRightsConfirmed} onRequestCandidates={requestCandidates} /> : <CandidateReview locale={locale} selectedCandidateId={selectedCandidateId} publishedInSession={publishedInSession} error={error} onSelect={setSelectedCandidateId} onPublish={publishPreview} />}</section>
  );
};
```

```tsx
type DesignerSourceFormProps = {
  locale: Locale;
  source: 'description' | 'portfolio';
  initialDescription: string;
  rightsConfirmed: boolean;
  error: string;
  onRightsConfirmed: (value: boolean) => void;
  onRequestCandidates: () => void;
};

type CandidateReviewProps = {
  locale: Locale;
  selectedCandidateId?: string;
  publishedInSession: boolean;
  error: string;
  onSelect: (candidateId: string) => void;
  onPublish: () => void;
};

const DesignerSourceForm = ({ locale, source, initialDescription, rightsConfirmed, error, onRightsConfirmed, onRequestCandidates }: DesignerSourceFormProps) => {
  const [description, setDescription] = useState(initialDescription);
  const [sources, setSources] = useState('');
  return <form className="designer-source-form" onSubmit={(event) => { event.preventDefault(); onRequestCandidates(); }}><Field label={t(locale, '风格描述', 'Style description')}><textarea value={description} onChange={(event) => setDescription(event.target.value)} required={source === 'description'} rows={5} /></Field>{source === 'portfolio' && <><Field label={t(locale, '作品来源', 'Portfolio sources')}><textarea value={sources} onChange={(event) => setSources(event.target.value)} rows={4} /></Field><label className="check-row"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => onRightsConfirmed(event.target.checked)} />{t(locale, '我确认拥有分析这些来源的权利', 'I confirm I have rights to analyse these sources')}</label></>}{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" variant="ai" icon="sparkles">{t(locale, '生成', 'Generate')}</Button><p className="panel-note">{t(locale, '仅显示示例候选，不会发起模型任务。', 'Example candidates only; no model task is started.')}</p></form>;
};

const CandidateReview = ({ locale, selectedCandidateId, publishedInSession, error, onSelect, onPublish }: CandidateReviewProps) => (
  <section className="candidate-review" aria-labelledby="candidate-review-title"><p className="section-kicker">{t(locale, '示例候选', 'Example candidates')}</p><h2 id="candidate-review-title">{t(locale, '选择人物形象', 'Choose a persona')}</h2><div className="persona-candidate-grid" role="group" aria-label={t(locale, '人物候选', 'Persona candidates')}>{personaCandidates.map((candidate) => <PersonaCard key={candidate.id} personaId={candidate.personaId} label={t(locale, `候选 ${candidate.ordinal}`, `Candidate ${candidate.ordinal}`)} selected={selectedCandidateId === candidate.id} onSelect={() => onSelect(candidate.id)} />)}</div>{error && <p className="form-error" role="alert">{error}</p>}<Button type="button" variant="primary" icon="check" disabled={!selectedCandidateId || publishedInSession} onClick={onPublish}>{t(locale, '发布预览', 'Publish preview')}</Button>{publishedInSession && <p className="panel-note">{t(locale, '已在本次示例会话中发布，不会写入磁盘。', 'Published in this example session only; nothing was written to disk.')}</p>}</section>
);
```

Move only designer-specific state and components out of `LibraryPages`; leave assets, brands, connections, delivery, storage, and settings untouched. Delete the old `DesignerProfile`, `DesignerDraft`, `designers`, `DesignerDraftModal`, and `DesignersPage` declarations once the imports compile. Extend `LibraryPagesProps` with `onUseForNewDesign`, then render `<DesignerLibrary locale={locale} notify={notify} onUseForNewDesign={onUseForNewDesign} />` for the designers view.

In `Studio`, `openNewDesign(mode, personaId?)` must set the draft persona before moving to the existing `new-design` surface. Pass `(personaId) => openNewDesign('manual', personaId)` through `LibraryPages`. This activates only a new in-memory design draft and must preserve the selected profile/version disclosure. Update the Task 3 route implementation if necessary so the same `NewDesignDraft` field is used by project creation and the persona switcher.

Render description and portfolio as equal tabs. Portfolio mode accepts session-only illustrative source labels/links but performs no upload, network fetch, or analysis. Candidate generation must be labeled `示例候选` / `Example candidates`; it must not display fake progress percentages or claim that a model request was submitted. `PersonaCard` remains a native `<button type="button">` with `aria-pressed`, a visible check icon, and browser-native Enter/Space behavior. Publish is disabled until selection and uses `发布预览` / `Publish preview` with a visible session-only disclosure.

- [ ] **Step 7: Add repository, inspector, candidate, and responsive CSS.**

```css
.persona-repository-shell { display:grid; grid-template-columns:minmax(272px,0.38fr) minmax(0,1fr); min-height:620px; overflow:hidden; border:1px solid var(--border-subtle); border-radius:6px; }
.persona-repository { min-width:0; overflow:auto; border-right:1px solid var(--border-subtle); background:var(--surface-container-lowest); }
.persona-repository__row { display:grid; grid-template-columns:48px minmax(0,1fr); gap:12px; min-width:0; padding:12px; border-bottom:1px solid var(--border-subtle); text-align:left; }
.persona-repository__row[aria-pressed='true'] { border-left:3px solid var(--primary); background:var(--surface-container); }
.persona-repository__meta,.persona-repository__tags,.persona-repository__row strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.persona-inspector { min-width:0; overflow:auto; padding:20px; background:var(--surface-container-low); }
.persona-inspector__identity { display:grid; grid-template-columns:minmax(168px,0.42fr) minmax(0,1fr); gap:20px; }
.persona-inspector__detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
.persona-sheet-grid,.persona-candidate-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
.persona-repository__row:focus-visible,.persona-card:focus-visible { outline:2px solid var(--primary); outline-offset:-2px; }
@media (max-width:1279px) { .persona-repository-shell { grid-template-columns:minmax(0,1fr); } .persona-repository { max-height:290px; border-right:0; border-bottom:1px solid var(--border-subtle); } }
@media (max-width:720px) { .persona-inspector__identity,.persona-inspector__detail-grid { grid-template-columns:minmax(0,1fr); } .persona-sheet-grid,.persona-candidate-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
```

Use no border radius above the project's existing 6px surface norm. Each dense section has a heading, visible text status, and a stable grid or `aspect-ratio`; no button/tag may wrap. Existing `prefers-reduced-motion` and reduced-transparency rules apply to the new surfaces without introducing continuous motion.

- [ ] **Step 8: Run the designer tests and retained library coverage.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/personas.test.ts src/app/studio/PersonaRepository.test.tsx src/app/studio/PersonaInspector.test.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/LibraryPages.test.tsx`

Expected: structured profile data, selected-row/inspector synchronization, session-default disclosure, description/portfolio rights gate, exactly three candidates, preview-publish disclosure, asset library, delivery, settings, and existing navigation tests pass.

- [ ] **Step 9: Commit the P10/P11 slice.**

```bash
git add src/app/studio/personas.ts src/app/studio/personas.test.ts src/app/studio/PersonaRepository.tsx src/app/studio/PersonaRepository.test.tsx src/app/studio/PersonaInspector.tsx src/app/studio/PersonaInspector.test.tsx src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/LibraryPages.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/Studio.tsx src/app/studio/PersonaCard.tsx src/app/studio/persona.css tests/e2e/studio.spec.ts
git commit -m "feat(ui): add designer persona repository"
```

### Task 5: Cross-Page Browser Coverage, Regression Gate, and Evidence

**Files:**
- Modify: `tests/e2e/studio.spec.ts`
- Modify: `docs/verification/UI-FRAMEWORK.md`

- [ ] **Step 1: Add browser assertions before final CSS adjustments.**

```ts
test('persona-led creation remains usable in both desktop widths', async ({ page }, testInfo) => {
  await page.goto('/?preview=1');
  await page.getByRole('button', { name: '新建项目', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: '新建设计', exact: true })).toBeVisible();
  await expect(page.getByLabel('新建设计的当前设计师')).toContainText('纸感排版');
  await expect(page.getByRole('img', { name: '纸感排版的人物形象' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('new-design-persona.png'), fullPage: true });
});

test('designer candidate selection is keyboard reachable and honest about example output', async ({ page }) => {
  await page.goto('/?preview=1');
  await page.getByRole('button', { name: '设计师', exact: true }).click();
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await page.getByRole('textbox', { name: '风格描述', exact: true }).fill('纸张和克制排版');
  await page.getByRole('button', { name: '生成', exact: true }).click();
  const candidates = page.getByRole('button', { name: /候选/ });
  await expect(candidates).toHaveCount(3);
  await candidates.nth(0).focus();
  await page.keyboard.press('Enter');
  await expect(candidates.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('示例候选', { exact: true })).toBeVisible();
});

test('persona repository keeps the selected archive row and inspector synchronized without fabricated runtime data', async ({ page }) => {
  await page.goto('/?preview=1');
  await page.getByRole('button', { name: '设计师', exact: true }).click();
  await page.getByRole('button', { name: /清晰商业/ }).click();
  await expect(page.getByLabel('设计师详情')).toContainText('清晰商业');
  await expect(page.getByLabel('风格 DNA')).toBeVisible();
  await expect(page.getByLabel('禁用规则')).toBeVisible();
  await expect(page.getByLabel('精选作品')).toBeVisible();
  await expect(page.getByText(/GPU|云端任务|完成率/)).toHaveCount(0);
  await page.getByRole('button', { name: '设默认', exact: true }).click();
  await expect(page.getByText('已设为本次会话默认，不会写入磁盘。')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
```

- [ ] **Step 2: Run the added browser tests and observe Red.**

Run: `pnpm test:e2e -- tests/e2e/studio.spec.ts`

Expected: FAIL until the final selectors, responsive CSS, and localized labels exist. A missing local Chrome binary is an environment blocker, not behavioral Red; record it without claiming browser coverage.

- [ ] **Step 3: Complete final responsive, locale, motion, and transparency adjustments.**

Verify every new flex/grid child that can shrink has `min-width: 0`; every name/tag/action has `white-space: nowrap` where required; and all portrait/hero containers preserve a stable `aspect-ratio`. Do not alter `window-bar`, `studio-toolbar`, or `studio-sidebar` dimensions. Add the persona selectors to the existing reduced-transparency CSS only if they currently use an alpha surface; do not add continuous motion.

- [ ] **Step 4: Run full automated verification.**

Run:

```bash
pnpm test:unit
pnpm test:integration
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e -- tests/e2e/studio.spec.ts
git diff --check
```

Expected: each command exits 0. Record actual Vitest file/test counts, browser test counts, browser/OS, and screenshots produced. Do not substitute browser screenshots for native Electron material, window-management, IME, or packaging evidence.

- [ ] **Step 5: Update verification evidence with exact results and impacted scope.**

Append a dated `Designer persona UI round` section to `docs/verification/UI-FRAMEWORK.md` listing: changed P02/P03/P04/P05/P10/P11 surfaces; session-only and no-model boundaries; each command above with actual exit code and count; 1280/1024, zh/en, dark/light browser coverage; exact portrait asset source; and retained M01 native limitations. Do not amend M02 records because no M02 source file changes.

- [ ] **Step 6: Commit verification evidence.**

```bash
git add tests/e2e/studio.spec.ts docs/verification/UI-FRAMEWORK.md src/app/studio/persona.css
git commit -m "test(ui): verify designer persona flows"
```

## Final Review Checklist

- [ ] P02/P05 keep design images primary while designer contribution is visible and versioned.
- [ ] P03/P04 uses the selected persona as the character hero without making model connection mandatory.
- [ ] P10/P12 uses a filterable Persona Repository and a synchronized inspector with creative code, Style DNA, negative rules, curated bundled sheets, session-only default/derive/new-design actions, and no fabricated runtime data.
- [ ] P11 supports description/portfolio entry modes, exactly three candidates, accessible selection, and explicit session-only preview publish.
- [ ] No new package, provider, storage, workspace, native-window, or real network/image-generation claim is introduced.
- [ ] New artwork is bundled example artwork with meaningful alt text; no individual is represented as a real employee or legal author.
- [ ] All project-authored functions are arrows; no button labels wrap or exceed the Chinese action-length boundary.
- [ ] Existing M01/M02/UI tests and affected browser paths have fresh command evidence.
