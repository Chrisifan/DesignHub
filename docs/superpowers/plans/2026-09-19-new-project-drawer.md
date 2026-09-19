# New Project Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full-page new-project flow and duplicate project-page callout with one toolbar-triggered right drawer containing only the project form.

**Architecture:** Convert `NewDesignPage` into a focused `NewProjectForm` that owns no navigation or footer actions. `Studio` keeps the draft and creation logic, controls one shared `Drawer`, and submits the form from the drawer footer using the form attribute; the existing drawer provides dismissal, focus trapping, and trigger-focus restoration.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Make drawer initial focus explicit

**Files:**
- Modify: `src/app/studio/Drawer.test.tsx`
- Modify: `src/app/studio/Drawer.tsx`

- [ ] **Step 1: Write the failing focus test**

Add to `src/app/studio/Drawer.test.tsx`:

```tsx
it('focuses the requested field when the drawer opens', () => {
  render(
    <Drawer
      open
      title="新建项目"
      initialFocusSelector="[data-drawer-initial-focus]"
      onClose={() => undefined}
    >
      <input aria-label="项目名称" data-drawer-initial-focus />
    </Drawer>,
  );

  expect(screen.getByRole('textbox', { name: '项目名称' })).toHaveFocus();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run src/app/studio/Drawer.test.tsx
```

Expected: FAIL because `DrawerProps` has no `initialFocusSelector` and the drawer currently focuses its first enabled button.

- [ ] **Step 3: Add the initial-focus selector to Drawer**

In `src/app/studio/Drawer.tsx`, add the prop:

```ts
initialFocusSelector?: string;
```

Read it in the component and replace the opening focus line with:

```ts
const initialFocus = initialFocusSelector
  ? panelRef.current?.querySelector<HTMLElement>(initialFocusSelector)
  : null;
(initialFocus ?? panelRef.current?.querySelector<HTMLElement>('button:not(:disabled)'))
  ?.focus({ preventScroll: true });
```

Add `initialFocusSelector` to the opening-effect dependency list.

- [ ] **Step 4: Run Drawer tests**

Run:

```bash
pnpm exec vitest run src/app/studio/Drawer.test.tsx
```

Expected: PASS, including existing close, focus trap, footer, portal, and focus restoration behavior.

- [ ] **Step 5: Commit the reusable drawer behavior**

```bash
git add src/app/studio/Drawer.tsx src/app/studio/Drawer.test.tsx
git commit -m "feat: support explicit drawer initial focus"
```

### Task 2: Replace the full-page component with a focused form

**Files:**
- Modify: `src/app/studio/NewDesignPage.test.tsx`
- Modify: `src/app/studio/NewDesignPage.tsx`
- Modify: `src/app/studio/persona.css`

- [ ] **Step 1: Change component tests to describe the drawer form**

Update the test harness to render `NewProjectForm` with `formId="new-project-form"`. Replace the complete-dossier assertions with:

Add `type FormEvent` to the existing React import used by the test file:

```ts
import { useState, type FormEvent } from 'react';
```

```tsx
it('renders only the project fields required by the drawer', () => {
  render(<NewProjectHarness />);

  expect(screen.getByRole('form', { name: '新建项目表单' })).toHaveAttribute('id', 'new-project-form');
  expect(screen.getByRole('textbox', { name: '项目名称' })).toHaveAttribute('data-drawer-initial-focus');
  expect(screen.getByRole('textbox', { name: '设计目标' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: '选择设计师' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: '文档尺寸' })).toBeInTheDocument();
  expect(screen.queryByLabelText('新建设计的当前设计师')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /设计师档案/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /创建项目|创建预览/ })).not.toBeInTheDocument();
});
```

Keep and adapt the existing tests for changing the creative brief, selecting a persisted designer, and choosing no designer. Add a submit test:

```tsx
it('submits through the form id used by the drawer footer', () => {
  const onCreate = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
  render(<NewProjectForm locale="zh-CN" formId="new-project-form" draft={{ ...initialDraft, name: '新项目' }} profiles={personaProfiles} onDraftChange={vi.fn()} onCreate={onCreate} persisted />);

  fireEvent.submit(screen.getByRole('form', { name: '新建项目表单' }));
  expect(onCreate).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the form tests and verify they fail**

Run:

```bash
pnpm exec vitest run src/app/studio/NewDesignPage.test.tsx
```

Expected: FAIL because `NewProjectForm` does not exist and the current component still renders a full page, dossier, and internal submit action.

- [ ] **Step 3: Implement `NewProjectForm`**

In `src/app/studio/NewDesignPage.tsx`:

- Remove `useEffect`, `useRef`, `DesignerDossier`, `Button`, and the `onBack` prop.
- Export `NewProjectForm` with props `locale`, `formId`, `draft`, `onDraftChange`, `onCreate`, `persisted`, and `profiles`.
- Render only this structure:

```tsx
<form
  id={formId}
  className="new-project-form"
  aria-label={t(locale, '新建项目表单', 'New project form')}
  onSubmit={onCreate}
>
  <Field label={t(locale, '项目名称', 'Project name')}>
    <input
      data-drawer-initial-focus
      required
      maxLength={120}
      value={draft.name}
      onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
    />
  </Field>
  {/* Existing creative brief, designer selector, size selector, and preview notice. */}
</form>
```

Do not render a page header, designer dossier, cancel button, or submit button.

- [ ] **Step 4: Replace full-page CSS with drawer-form CSS**

In `src/app/studio/persona.css`, remove `.new-design-heading`, `.new-design-layout`, `.new-design-form`, `.new-design-dossier`, and their responsive overrides. Add:

```css
.new-project-form {
  min-width: 0;
  padding: 20px;
}

