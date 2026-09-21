# Conversation-First Studio Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent studio sidebar with a seamless conversation-first home that browses projects, optionally selects a designer, creates a localized untitled project from the first prompt, and hands that prompt to the existing workbench analysis flow.

**Architecture:** Keep `Studio.tsx` as the application orchestrator while moving the home, project rail, composer, designer rail, and avatar menu into focused components. Project creation continues through `createProjectContainer`; a one-shot `PendingHomeConversation` is passed to `Workbench`, which consumes it through the same conversation submission function used by the command dock.

**Tech Stack:** React 19, TypeScript, CSS custom properties, Electron renderer bridge, Testing Library, Vitest.

---

## File map

**Create**

- `src/app/studio/auto-project-name.ts`: pure localized unique-name generator.
- `src/app/studio/auto-project-name.test.ts`: name and collision tests.
- `src/app/studio/HomeProjectPanel.tsx`: home project filters, search, list, and empty states.
- `src/app/studio/HomeProjectPanel.test.tsx`: project panel behavior.
- `src/app/studio/HomeDesignerRail.tsx`: horizontal selectable designer list.
- `src/app/studio/HomeDesignerRail.test.tsx`: selection and navigation behavior.
- `src/app/studio/HomeConversationComposer.tsx`: first-prompt text, image attachments, connection state, and submit lifecycle.
- `src/app/studio/HomeConversationComposer.test.tsx`: composer validation, busy state, attachments, and retention.
- `src/app/studio/StudioHome.tsx`: composes the two-column home and coordinates selected designer with composer submission.
- `src/app/studio/StudioHome.test.tsx`: home-level designer-to-request behavior.
- `src/app/studio/StudioUserMenu.tsx`: grouped avatar menu.
- `src/app/studio/StudioUserMenu.test.tsx`: menu navigation and dismissal.
- `src/app/studio/studio-home.css`: seamless home, glass surfaces, project rail, composer, and designer rail.

**Modify**

- `src/app/studio/types.ts`: add project `updatedAt` and one-shot home conversation types.
- `src/app/shell/WindowBar.tsx`: add avatar-menu slot without breaking native drag regions.
- `src/app/shell/WindowBar.test.tsx`: retain workspace/theme/language controls and verify the avatar slot.
- `src/app/styles/window.css`: remove the top divider and make the bar visually continuous.
- `src/app/studio/Workbench.tsx`: consume a one-shot initial conversation through the existing submission path.
- `src/app/studio/Workbench.test.tsx`: prove initial prompt submission occurs once and failure restores the dock draft.
- `src/app/studio/Studio.tsx`: replace sidebar/home grid, orchestrate automatic project creation, and mount the avatar menu.
- `src/app/Studio.test.tsx`: update navigation expectations and cover the automatic creation flow.
- `src/app/styles/studio.css`: remove permanent sidebar/status layout, keep contextual page toolbar unframed, and host full-width pages.
- `tests/integration/layout-contract.test.ts`: protect the 30/70 home contract and absence of full-width divider lines.

The user explicitly requested development on `main`, and the shared files already contain unrelated working-tree changes. Do not create a mixed implementation commit. Leave implementation changes uncommitted unless the user later requests a commit and the relevant hunks can be isolated safely.

### Task 1: Localized automatic project names

**Files:**
- Create: `src/app/studio/auto-project-name.ts`
- Create: `src/app/studio/auto-project-name.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, it } from 'vitest';

import { createAutomaticProjectName } from './auto-project-name';

it('uses the current locale for the base automatic project name', () => {
  expect(createAutomaticProjectName('zh-CN', [])).toBe('未命名项目');
  expect(createAutomaticProjectName('en', [])).toBe('Untitled project');
});

it('uses the first available numeric suffix without renaming existing projects', () => {
  expect(createAutomaticProjectName('zh-CN', [
    '未命名项目',
    '未命名项目 (2)',
    '其他项目',
  ])).toBe('未命名项目 (1)');
  expect(createAutomaticProjectName('en', [
    'Untitled project',
    'Untitled project (1)',
  ])).toBe('Untitled project (2)');
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm exec vitest run src/app/studio/auto-project-name.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add the minimal pure implementation**

```ts
import type { Locale } from '../i18n';

export const createAutomaticProjectName = (
  locale: Locale,
  existingNames: readonly string[],
): string => {
  const base = locale === 'zh-CN' ? '未命名项目' : 'Untitled project';
  const names = new Set(existingNames.map((name) => name.trim()));
  if (!names.has(base)) return base;
  for (let suffix = 1; ; suffix += 1) {
    const candidate = `${base} (${suffix})`;
    if (!names.has(candidate)) return candidate;
  }
};
```

- [ ] **Step 4: Run GREEN**

Run the same Vitest command. Expected: 2 tests pass.

### Task 2: One-shot home conversation types

**Files:**
- Modify: `src/app/studio/types.ts`

- [ ] **Step 1: Add the shared types used by `StudioHome`, `Studio`, and `Workbench`**

```ts
import type { ConversationImageAttachment } from '../../features/agent/task-service';

