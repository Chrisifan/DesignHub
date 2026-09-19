# Project Card Description Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a two-line description area in every project card and truncate longer descriptions after two lines.

**Architecture:** Keep the existing always-rendered paragraph in `Studio.tsx`, give it a dedicated class, and make that class own its spacing and two-line clamp in `studio.css`. Add a focused component regression test that covers both empty and long descriptions without changing project data or card structure.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Stabilize the project-card description region

**Files:**
- Modify: `src/app/Studio.test.tsx`
- Modify: `src/app/studio/Studio.tsx:904-918`
- Modify: `src/app/styles/studio.css:667-675`

- [ ] **Step 1: Write the failing component test**

Add this test to `src/app/Studio.test.tsx` after the existing project-cover test:

```tsx
it('keeps a two-line description region for empty and long project briefs', () => {
  const [baseProject] = exampleProjects;
  const longDescription = '这是一段足够长的项目简介，用于验证项目卡片在内容超出两行之后仍然保持固定的信息区高度并显示省略号。';
  render(
    <Studio
      locale="zh-CN"
      theme="system"
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      onExit={() => undefined}
      initialProjects={[
        { ...baseProject, id: 'empty-brief', name: '空简介项目', enName: 'Empty brief', description: '', enDescription: '' },
        { ...baseProject, id: 'long-brief', name: '长简介项目', enName: 'Long brief', description: longDescription, enDescription: longDescription },
      ]}
      initialDesignerOptions={personaProfiles}
    />,
  );

  const emptyDescription = within(screen.getByRole('button', { name: '空简介项目' })).getByTestId('project-description');
  const longDescriptionElement = within(screen.getByRole('button', { name: '长简介项目' })).getByTestId('project-description');

  expect(emptyDescription).toBeEmptyDOMElement();
  expect(emptyDescription).toHaveClass('project-card-description');
  expect(longDescriptionElement).toHaveTextContent(longDescription);
  expect(longDescriptionElement).toHaveClass('project-card-description');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx -t "keeps a two-line description region"
```

Expected: FAIL because the description paragraph does not yet expose `data-testid="project-description"` or the `project-card-description` class.

- [ ] **Step 3: Add the dedicated description hook**

Replace the project-card paragraph in `src/app/studio/Studio.tsx` with:

```tsx
<p className="project-card-description" data-testid="project-description">
  {t(
    locale,
    project.description,
    project.enDescription,
  )}
</p>
```

- [ ] **Step 4: Implement the two-line reserved layout**

Replace `.project-card-body > p` in `src/app/styles/studio.css` with:

```css
.project-card-description {
  display: -webkit-box;
  min-height: 32px;
  margin: 6px 0 16px;
  overflow: hidden;
  color: var(--on-surface-variant);
  font-size: 11px;
  line-height: 16px;
  white-space: normal;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
```

The `min-height` reserves exactly two 16px lines for empty descriptions. The line clamp truncates long text without introducing a visible placeholder.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx -t "keeps a two-line description region"
```

Expected: PASS.

- [ ] **Step 6: Run regression and static verification**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit with status 0. The build may retain its existing chunk-size warning, but must not fail.

- [ ] **Step 7: Review the diff without staging unrelated work**

Run:

```bash
git diff -- src/app/Studio.test.tsx src/app/studio/Studio.tsx src/app/styles/studio.css
```

Confirm the new changes are limited to the focused regression test, paragraph hook, and two-line CSS rule. Do not reset or stage unrelated pre-existing edits in these shared files.