.new-project-form > .inline-notice:last-child {
  margin-bottom: 0;
}
```

Keep `.persona-selector` and its narrow-screen behavior because the drawer still uses it.

- [ ] **Step 5: Run the form tests**

Run:

```bash
pnpm exec vitest run src/app/studio/NewDesignPage.test.tsx
```

Expected: PASS with no dossier or embedded creation action.

- [ ] **Step 6: Commit the focused form**

```bash
git add src/app/studio/NewDesignPage.tsx src/app/studio/NewDesignPage.test.tsx src/app/studio/persona.css
git commit -m "refactor: make new project a focused drawer form"
```

### Task 3: Integrate the form into the project drawer and remove duplication

**Files:**
- Modify: `src/app/Studio.test.tsx`
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/studio/types.ts`
- Modify: `src/app/styles/studio.css`

- [ ] **Step 1: Write the failing Studio interaction test**

Add or update tests in `src/app/Studio.test.tsx` to establish the new behavior:

```tsx
it('opens one new-project drawer without the duplicate creation callout', () => {
  enter();

  expect(screen.getAllByRole('button', { name: '新建项目' })).toHaveLength(1);
  expect(screen.queryByText('下一次创作，从这里开始')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '开始创作' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));

  const drawer = screen.getByRole('dialog', { name: '新建项目' });
  expect(screen.getByRole('button', { name: '春间市集' })).toBeInTheDocument();
  expect(within(drawer).getByRole('textbox', { name: '项目名称' })).toHaveFocus();
  expect(within(drawer).getByRole('button', { name: '取消' }).closest('.ui-drawer__footer')).toBeInTheDocument();
  expect(within(drawer).getByRole('button', { name: '创建预览' }).closest('.ui-drawer__footer')).toBeInTheDocument();
  expect(within(drawer).queryByLabelText('新建设计的当前设计师')).not.toBeInTheDocument();
});
```

Update the draft-retention test to close the drawer with “取消”, reopen it, and assert the project name remains. Keep persisted creation, preview creation, size selection, and no-designer coverage.

- [ ] **Step 2: Run Studio tests and verify they fail**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx
```

Expected: FAIL because the current button navigates to a full-page surface and the project callout still exists.

- [ ] **Step 3: Add the drawer state and shared form**

In `src/app/studio/Studio.tsx`:

- Import `Drawer` and `NewProjectForm`.
- Replace `newDesignReturnFocus` with `const [newProjectDrawerOpen, setNewProjectDrawerOpen] = useState(false)`.
- Keep `openNewDesign(personaId?)` as the shared entry point, but make it update the optional persona and set the drawer open without changing the current page.
- Remove `backFromNewDesign`, the `surface === 'new-design'` breadcrumb branch, toolbar back button, and full-page component branch.
- After successful persisted or preview creation, call `setNewProjectDrawerOpen(false)` before navigating to project details. On validation, persistence, or read-only failure, keep the drawer open.
- Render the drawer near the existing modal layer:

```tsx
<Drawer
  open={newProjectDrawerOpen}
  title={t(locale, '新建项目', 'New project')}
  locale={locale}
  initialFocusSelector="[data-drawer-initial-focus]"
  onClose={() => setNewProjectDrawerOpen(false)}
  footer={(
    <div className="dialog-actions">
      <Button onClick={() => setNewProjectDrawerOpen(false)}>{t(locale, '取消', 'Cancel')}</Button>
      <Button
        type="submit"
        form="new-project-form"
        variant="primary"
        icon="plus"
        disabled={!draft.name.trim()}
      >
        {workspace?.openMode === 'writable' ? t(locale, '创建项目', 'Create project') : t(locale, '创建预览', 'Create preview')}
      </Button>
    </div>
  )}
>
  <NewProjectForm
    locale={locale}
    formId="new-project-form"
    draft={draft}
    onDraftChange={setDraft}
    onCreate={createProject}
    profiles={designerOptions}
    persisted={workspace?.openMode === 'writable'}
  />
</Drawer>
```

- [ ] **Step 4: Remove duplicate markup, surface type, and styles**

- Delete the `.creation-note` block from the project list.
- Delete `.creation-note`, `.creation-note-symbol`, and child rules from `src/app/styles/studio.css`.
- Remove `new-design` from `StudioSurface` in `src/app/studio/types.ts`, leaving `export type StudioSurface = View;` so existing destination switching stays type-safe.
- Remove obsolete `.new-design-heading` rules from `src/app/styles/studio.css`.

- [ ] **Step 5: Run Studio, form, and drawer tests**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/NewDesignPage.test.tsx src/app/studio/Drawer.test.tsx
```

Expected: PASS. The new-project drawer is the only creation flow, the project list remains mounted behind it, and the existing create APIs receive unchanged payloads.

- [ ] **Step 6: Commit the integrated drawer flow**

```bash
git add src/app/Studio.test.tsx src/app/studio/Studio.tsx src/app/studio/types.ts src/app/styles/studio.css
git commit -m "feat: open new projects in a drawer"
```

### Task 4: Verify the complete workflow

**Files:**
- Verify only

- [ ] **Step 1: Run affected tests**

```bash
pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/NewDesignPage.test.tsx src/app/studio/Drawer.test.tsx tests/integration/layout-contract.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run static validation and build**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit with status 0; existing Vite chunk-size and Sharp externalization warnings may remain.

- [ ] **Step 3: Inspect the final workspace**

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; unrelated pre-existing changes remain untouched.