export type HomeConversationRequest = {
  message: string;
  attachments: ConversationImageAttachment[];
  designerId?: string;
};

export type PendingHomeConversation = {
  id: string;
  projectId: string;
  documentId: string;
  message: string;
  attachments: ConversationImageAttachment[];
};
```

Extend `Project` without making old fixtures invalid:

```ts
updatedAt?: string;
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS because the new fields are optional and not consumed yet.

### Task 3: Avatar menu and seamless window controls

**Files:**
- Create: `src/app/studio/StudioUserMenu.tsx`
- Create: `src/app/studio/StudioUserMenu.test.tsx`
- Modify: `src/app/shell/WindowBar.tsx`
- Modify: `src/app/shell/WindowBar.test.tsx`
- Modify: `src/app/styles/window.css`

- [ ] **Step 1: Write menu behavior tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { StudioUserMenu } from './StudioUserMenu';

it('navigates from grouped menu items and closes after selection', () => {
  const onNavigate = vi.fn();
  render(<StudioUserMenu locale="zh-CN" operatorName="本机操作者" currentView="projects" onNavigate={onNavigate} onNewProject={vi.fn()} onImportProject={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '设计师' }));

  expect(onNavigate).toHaveBeenCalledWith('designers');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('closes on Escape and exposes manual project actions', () => {
  render(<StudioUserMenu locale="zh-CN" operatorName="" currentView="projects" onNavigate={vi.fn()} onNewProject={vi.fn()} onImportProject={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.getByRole('menuitem', { name: '新建空白项目' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run src/app/studio/StudioUserMenu.test.tsx
```

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the controlled menu surface**

Use a root ref and document `pointerdown`/`keydown` listeners. Render one trigger button and, while open, this semantic structure:

```tsx
<div className="studio-user-menu" ref={rootRef}>
  <button type="button" className="studio-user-menu__trigger" aria-label={t(locale, '打开用户菜单', 'Open user menu')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
    <span className="operator-avatar">{(operatorName.trim() || 'S').slice(0, 1).toUpperCase()}</span>
  </button>
  {open && (
    <div className="studio-user-menu__popover" role="menu">
      <MenuGroup label={t(locale, '创作', 'Create')} items={[
        ['projects', 'home', t(locale, '首页', 'Home')],
        ['designers', 'users', t(locale, '设计师', 'Designers')],
        ['assets', 'image', t(locale, '素材库', 'Assets')],
        ['brands', 'palette', t(locale, '品牌包', 'Brand kits')],
      ]} />
      <MenuGroup label={t(locale, '模型', 'Models')} items={[
        ['connections', 'plug', t(locale, '模型连接', 'Connections')],
        ['tasks', 'clock', t(locale, '模型任务', 'Model tasks')],
      ]} />
      <MenuGroup label={t(locale, '管理', 'Manage')} items={[
        ['delivery', 'download', t(locale, '导出交付', 'Delivery')],
        ['storage', 'hard-drive', t(locale, '工作区管理', 'Workspace')],
        ['settings', 'settings', t(locale, '设置', 'Settings')],
      ]} />
      <button type="button" role="menuitem" onClick={chooseNewProject}><Icon name="plus" />{t(locale, '新建空白项目', 'New blank project')}</button>
      <button type="button" role="menuitem" onClick={chooseImport}><Icon name="upload" />{t(locale, '导入项目包', 'Import project package')}</button>
    </div>
  )}
</div>
```

Define `MenuGroup` in the same file. It must call `onNavigate(view)` and close the menu; apply `aria-current="page"` to `currentView`.

- [ ] **Step 4: Add a `userMenu?: ReactNode` slot to `WindowBar`**

Import `ReactNode`, add `userMenu?: ReactNode` and `onBrandClick?: () => void`, and render the menu after the locale switch inside `.window-bar-actions`:

```tsx
{userMenu}
```

When `onBrandClick` exists, render `.window-brand` as a button with the localized `Home` label; otherwise retain the existing non-interactive wrapper. Update `WindowBar.test.tsx` with a small labelled button passed as `userMenu`, click the brand button, and assert that workspace, theme, locale, brand callback, and the slot are all present.

- [ ] **Step 5: Remove the visual divider but retain native window behavior**

In `window.css`:

```css
.window-bar {
  border-bottom: 0;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.window-bar-separator {
  display: none;
}
```

Do not remove `.window-control-safe-area` or `-webkit-app-region` declarations.

- [ ] **Step 6: Run GREEN**

```bash
pnpm exec vitest run src/app/studio/StudioUserMenu.test.tsx src/app/shell/WindowBar.test.tsx
```

Expected: all menu and native-window tests pass.

### Task 4: Compact home project panel

**Files:**
- Create: `src/app/studio/HomeProjectPanel.tsx`
- Create: `src/app/studio/HomeProjectPanel.test.tsx`

- [ ] **Step 1: Write the failing project panel test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { HomeProjectPanel } from './HomeProjectPanel';
import type { Project } from './types';

it('keeps existing project categories and opens a compact project row', () => {
  const onFilterChange = vi.fn();
  const onOpenProject = vi.fn();
  const projects: Project[] = [{
    id: 'p1', name: '春间市集', enName: 'Spring Market', description: '', enDescription: '', designers: [], artwork: 'blank', documents: 3, updatedAt: '2026-09-20T00:00:00.000Z',
  }];
  render(<HomeProjectPanel locale="zh-CN" allProjects={projects} projects={projects} filter="active" query="" loadFailed={false} onFilterChange={onFilterChange} onQueryChange={vi.fn()} onOpenProject={onOpenProject} onRetry={vi.fn()} />);

  expect(screen.getByRole('group', { name: '项目状态' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '全部项目' }));
  expect(onFilterChange).toHaveBeenCalledWith('all');
  fireEvent.click(screen.getByRole('button', { name: '春间市集' }));
  expect(onOpenProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run src/app/studio/HomeProjectPanel.test.tsx
```

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement `HomeProjectPanel`**

Use this public API:

```ts
type HomeProjectPanelProps = {
  locale: Locale;
  allProjects: Project[];
  projects: Project[];
  filter: 'active' | 'archived' | 'all';
  query: string;
  loadFailed: boolean;
  onFilterChange: (value: 'active' | 'archived' | 'all') => void;
  onQueryChange: (value: string) => void;
  onOpenProject: (project: Project) => void;
  onRetry: () => void;
};
```

Render a labelled `aside`, segmented filter buttons, search input, and `.studio-home-projects__list`. Each row must reuse `ProjectCoverImage`, show `project.name` or `project.enName`, `${project.documents} 份设计稿`, and a localized date when `updatedAt` exists. Use the existing empty/error copy and retry behavior.

- [ ] **Step 4: Run GREEN**

Run the same Vitest command. Expected: PASS.

### Task 5: Selectable designer rail

**Files:**
- Create: `src/app/studio/HomeDesignerRail.tsx`
- Create: `src/app/studio/HomeDesignerRail.test.tsx`

- [ ] **Step 1: Write failing selection tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { personaProfiles } from '../../../tests/fixtures/personas';
import { HomeDesignerRail } from './HomeDesignerRail';

it('defaults to no designer and toggles one available designer', () => {
  const onChange = vi.fn();
  render(<HomeDesignerRail locale="zh-CN" profiles={personaProfiles} selectedId="" onChange={onChange} onViewAll={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /选择设计师：纸感排版/ }));
  expect(onChange).toHaveBeenCalledWith('paper-type');
});

it('cancels the selected designer and hides archived profiles', () => {
  const onChange = vi.fn();
  render(<HomeDesignerRail locale="zh-CN" profiles={[...personaProfiles, { ...personaProfiles[0]!, id: 'archived', status: 'archived' as const, name: { zh: '已归档', en: 'Archived' } }]} selectedId="paper-type" onChange={onChange} onViewAll={vi.fn()} />);
  expect(screen.queryByText('已归档')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /取消设计师：纸感排版/ }));
  expect(onChange).toHaveBeenCalledWith('');
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run src/app/studio/HomeDesignerRail.test.tsx
```

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the horizontal rail**

Filter `profile.status !== 'archived'`, render `PersonaArtwork`, localized name/signature, `aria-pressed`, a visible check icon for selection, and a “查看全部” button. Add an `onWheel` handler that maps vertical wheel delta to `scrollLeft` only when horizontal overflow exists.

- [ ] **Step 4: Run GREEN**

Run the same Vitest command. Expected: PASS.

### Task 6: First-prompt composer with attachments and retention

**Files:**
- Create: `src/app/studio/HomeConversationComposer.tsx`
- Create: `src/app/studio/HomeConversationComposer.test.tsx`

- [ ] **Step 1: Write the failing submit lifecycle tests**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { HomeConversationComposer } from './HomeConversationComposer';

it('submits trimmed text once and clears only after success', async () => {
  const onSubmit = vi.fn(async () => true);
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected onSubmit={onSubmit} notify={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '  设计一张海报  ' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ message: '设计一张海报', attachments: [] }));
  expect(screen.getByRole('textbox', { name: '设计需求' })).toHaveValue('');
});

it('retains the draft when project creation fails', async () => {
  const onSubmit = vi.fn(async () => false);
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected onSubmit={onSubmit} notify={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '保留我' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', { name: '设计需求' })).toHaveValue('保留我');
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run src/app/studio/HomeConversationComposer.test.tsx
```

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the composer**

Use this API:

```ts
type HomeConversationComposerProps = {
  locale: Locale;
  readOnly: boolean;
  conversationConnected: boolean;
  onSubmit: (input: { message: string; attachments: ConversationImageAttachment[] }) => Promise<boolean>;
  notify: (message: string) => void;
};
```

Internally store `message`, `busy`, and attachments with an object URL. Reuse the workbench limits: image MIME only, at most 8 images, each no larger than 8 MiB. Convert accepted files to `Uint8Array`, revoke previews on removal/unmount, and submit only `{ name, mimeType, bytes }`.

Render three localized suggestion buttons below the composer. Clicking a suggestion populates the textarea but never submits automatically.

The submit branch must be explicit:

```ts
if (!message.trim()) {
  notify(t(locale, '请输入设计需求。', 'Describe the design you want.'));
  return;
}
if (readOnly) {
  notify(t(locale, '当前工作区为只读模式。', 'The current workspace is read-only.'));
  return;
}
if (!conversationConnected) {
  notify(t(locale, '请先连接对话模型。', 'Connect a conversation model first.'));
  return;
}
if (busy) return;
setBusy(true);
const succeeded = await onSubmit({ message: message.trim(), attachments: plainAttachments });
if (succeeded) clearDraftAndRevokePreviews();
setBusy(false);
```

Disable the submit control while busy, read-only, or text is blank. When disconnected, keep it enabled so clicking can show the explicit “connect a conversation model” notice without creating a project. Keep the add-image control available only when writable.

- [ ] **Step 4: Add attachment and duplicate-click tests**

```tsx
it('reads an image attachment, submits bytes, and revokes its preview after success', async () => {
  const onSubmit = vi.fn(async () => true);
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:home-image');
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const file = new File([new Uint8Array([1, 2, 3])], 'reference.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected onSubmit={onSubmit} notify={vi.fn()} />);

  fireEvent.change(screen.getByLabelText('添加图片'), { target: { files: [file] } });
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '参考图片设计' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
    message: '参考图片设计',
    attachments: [expect.objectContaining({ name: 'reference.png', mimeType: 'image/png', bytes: expect.any(Uint8Array) })],
  }));
  expect(createObjectURL).toHaveBeenCalledWith(file);
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:home-image');
});

it('ignores a second click while the first project creation is pending', async () => {
  let resolveSubmit!: (value: boolean) => void;
  const onSubmit = vi.fn(() => new Promise<boolean>((resolve) => { resolveSubmit = resolve; }));
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected onSubmit={onSubmit} notify={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '只创建一次' } });
  const send = screen.getByRole('button', { name: '发送并创建项目' });
  fireEvent.click(send);
  fireEvent.click(send);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  resolveSubmit(true);
  await waitFor(() => expect(send).not.toBeDisabled());
});
```

- [ ] **Step 5: Run GREEN**

Run the same Vitest command. Expected: all composer tests pass.

### Task 7: Compose the conversation-first home

**Files:**
- Create: `src/app/studio/StudioHome.tsx`
- Create: `src/app/studio/StudioHome.test.tsx`
- Create: `src/app/studio/studio-home.css`

- [ ] **Step 1: Write the failing home composition test**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { personaProfiles } from '../../../tests/fixtures/personas';
import { StudioHome } from './StudioHome';

it('adds the selected designer to the next home conversation only', async () => {
  const onSubmit = vi.fn(async () => true);
  render(<StudioHome locale="zh-CN" projects={[]} visibleProjects={[]} profiles={personaProfiles} filter="active" query="" loadFailed={false} readOnly={false} conversationConnected onFilterChange={vi.fn()} onQueryChange={vi.fn()} onOpenProject={vi.fn()} onRetry={vi.fn()} onViewAllDesigners={vi.fn()} onSubmit={onSubmit} notify={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /选择设计师：纸感排版/ }));
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '设计海报' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ message: '设计海报', attachments: [], designerId: 'paper-type' }));
  expect(screen.getByRole('button', { name: /选择设计师：纸感排版/ })).toHaveAttribute('aria-pressed', 'false');
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run src/app/studio/StudioHome.test.tsx
```

Expected: FAIL because the composition component is missing.

- [ ] **Step 3: Implement `StudioHome`**

Keep only `selectedDesignerId` in this component. Pass project/filter/search behavior to `HomeProjectPanel`; pass the controlled selection to `HomeDesignerRail`; wrap the composer callback as:

```tsx
<HomeProjectPanel allProjects={projects} projects={visibleProjects} {...projectPanelProps} />
```

Then wrap the composer callback as:

```ts
const submit = async (input: { message: string; attachments: ConversationImageAttachment[] }): Promise<boolean> => {
  const succeeded = await onSubmit({
    ...input,
    ...(selectedDesignerId ? { designerId: selectedDesignerId } : {}),
  });
  if (succeeded) setSelectedDesignerId('');
  return succeeded;
};
```

Render the heading in the right column; `HomeConversationComposer` owns its localized suggestion chips so they can populate its internal textarea directly.

- [ ] **Step 4: Add the initial `studio-home.css` layout**

Define these contract selectors:

```css
.studio-home {
  display: grid;
  grid-template-columns: minmax(260px, 30%) minmax(0, 70%);
  gap: clamp(28px, 3vw, 48px);
  height: 100%;
  padding: var(--page-content-padding-block-start) var(--page-content-padding-inline) var(--page-content-padding-block-end);
  overflow: hidden;
}

.studio-home-projects {
  min-height: 0;
  border-right: 0;
  background: var(--shell-glass);
  backdrop-filter: var(--shell-backdrop);
}

.studio-home-projects__list {
  min-height: 0;
  overflow-y: auto;
}

.home-designer-rail__list {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x proximity;
}
```

Use the existing glass border token only around the floating panel/card surfaces; do not add a full-height vertical separator.

- [ ] **Step 5: Run GREEN**

```bash
pnpm exec vitest run src/app/studio/HomeProjectPanel.test.tsx src/app/studio/HomeDesignerRail.test.tsx src/app/studio/HomeConversationComposer.test.tsx src/app/studio/StudioHome.test.tsx
```

Expected: all home component tests pass.

### Task 8: Consume the first home conversation in `Workbench`

**Files:**
- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/Workbench.test.tsx`

- [ ] **Step 1: Write a failing one-shot submission test**

```tsx
it('consumes a home conversation once through the normal analysis path', async () => {
  const onSubmitConversation = vi.fn(async () => ({
    id: 'conversation-home', requestId: 'request-home', state: 'queued' as const,
    cancelRequested: false, attempt: 1, capability: 'conversation' as const,
    documentId: 'doc-1', source: { kind: 'project' as const, id: 'spring-market' },
  }));
  const onInitialConversationConsumed = vi.fn();
  const initialConversation = { id: 'launch-1', projectId: 'spring-market', documentId: 'doc-1', message: '设计一张海报', attachments: [] };
  const view = render(<Workbench {...makeProps({ onSubmitConversation, initialConversation, onInitialConversationConsumed })} />);

  await waitFor(() => expect(onSubmitConversation).toHaveBeenCalledWith('设计一张海报', []));
  expect(onInitialConversationConsumed).toHaveBeenCalledWith('launch-1');
  view.rerender(<Workbench {...makeProps({ onSubmitConversation, initialConversation, onInitialConversationConsumed })} />);
  expect(onSubmitConversation).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run src/app/studio/Workbench.test.tsx
```

Expected: type/test failure because the props do not exist.

- [ ] **Step 3: Add one-shot props**

```ts
initialConversation?: PendingHomeConversation;
onInitialConversationConsumed?: (id: string) => void;
```

Import `PendingHomeConversation` from `./types` and add a `consumedInitialConversationIds` ref.

Add a preview helper beside `bytesToBase64`:

```ts
const toPreviewUrl = (attachment: ConversationImageAttachment): string =>
  `data:${attachment.mimeType || 'image/png'};base64,${bytesToBase64(attachment.bytes)}`;
```

- [ ] **Step 4: Extract the existing normal submission body**

Move the `onSubmitConversation` branch from `submitPromptRequest` into:

```ts
const submitConversationRequest = useCallback((
  message: string,
  attachments: ConversationImageAttachment[],
  context: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] } = {},
): Promise<TaskRecord | null | undefined> => {
  setAnalysisMessage(message);
  setAnalysisAttachments(attachments.map((attachment) => ({ ...attachment, previewUrl: toPreviewUrl(attachment) })));
  setAnalysisThreadId((current) => current ?? `analysis-${crypto.randomUUID()}`);
  setPanel('conversation');
  setPanelOpen(true);
  if (!onSubmitConversation) return Promise.resolve(undefined);
  return Promise.resolve(onSubmitConversation(message, attachments, context)).then((task) => {
    if (task) {
      setPendingConversationTaskId(task.id);
      setAnalysisThreadId(task.analysisThreadId ?? `analysis-${task.id}`);
      setTasks((current) => [...current.filter((entry) => entry.id !== task.id), task]);
    }
    return task;
  });
}, [onSubmitConversation]);
```

Use it from the command dock and the initial-conversation effect. Preserve the existing thread context behavior for later messages.

- [ ] **Step 5: Add the one-shot effect and failure restoration**

```ts
useEffect(() => {
  if (!initialConversation || consumedInitialConversationIds.current.has(initialConversation.id)) return;
  consumedInitialConversationIds.current.add(initialConversation.id);
  onInitialConversationConsumed?.(initialConversation.id);
  void submitConversationRequest(initialConversation.message, initialConversation.attachments).then((task) => {
    if (task !== null) return;
    setPrompt(initialConversation.message);
    setConversationAttachments(initialConversation.attachments.map((attachment) => ({ ...attachment, previewUrl: toPreviewUrl(attachment) })));
  }).catch(() => {
    setPrompt(initialConversation.message);
    setConversationAttachments(initialConversation.attachments.map((attachment) => ({ ...attachment, previewUrl: toPreviewUrl(attachment) })));
    notify(t(locale, '任务提交失败', 'Task submission failed'));
  });
}, [initialConversation, locale, notify, onInitialConversationConsumed, submitConversationRequest]);
```

- [ ] **Step 6: Run GREEN**

Run the Workbench test file. Expected: all existing and new tests pass.

### Task 9: Orchestrate automatic creation in `Studio`

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/Studio.test.tsx`

- [ ] **Step 1: Add a failing Chinese automatic-creation integration test**

```tsx
it('creates a localized project and opens its workbench from the first home prompt', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-home' }));
  const submitConversation = vi.fn(async () => ({
    id: 'conversation-home', requestId: 'request-home', state: 'queued' as const,
    cancelRequested: false, attempt: 1, capability: 'conversation' as const,
    documentId: 'doc-home', source: { kind: 'project' as const, id: 'project-home' },
  }));
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer, submitConversation, hasCredential };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  fireEvent.change(await screen.findByRole('textbox', { name: '设计需求' }), { target: { value: '设计一张发布海报' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));

  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-1',
    name: '未命名项目',
    documents: [expect.objectContaining({ name: '主海报', width: 1080, height: 1440 })],
  })));
  const automaticInput = createProjectContainer.mock.calls[0]![0];
  expect(automaticInput).not.toHaveProperty('activeDesignerVersionId');
  expect(automaticInput).not.toHaveProperty('designerSnapshot');
  await waitFor(() => expect(submitConversation).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-home', message: '设计一张发布海报' })));
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Add failing collision and designer tests**

```tsx
it('uses an English numeric suffix when the automatic project name already exists', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'existing', name: 'Untitled project' }]);
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-home-2' }));
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer, hasCredential };
  render(<Studio locale="en" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);
  fireEvent.change(await screen.findByRole('textbox', { name: 'Design request' }), { target: { value: 'Make a poster' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send and create project' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Untitled project (1)' })));
});

it('persists the selected designer snapshot and omits style when none is selected', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const createProjectContainer = vi.fn(async () => ({ projectId: 'styled-project' }));
  const loadDesignerState = vi.fn(async () => ({ profiles: persistedProfiles, defaultId: '', drafts: {} }));
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer, loadDesignerState, hasCredential };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: /选择设计师：纸感排版/ }));
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '带风格项目' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({
    activeDesignerVersionId: 'user-paper',
    designerSnapshot: expect.objectContaining({ id: 'user-paper', styleDna: expect.any(Object), negativeRules: expect.any(Array) }),
  })));

  const styledInput = createProjectContainer.mock.calls[0]![0];
  expect(styledInput.designerSnapshot).not.toBe(persistedProfiles[0]);
});

it('does not create a project in read-only or disconnected states', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const createProjectContainer = vi.fn();
  const hasCredential = vi.fn(async () => false);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer, hasCredential };
  const view = render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);
  fireEvent.change(await screen.findByRole('textbox', { name: '设计需求' }), { target: { value: '不会创建' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  expect(await screen.findByText('请先连接对话模型。')).toBeInTheDocument();
  expect(createProjectContainer).not.toHaveBeenCalled();

  view.rerender(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'read-only' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);
  expect(screen.getByRole('button', { name: '发送并创建项目' })).toBeDisabled();
  expect(createProjectContainer).not.toHaveBeenCalled();
});

it('retains the home draft when automatic project creation fails', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const createProjectContainer = vi.fn(async () => null);
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer, hasCredential };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);
  const input = await screen.findByRole('textbox', { name: '设计需求' });
  fireEvent.change(input, { target: { value: '创建失败也保留' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledOnce());
  expect(input).toHaveValue('创建失败也保留');
});
```

- [ ] **Step 3: Run RED**

```bash
pnpm exec vitest run src/app/Studio.test.tsx
```

Expected: the new home controls and flow are missing.

- [ ] **Step 4: Preserve project timestamps and separate conversation connectivity**

In `toStudioProject`, map:

```ts
updatedAt: entry.updatedAt,
```

Replace the combined `modelConnected` state with `conversationConnected`, driven only by:

```ts
getDesktopApi().hasCredential?.('openai-compatible:conversation') ?? Promise.resolve(false)
```

Image-provider state remains owned by the existing connection and generation paths; the home send gate must not accept an image-only credential.

- [ ] **Step 5: Add `pendingHomeConversation` state and the creation callback**

```ts
const [pendingHomeConversation, setPendingHomeConversation] = useState<PendingHomeConversation | null>(null);

const createProjectFromHome = async (request: HomeConversationRequest): Promise<boolean> => {
  if (!workspace || workspace.openMode !== 'writable' || !conversationConnected) return false;
  const documentId = crypto.randomUUID();
  const selectedDesigner = request.designerId
    ? designerOptions.find((profile) => profile.id === request.designerId && profile.status !== 'archived')
    : undefined;
  const name = createAutomaticProjectName(locale, projects.map((project) => project.name));
  const created = await getDesktopApi().createProjectContainer?.({
    workspaceId: workspace.workspaceId,
    operationId: crypto.randomUUID(),
    name,
    ...(selectedDesigner ? {
      activeDesignerVersionId: selectedDesigner.id,
      designerSnapshot: structuredClone(selectedDesigner),
    } : {}),
    documents: [{ id: documentId, name: t(locale, '主海报', 'Main poster'), width: 1080, height: 1440 }],
  });
  if (!created) {
    notify(t(locale, '无法创建项目，请重试。', 'Could not create the project. Try again.'));
    return false;
  }
  const project: Project = {
    id: created.projectId,
    workspaceId: workspace.workspaceId,
    documentId,
    name,
    enName: name,
    description: '',
    enDescription: '',
    designers: selectedDesigner ? [localize(locale, selectedDesigner.name)] : [],
    ...(selectedDesigner ? { activeDesignerVersionId: selectedDesigner.id, designerSnapshot: structuredClone(selectedDesigner) } : {}),
    artwork: 'blank',
    documents: 1,
    documentEntries: [{ id: documentId, name: t(locale, '主海报', 'Main poster'), width: 1080, height: 1440 }],
    updatedAt: new Date().toISOString(),
  };
  setProjects((current) => [project, ...current]);
  setSelected(project);
  setActiveDocumentId(documentId);
  setDocumentOpen(true);
  setView('projects');
  setSurface('projects');
  setPendingHomeConversation({ id: crypto.randomUUID(), projectId: project.id, documentId, message: request.message, attachments: request.attachments });
  return true;
};
```

Wrap the desktop call in `try/catch`; the catch must notify and return `false` without changing project or pending-conversation state.

- [ ] **Step 6: Pass and clear the one-shot context**

For the matching workbench only:

```tsx
initialConversation={pendingHomeConversation?.projectId === project.id ? pendingHomeConversation : undefined}
onInitialConversationConsumed={(id) => setPendingHomeConversation((current) => current?.id === id ? null : current)}
```

- [ ] **Step 7: Run GREEN for automatic creation**

Run `src/app/Studio.test.tsx`. Expected: automatic creation, collision, designer, and no-designer tests pass.

### Task 10: Replace the permanent sidebar with home and avatar navigation

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/Studio.test.tsx`
- Modify: `src/app/styles/studio.css`

- [ ] **Step 1: Update navigation tests before markup**

Add this helper to `Studio.test.tsx` and replace direct `.main-navigation` usage in affected tests:

```ts
const navigateFromUserMenu = (label: string): void => {
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  fireEvent.click(screen.getByRole('menuitem', { name: label }));
};
```

Change the old “manual creation only” assertion to expect the home conversation plus “新建空白项目” in the avatar menu. Open that menu item and assert that the existing drawer still exposes name, goal, cover, size, and designer controls, and does not expose a brand-kit selector. Add assertions that `.studio-sidebar` and `.studio-status` do not exist.

- [ ] **Step 2: Run RED**

```bash
pnpm exec vitest run src/app/Studio.test.tsx
```

Expected: FAIL because the old sidebar/status and project-card home are still rendered.

- [ ] **Step 3: Mount `StudioUserMenu` in `WindowBar`**

Pass:

```tsx
userMenu={(
  <StudioUserMenu
    locale={locale}
    operatorName={operatorName}
    currentView={view}
    onNavigate={navigate}
    onNewProject={() => openNewDesign()}
    onImportProject={() => { void importProjectPackage(); }}
    importDisabled={workspace?.openMode !== 'writable'}
  />
)}
onBrandClick={() => {
  setSelected(null);
  setDocumentOpen(false);
  navigate('projects');
}}
```

Make the brand button return to `projects`, clear `selected`, and close the document; keep the workspace switch unchanged.

- [ ] **Step 4: Remove the sidebar and status footer markup**

Delete the `.studio-sidebar` tree and `.studio-status` footer. Keep `PageToolbarProvider`, but render `.studio-toolbar` only when not on the unselected projects home. Remove its sidebar-collapse control. Remove the unused `collapsed` and `display` state, and remove the projects-home branch from `toolbarActions` because filter/search now live inside `StudioHome`.

- [ ] **Step 5: Replace the old projects page with `StudioHome`**

```tsx
{surface === 'projects' && view === 'projects' && !selected && (
  <StudioHome
    locale={locale}
    projects={projects}
    visibleProjects={visibleProjects}
    profiles={designerOptions}
    filter={filter}
    query={query}
    loadFailed={projectsLoadFailed}
    readOnly={workspace?.openMode !== 'writable'}
    conversationConnected={conversationConnected}
    onFilterChange={setFilter}
    onQueryChange={setQuery}
    onOpenProject={openProject}
    onRetry={() => setProjectsReloadKey((key) => key + 1)}
    onViewAllDesigners={() => navigate('designers')}
    onSubmit={createProjectFromHome}
    notify={notify}
  />
)}
```

- [ ] **Step 6: Simplify the studio shell CSS**

```css
.studio {
  display: block;
  height: calc(100dvh - 40px);
}

.studio-main {
  height: 100%;
  min-height: 0;
}

.studio-toolbar {
  border-bottom: 0;
  background: transparent;
}
```

Delete sidebar grid-column, compact-sidebar, sidebar border, navigation, sidebar-bottom, and status-footer rules only after their markup is gone. Keep styles still used by the workspace modal and operator avatar.

- [ ] **Step 7: Run GREEN**

```bash
pnpm exec vitest run src/app/Studio.test.tsx src/app/shell/WindowBar.test.tsx src/app/studio/StudioUserMenu.test.tsx src/app/studio/StudioHome.test.tsx
```

Expected: all shell, navigation, home, and automatic-creation tests pass.

### Task 11: Layout contract and accessibility regression

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `src/app/studio/studio-home.css`
- Modify: `src/app/styles/window.css`
- Modify: `src/app/styles/studio.css`

- [ ] **Step 1: Add a failing CSS contract test**

```ts
it('uses a seamless 30/70 conversation-first home without global divider lines', () => {
  const homeStyles = readStyle('../../src/app/studio/studio-home.css');
  const windowStyles = readStyle('../../src/app/styles/window.css');
  const studioStyles = readStyle('../../src/app/styles/studio.css');

  expect(homeStyles).toMatch(/\.studio-home\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*30%\)\s+minmax\(0,\s*70%\)/);
  expect(homeStyles).toMatch(/\.studio-home-projects__list\s*\{[\s\S]*overflow-y:\s*auto/);
  expect(homeStyles).toMatch(/\.home-designer-rail__list\s*\{[\s\S]*overflow-x:\s*auto/);
  expect(windowStyles.match(/\.window-bar\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').toMatch(/border-bottom:\s*0/);
  expect(studioStyles).not.toMatch(/\.studio-sidebar\s*\{/);
  expect(studioStyles).not.toMatch(/\.studio-status\s*\{/);
});
```

- [ ] **Step 2: Run RED, then complete missing styles**

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected before final CSS cleanup: FAIL on remaining sidebar/status/divider selectors.

Complete styles for dark/light glass, focus-visible, selected designer, disabled/busy composer, long-name ellipsis, reduced transparency, and reduced motion. Remove only obsolete global sidebar/status selectors.

- [ ] **Step 3: Run GREEN**

Run the same layout-contract test. Expected: PASS.

### Task 12: Full verification and handoff

**Files:**
- Verification only.

- [ ] **Step 1: Run focused tests**

```bash
pnpm exec vitest run src/app/studio/auto-project-name.test.ts src/app/studio/HomeProjectPanel.test.tsx src/app/studio/HomeDesignerRail.test.tsx src/app/studio/HomeConversationComposer.test.tsx src/app/studio/StudioHome.test.tsx src/app/studio/StudioUserMenu.test.tsx src/app/shell/WindowBar.test.tsx src/app/studio/Workbench.test.tsx src/app/Studio.test.tsx tests/integration/layout-contract.test.ts
```

Expected: all focused tests pass with no unhandled rejections.

- [ ] **Step 2: Run the complete unit and integration suites**

```bash
pnpm test:unit
pnpm test:integration
```

Expected: both suites exit 0.

- [ ] **Step 3: Run end-to-end coverage**

```bash
pnpm test:e2e
```

Expected: the desktop web-preview flows exit 0.

- [ ] **Step 4: Run static checks**

```bash
pnpm typecheck
pnpm lint
```

Expected: both commands exit 0.

- [ ] **Step 5: Run the production build**

```bash
pnpm build
```

Expected: exit 0; the existing bundle-size warning is acceptable.

- [ ] **Step 6: Check patch scope**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Existing unrelated user changes remain untouched. Do not commit the dirty shared-file implementation without a separate explicit request.
