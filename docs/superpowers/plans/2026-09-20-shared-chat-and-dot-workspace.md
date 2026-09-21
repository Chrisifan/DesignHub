# Shared Chat Dock And Interactive Dot Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the Studio home and canvas around one reusable conversation dock, remove the duplicated home suggestions and surface shadows, and give the whole application a neutral interactive dot-grid background.

**Architecture:** Add a controlled `ConversationDock` presentation component that owns file selection, paste validation, preview, removal, and accessible dock markup while leaving message state and submission semantics with `HomeConversationComposer` and `Workbench`. Add a focused root hook that coalesces pointer movement with `requestAnimationFrame` and writes CSS variables to `.app-shell`; render both the static and enhanced dot layers from root pseudo-elements so individual pages remain transparent.

**Tech Stack:** React 19, TypeScript 5.9, CSS custom properties and pseudo-elements, Vitest, Testing Library, Playwright.

**Working agreement:** Execute directly on `main`, as requested. Preserve the existing uncommitted conversation-first home work and stage only the files named in each task's commit step.

---

## File Map

- Create `src/app/studio/ConversationDock.tsx`: shared controlled conversation surface and attachment interaction.
- Create `src/app/studio/ConversationDock.test.tsx`: variant, attachment, preview, designer, and accessibility contracts.
- Create `src/app/studio/conversation-dock.css`: compact and expanded dock styling plus reduced-transparency fallback.
- Modify `src/app/studio/HomeConversationComposer.tsx`: home-specific draft and submit adapter around the expanded dock.
- Modify `src/app/studio/HomeConversationComposer.test.tsx`: success/failure draft lifecycle and shared attachment behavior.
- Modify `src/app/studio/StudioHome.tsx`: pass the selected optional designer into the expanded dock and keep automatic-project semantics unchanged.
- Modify `src/app/studio/StudioHome.test.tsx`: selected/no-designer display and removal of suggestions.
- Modify `src/app/studio/Workbench.tsx`: replace inline compact dock markup and duplicated attachment readers with the shared dock.
- Modify `src/app/studio/Workbench.test.tsx`: compact actions, candidate references, attachment behavior, and existing conversation submission.
- Modify `src/app/studio/studio-home.css`: transparent page layout, shadowless project glass, and removal of obsolete home-composer rules.
- Modify `src/app/studio/workbench.css`: remove obsolete dock rules after moving them to the shared stylesheet.
- Create `src/app/usePointerDotBackground.ts`: root pointer tracking and animation-frame coalescing.
- Create `src/app/usePointerDotBackground.test.tsx`: pointer update, leave, cleanup, and reduced-motion tests.
- Modify `src/app/App.tsx`: attach the pointer hook and root ref.
- Modify `src/app/styles/window.css`: application-wide static and pointer-enhanced dot layers and transparent window chrome.
- Modify `src/app/styles/studio.css`: ensure Studio page hosts do not cover the root background.
- Modify `src/app/App.test.tsx`: root shell wiring contract.
- Modify `tests/integration/layout-contract.test.ts`: CSS ownership, glass, shadow, and transparency contracts.
- Modify `tests/e2e/test-workspace.ts`: opt-in connected conversation and project-creation failure fixtures.
- Modify `tests/e2e/studio.spec.ts`: responsive home, project handoff, pointer highlight, and reduced-motion behavior.

### Task 1: Build The Shared Controlled Conversation Dock

**Files:**
- Create: `src/app/studio/ConversationDock.tsx`
- Create: `src/app/studio/ConversationDock.test.tsx`
- Create: `src/app/studio/conversation-dock.css`

- [ ] **Step 1: Write failing variant and interaction tests**

Create `src/app/studio/ConversationDock.test.tsx` with fixtures that render the component in both modes and assert the shared behavior:

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ConversationDock, type ConversationDockAttachment } from './ConversationDock';

const attachment: ConversationDockAttachment = {
  name: 'reference.png',
  mimeType: 'image/png',
  bytes: new Uint8Array([1, 2, 3]),
  previewUrl: 'data:image/png;base64,AQID',
};

const baseProps = {
  locale: 'zh-CN' as const,
  value: '设计一张海报',
  attachments: [] as ConversationDockAttachment[],
  readOnly: false,
  busy: false,
  conversationConnected: true,
  designer: null,
  textareaLabel: '设计需求',
  placeholder: '描述设计需求',
  submitLabel: '发送并创建项目',
  onValueChange: vi.fn(),
  onAttachmentsChange: vi.fn(),
  onSubmit: vi.fn(),
  notify: vi.fn(),
};

it('renders expanded and compact modes from the same component', () => {
  const { rerender } = render(<ConversationDock {...baseProps} variant="expanded" />);
  const expanded = screen.getByRole('form', { name: 'AI 操作坞' });
  expect(expanded).toHaveClass('conversation-dock--expanded');
  expect(within(expanded).queryByRole('button', { name: '模型任务' })).toBeNull();

  rerender(
    <ConversationDock
      {...baseProps}
      variant="compact"
      onOpenTasks={vi.fn()}
      onOpenHistory={vi.fn()}
      onGenerate={vi.fn()}
    />,
  );
  const compact = screen.getByRole('form', { name: 'AI 操作坞' });
  expect(compact).toHaveClass('conversation-dock--compact');
  expect(within(compact).getByRole('button', { name: '模型任务' })).toBeVisible();
  expect(within(compact).getByRole('button', { name: '版本历史' })).toBeVisible();
  expect(within(compact).getByRole('button', { name: '生成' })).toBeVisible();
});

it('reads pasted images, previews them, and removes them through controlled callbacks', async () => {
  const onAttachmentsChange = vi.fn();
  const file = new File([new Uint8Array([1, 2, 3])], 'reference.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });
  const { rerender } = render(
    <ConversationDock {...baseProps} variant="expanded" onAttachmentsChange={onAttachmentsChange} />,
  );

  fireEvent.paste(screen.getByRole('textbox', { name: '设计需求' }), {
    clipboardData: { files: [file] },
  });
  await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalledWith([
    expect.objectContaining({ name: 'reference.png', mimeType: 'image/png', bytes: expect.any(Uint8Array) }),
  ]));

  rerender(
    <ConversationDock
      {...baseProps}
      variant="expanded"
      attachments={[attachment]}
      onAttachmentsChange={onAttachmentsChange}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '预览 reference.png' }));
  expect(screen.getByRole('dialog', { name: 'reference.png' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '删除 reference.png' }));
  expect(onAttachmentsChange).toHaveBeenLastCalledWith([]);
});

it('shows explicit no-designer state and compact candidate references', () => {
  render(
    <ConversationDock
      {...baseProps}
      variant="compact"
      referencedAssetCount={2}
      onOpenTasks={vi.fn()}
      onOpenHistory={vi.fn()}
    />,
  );
  expect(screen.getByText('未设置设计师')).toBeVisible();
  expect(screen.getByLabelText('候选参考图')).toHaveTextContent('2 张候选图将用于下一轮对话');
});
```

- [ ] **Step 2: Run the focused tests and confirm the missing component failure**

Run:

```bash
pnpm exec vitest run src/app/studio/ConversationDock.test.tsx
```

Expected: FAIL because `./ConversationDock` does not exist.

- [ ] **Step 3: Implement the shared types, file conversion, and controlled surface**

Create `src/app/studio/ConversationDock.tsx` around this public contract:

```tsx
import { useRef, useState, type ClipboardEvent, type FormEvent, type RefObject } from 'react';

import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { Locale } from '../i18n';
import { PersonaArtwork } from './PersonaArtwork';
import type { PersonaProfile } from './personas';
import { Icon, IconButton, Modal, t } from './ui';
import './conversation-dock.css';

export type ConversationDockVariant = 'compact' | 'expanded';

export type ConversationDockAttachment = ConversationImageAttachment & {
  previewUrl: string;
};

export type ConversationDockProps = {
  variant: ConversationDockVariant;
  locale: Locale;
  value: string;
  attachments: ConversationDockAttachment[];
  readOnly: boolean;
  busy?: boolean;
  conversationConnected: boolean;
  designer: PersonaProfile | null;
  textareaLabel: string;
  placeholder: string;
  submitLabel: string;
  busyLabel?: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  referencedAssetCount?: number;
  showGenerate?: boolean;
  generateDisabled?: boolean;
  onValueChange: (value: string) => void;
  onAttachmentsChange: (attachments: ConversationDockAttachment[]) => void;
  onSubmit: () => void;
  onDesignerClick?: () => void;
  onOpenTasks?: () => void;
  onOpenHistory?: () => void;
  onGenerate?: () => void;
  notify: (message: string) => void;
};

const bytesToDataUrl = (mimeType: string, bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const readImageFile = async (file: File): Promise<ConversationDockAttachment> => {
  const mimeType = file.type || 'image/png';
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    name: file.name || `image-${Date.now()}.png`,
    mimeType,
    bytes,
    previewUrl: bytesToDataUrl(mimeType, bytes),
  };
};
```

Implement one labelled `<form className={`conversation-dock conversation-dock--${variant}`}>` with:

- a controlled textarea and `textareaRef`;
- a hidden `accept="image/*" multiple` input opened by the plus icon;
- `addFiles()` that reports non-images, rejects files larger than 8 MiB, caps the combined list at eight, converts accepted files with `readImageFile`, and calls `onAttachmentsChange` once;
- the same `addFiles()` path for paste and file-picker events;
- attachment rows with preview and remove icon buttons;
- a local `previewAttachment` used only to open the shared `Modal`;
- an explicit translated “未设置设计师 / No designer selected” identity when `designer` is `null`;
- task, history, generate, and candidate-reference controls only when `variant === 'compact'`;
- a connection status only when `variant === 'expanded'`;
- `aria-busy={busy}`, a disabled textarea in read-only mode, and a disabled send button only for `busy`, `readOnly`, or an empty trimmed value.

Use `PersonaArtwork` when `designer` exists and the registered `users` icon for the no-designer state. Call `event.preventDefault()` in the form submit handler and invoke `onSubmit()` without embedding home or canvas task logic.

- [ ] **Step 4: Add minimal shared layout CSS so the tests render stable controls**

Create `src/app/studio/conversation-dock.css` with the structural selectors used by the component:

```css
.conversation-dock {
  min-width: 0;
  display: grid;
  gap: 0;
  padding: 12px 14px 9px;
  border: 1px solid var(--shell-glass-border);
  border-radius: 22px;
}

.conversation-dock--compact {
  position: absolute;
  z-index: 8;
  bottom: 8px;
  left: 50%;
  width: min(620px, calc(100% - 40px));
  transform: translateX(-50%);
}

.conversation-dock--expanded {
  position: relative;
  width: 100%;
}

.conversation-dock textarea {
  min-width: 0;
  width: 100%;
  resize: none;
  border: 0;
  outline: 0;
  color: var(--on-surface);
  background: transparent;
}

.conversation-dock--compact textarea { height: 46px; }
.conversation-dock--expanded textarea { min-height: 116px; }
.conversation-dock__attachments,
.conversation-dock__toolbar,
.conversation-dock__toolbar-leading,
.conversation-dock__toolbar-actions { display: flex; align-items: center; }
.conversation-dock__attachments { gap: 8px; overflow-x: auto; padding-bottom: 8px; }
.conversation-dock__toolbar { justify-content: space-between; gap: 12px; }
.conversation-dock__toolbar-leading,
.conversation-dock__toolbar-actions { gap: 4px; }
.conversation-dock__attachment-full { display: block; max-width: min(80vw, 860px); max-height: 72vh; margin: 0 auto; object-fit: contain; }
```

- [ ] **Step 5: Run the component tests**

Run:

```bash
pnpm exec vitest run src/app/studio/ConversationDock.test.tsx
```

Expected: PASS for compact/expanded rendering, file paste, preview/removal, no-designer state, and candidate references.

- [ ] **Step 6: Commit the shared component**

```bash
git add src/app/studio/ConversationDock.tsx src/app/studio/ConversationDock.test.tsx src/app/studio/conversation-dock.css
git commit -m "feat: add shared conversation dock"
```

### Task 2: Adapt The Home Composer Without Changing Automatic Project Creation

**Files:**
- Modify: `src/app/studio/HomeConversationComposer.tsx:1-161`
- Modify: `src/app/studio/HomeConversationComposer.test.tsx:1-54`
- Modify: `src/app/studio/StudioHome.tsx:1-93`
- Modify: `src/app/studio/StudioHome.test.tsx:1-62`

- [ ] **Step 1: Extend the home tests for shared-dock and draft lifecycle contracts**

Add these assertions to the existing home tests:

```tsx
it('uses the expanded shared dock without prompt suggestions', () => {
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected onSubmit={vi.fn(async () => true)} notify={vi.fn()} designer={null} />);
  expect(screen.getByRole('form', { name: 'AI 操作坞' })).toHaveClass('conversation-dock--expanded');
  expect(screen.queryByLabelText('提示词建议')).toBeNull();
  expect(screen.queryByRole('button', { name: '模型任务' })).toBeNull();
  expect(screen.getByText('未设置设计师')).toBeVisible();
});

it('keeps text and attachments when project creation fails', async () => {
  const onSubmit = vi.fn(async () => false);
  const file = new File([new Uint8Array([4, 5])], 'mood.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([4, 5]).buffer });
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected onSubmit={onSubmit} notify={vi.fn()} designer={null} />);
  fireEvent.change(screen.getByLabelText('添加图片'), { target: { files: [file] } });
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '保留完整草稿' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', { name: '设计需求' })).toHaveValue('保留完整草稿');
  expect(screen.getByRole('button', { name: '预览 mood.png' })).toBeVisible();
});
```

In `StudioHome.test.tsx`, extend the selected-designer test with:

```tsx
expect(screen.getByRole('form', { name: 'AI 操作坞' })).toHaveTextContent('纸感排版');
expect(screen.queryByLabelText('提示词建议')).toBeNull();
```

- [ ] **Step 2: Run the home tests and confirm they fail against the separate composer**

Run:

```bash
pnpm exec vitest run src/app/studio/HomeConversationComposer.test.tsx src/app/studio/StudioHome.test.tsx
```

Expected: FAIL because the home does not yet render `.conversation-dock--expanded`, accept `designer`, or omit suggestions.

- [ ] **Step 3: Replace the home-only markup with a controlled expanded dock**

Refactor `HomeConversationComposer.tsx` to keep only home submission state:

```tsx
type HomeConversationComposerProps = {
  locale: Locale;
  readOnly: boolean;
  conversationConnected: boolean;
  designer: PersonaProfile | null;
  onSubmit: (input: { message: string; attachments: ConversationImageAttachment[] }) => Promise<boolean>;
  notify: (message: string) => void;
};

const [message, setMessage] = useState('');
const [attachments, setAttachments] = useState<ConversationDockAttachment[]>([]);
const [busy, setBusy] = useState(false);

const submit = async (): Promise<void> => {
  const trimmed = message.trim();
  if (!trimmed) {
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
  try {
    const succeeded = await onSubmit({
      message: trimmed,
      attachments: attachments.map(({ name, mimeType, bytes }) => ({ name, mimeType, bytes })),
    });
    if (succeeded) {
      setMessage('');
      setAttachments([]);
    }
  } catch {
    notify(t(locale, '无法读取图片或创建项目。', 'The image could not be read or the project could not be created.'));
  } finally {
    setBusy(false);
  }
};
```

Update every pre-existing `HomeConversationComposer` test render to pass `designer={null}` unless that test intentionally supplies a selected profile.

Return only:

```tsx
<ConversationDock
  variant="expanded"
  locale={locale}
  value={message}
  attachments={attachments}
  readOnly={readOnly}
  busy={busy}
  conversationConnected={conversationConnected}
  designer={designer}
  textareaLabel={t(locale, '设计需求', 'Design request')}
  placeholder={t(locale, '说说你想做什么。可以描述内容、用途和感觉…', 'Describe the content, purpose, and feeling you want…')}
  submitLabel={t(locale, '发送并创建项目', 'Send and create project')}
  busyLabel={t(locale, '创建中', 'Creating')}
  onValueChange={setMessage}
  onAttachmentsChange={setAttachments}
  onSubmit={() => { void submit(); }}
  notify={notify}
/>
```

Delete the suggestion constants and suggestion markup. Do not clear either controlled state before `onSubmit` resolves `true`.

- [ ] **Step 4: Pass the selected home designer into the dock**

In `StudioHome.tsx`, derive the active non-archived profile and pass it to the composer:

```tsx
const selectedDesigner = profiles.find(
  (profile) => profile.id === selectedDesignerId && profile.status !== 'archived',
) ?? null;

<HomeConversationComposer
  locale={locale}
  readOnly={readOnly}
  conversationConnected={conversationConnected}
  designer={selectedDesigner}
  onSubmit={submit}
  notify={notify}
/>
```

Keep the existing `selectedDesignerId` reset after a successful automatic-project submission and keep the `HomeDesignerRail` as the selector.

- [ ] **Step 5: Run the home adapter tests**

Run:

```bash
pnpm exec vitest run src/app/studio/HomeConversationComposer.test.tsx src/app/studio/StudioHome.test.tsx
```

Expected: PASS, including draft preservation on failure and reset on success.

- [ ] **Step 6: Commit the home adapter**

```bash
git add src/app/studio/HomeConversationComposer.tsx src/app/studio/HomeConversationComposer.test.tsx src/app/studio/StudioHome.tsx src/app/studio/StudioHome.test.tsx
git commit -m "refactor: use shared dock on studio home"
```

### Task 3: Replace The Workbench Inline Dock

**Files:**
- Modify: `src/app/studio/Workbench.tsx:1-30,179-189,585-635,1188-1264`
- Modify: `src/app/studio/Workbench.test.tsx`

- [ ] **Step 1: Add compact-host regression tests**

Add tests beside the existing command-dock tests in `Workbench.test.tsx`:

```tsx
it('renders the compact shared dock with canvas-only actions and references', () => {
  render(<Workbench {...makeProps()} />);
  const dock = screen.getByRole('form', { name: 'AI 操作坞' });
  expect(dock).toHaveClass('conversation-dock--compact');
  expect(within(dock).getByRole('button', { name: '模型任务' })).toBeVisible();
  expect(within(dock).getByRole('button', { name: '版本历史' })).toBeVisible();
  expect(within(dock).queryByText('对话模型已连接')).toBeNull();
});

it('uses the shared attachment picker in the canvas host', async () => {
  const onSubmitConversation = vi.fn(async () => null);
  const file = new File([new Uint8Array([7, 8])], 'canvas-reference.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([7, 8]).buffer });
  render(<Workbench {...makeProps({ onSubmitConversation })} />);
  fireEvent.change(screen.getByLabelText('添加图片'), { target: { files: [file] } });
  await screen.findByRole('button', { name: '预览 canvas-reference.png' });
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '保留参考图气质' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(onSubmitConversation).toHaveBeenCalledWith(
    '保留参考图气质',
    [expect.objectContaining({ name: 'canvas-reference.png', bytes: expect.any(Uint8Array) })],
  ));
});
```

- [ ] **Step 2: Run the workbench tests and confirm the shared-class assertion fails**

Run:

```bash
pnpm exec vitest run src/app/studio/Workbench.test.tsx
```

Expected: FAIL because Workbench still owns `.workbench-command-dock` markup.

- [ ] **Step 3: Remove duplicated canvas attachment UI logic and render `ConversationDock`**

In `Workbench.tsx`:

- import `ConversationDock` and `ConversationDockAttachment`;
- include `modelConnected = false` in the existing `Workbench` props destructuring;
- keep `promptRef` because `showPanel('conversation')` focuses it;
- type `conversationAttachments` as `ConversationDockAttachment[]`;
- remove `previewAttachment`, `attachmentInputRef`, `submitPrompt`, `addConversationFiles`, `onAttachmentInputChange`, `onPromptPaste`, `removeConversationAttachment`, and the host-owned preview `Modal`;
- keep `toPreviewUrl` for persisted `initialConversation` and analysis-panel attachments;
- keep `submitPromptRequest` and all task/thread state unchanged.

Replace the inline form with:

```tsx
<ConversationDock
  variant="compact"
  locale={locale}
  value={prompt}
  attachments={conversationAttachments}
  readOnly={readOnly}
  conversationConnected={Boolean(modelConnected)}
  designer={designerSnapshot ? conversationDesignerProfile : null}
  textareaLabel={t(locale, '修改说明', 'Edit request')}
  placeholder={t(locale, '描述希望调整的内容…', 'Describe the change…')}
  submitLabel={t(locale, '发送', 'Send')}
  textareaRef={promptRef}
  referencedAssetCount={referencedAssetIds.length}
  showGenerate={!analysisThreadId}
  generateDisabled={readOnly || Boolean(onSubmitDesignGeneration && pendingConversationTaskId)}
  onValueChange={setPrompt}
  onAttachmentsChange={setConversationAttachments}
  onSubmit={submitPromptRequest}
  onDesignerClick={onConnections}
  onOpenTasks={() => onTasks?.()}
  onOpenHistory={() => showPanel('history')}
  onGenerate={submitGeneration}
  notify={notify}
/>
```

Pass `designer={null}` only when there is no persisted designer snapshot; do not synthesize a selected designer from a missing snapshot merely because a legacy project name exists.

- [ ] **Step 4: Run Workbench and home tests together**

Run:

```bash
pnpm exec vitest run src/app/studio/ConversationDock.test.tsx src/app/studio/HomeConversationComposer.test.tsx src/app/studio/StudioHome.test.tsx src/app/studio/Workbench.test.tsx
```

Expected: PASS with the same component class in both hosts and unchanged task submission arguments.

- [ ] **Step 5: Commit the Workbench adapter**

```bash
git add src/app/studio/Workbench.tsx src/app/studio/Workbench.test.tsx
git commit -m "refactor: share conversation dock with canvas"
```

### Task 4: Consolidate Glass Styling And Remove Surface Shadows

**Files:**
- Modify: `src/app/studio/conversation-dock.css`
- Modify: `src/app/studio/studio-home.css:1-125`
- Modify: `src/app/studio/workbench.css:1458-1670`
- Modify: `tests/integration/layout-contract.test.ts:257-268`

- [ ] **Step 1: Strengthen the layout contract before changing styles**

Extend the conversation-first layout test in `tests/integration/layout-contract.test.ts`:

```ts
expect(homeStyles).toMatch(/\.studio-home-projects\s*\{[\s\S]*box-shadow:\s*inset/);
expect(homeStyles).not.toMatch(/\.studio-home-projects\s*\{[\s\S]*box-shadow:\s*var\(--shadow-overlay\)/);
expect(homeStyles).not.toMatch(/\.home-conversation__suggestions/);
expect(homeStyles).not.toMatch(/\.home-conversation__composer/);
expect(workbenchStyles).not.toMatch(/\.workbench-command-dock/);
expect(conversationDockStyles).toMatch(/\.conversation-dock\s*\{[\s\S]*background:[\s\S]*var\(--shell-glass\)/);
expect(conversationDockStyles).toMatch(/\.conversation-dock\s*\{[\s\S]*box-shadow:\s*inset/);
expect(conversationDockStyles).not.toMatch(/box-shadow:[^;]*0\s+14px\s+34px/);
```

At the top of the test, load the new stylesheet:

```ts
const conversationDockStyles = readStyle('../../src/app/studio/conversation-dock.css');
```

- [ ] **Step 2: Run the layout contract and confirm obsolete selectors/shadows fail**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL because home and canvas still own separate composer styles and external shadows.

- [ ] **Step 3: Move the complete dock styling into the shared stylesheet**

Move the attachment chip, designer identity, toolbar, reference indicator, textarea, modal image, and responsive rules from `.workbench-command-dock*` selectors to matching `.conversation-dock*` selectors in `conversation-dock.css`. Use one material block:

```css
.conversation-dock {
  border: 1px solid var(--shell-glass-border);
  background:
    linear-gradient(145deg, var(--workbench-glass-highlight), transparent 45%),
    var(--shell-glass);
  -webkit-backdrop-filter: var(--shell-backdrop);
  backdrop-filter: var(--shell-backdrop);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 11%, transparent);
}

.conversation-dock--expanded textarea {
  min-height: 116px;
  padding: 10px 3px;
  font: 400 15px/23px Geist, "PingFang SC", sans-serif;
}

@media (prefers-reduced-transparency: reduce) {
  .conversation-dock {
    background: var(--surface-container);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
```

The compact variant retains `bottom: 8px`, `width: min(620px, calc(100% - 40px))`, and its current 46px textarea. The expanded variant stays in normal flow and does not receive absolute positioning or a drop shadow.

- [ ] **Step 4: Simplify home and Workbench styles**

In `studio-home.css`:

- remove every `.home-conversation__*` selector;
- remove `.home-conversation__composer` from shared glass selectors and reduced-transparency selectors;
- make `.studio-home-projects` use the same translucent fill, fine border, blur, and inner highlight as the dock;
- set `box-shadow: inset 0 1px 0 color-mix(in srgb, white 8%, transparent)` on the project panel, with no external shadow;
- preserve independent `.studio-home-projects__list` vertical scrolling and `.home-designer-rail__list` horizontal scrolling.

In `workbench.css`, remove the complete `.workbench-command-dock*` block and update the 1080px media rule to target `.conversation-dock--compact`.

- [ ] **Step 5: Run component and layout tests**

Run:

```bash
pnpm exec vitest run src/app/studio/ConversationDock.test.tsx src/app/studio/HomeConversationComposer.test.tsx src/app/studio/StudioHome.test.tsx src/app/studio/Workbench.test.tsx tests/integration/layout-contract.test.ts
```

Expected: PASS with no obsolete home or Workbench dock selectors.

- [ ] **Step 6: Commit the visual consolidation**

```bash
git add src/app/studio/conversation-dock.css src/app/studio/studio-home.css src/app/studio/workbench.css tests/integration/layout-contract.test.ts
git commit -m "style: unify glass conversation surfaces"
```

### Task 5: Add Root-Owned Interactive Dot Background

**Files:**
- Create: `src/app/usePointerDotBackground.ts`
- Create: `src/app/usePointerDotBackground.test.tsx`
- Modify: `src/app/App.tsx:1-5,189-190`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/styles/window.css:1-27`
- Modify: `src/app/styles/studio.css:61-68,111-118`
- Modify: `tests/integration/layout-contract.test.ts:247-268`

- [ ] **Step 1: Write failing tests for animation-frame pointer tracking**

Create `src/app/usePointerDotBackground.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { usePointerDotBackground } from './usePointerDotBackground';

const Harness = () => {
  const ref = useRef<HTMLElement>(null);
  usePointerDotBackground(ref);
  return <main ref={ref}>workspace</main>;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('coalesces pointer movement into one animation-frame CSS update and clears on leave', () => {
  let frame: FrameRequestCallback | undefined;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const { getByRole } = render(<Harness />);
  const shell = getByRole('main');
  vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 500, height: 400, right: 510, bottom: 420, x: 10, y: 20, toJSON: () => ({}) });

  fireEvent.pointerMove(shell, { clientX: 110, clientY: 170 });
  fireEvent.pointerMove(shell, { clientX: 130, clientY: 190 });
  expect(window.requestAnimationFrame).toHaveBeenCalledOnce();
  frame?.(0);
  expect(shell.style.getPropertyValue('--pointer-x')).toBe('120px');
  expect(shell.style.getPropertyValue('--pointer-y')).toBe('170px');
  expect(shell).toHaveAttribute('data-pointer-active', 'true');

  fireEvent.pointerLeave(shell);
  expect(shell).not.toHaveAttribute('data-pointer-active');
});

it('does not follow the pointer when reduced motion is requested', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame');
  const { getByRole } = render(<Harness />);
  fireEvent.pointerMove(getByRole('main'), { clientX: 40, clientY: 60 });
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the hook tests and confirm the missing module failure**

Run:

```bash
pnpm exec vitest run src/app/usePointerDotBackground.test.tsx
```

Expected: FAIL because `usePointerDotBackground` does not exist.

- [ ] **Step 3: Implement pointer tracking without React render churn**

Create `src/app/usePointerDotBackground.ts`:

```ts
import { useEffect, type RefObject } from 'react';

export const usePointerDotBackground = (rootRef: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const root = rootRef.current;
    const reducedMotion = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    if (!root || reducedMotion?.matches) return undefined;

    let frameId: number | null = null;
    let clientX = 0;
    let clientY = 0;
    const flush = (): void => {
      frameId = null;
      const bounds = root.getBoundingClientRect();
      root.style.setProperty('--pointer-x', `${clientX - bounds.left}px`);
      root.style.setProperty('--pointer-y', `${clientY - bounds.top}px`);
      root.dataset.pointerActive = 'true';
    };
    const onPointerMove = (event: PointerEvent): void => {
      clientX = event.clientX;
      clientY = event.clientY;
      if (frameId === null) frameId = window.requestAnimationFrame(flush);
    };
    const onPointerLeave = (): void => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      delete root.dataset.pointerActive;
    };

    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerleave', onPointerLeave);
    return () => {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      delete root.dataset.pointerActive;
    };
  }, [rootRef]);
};
```

- [ ] **Step 4: Wire the root ref into App**

In `App.tsx`, import the hook, create `const appShellRef = useRef<HTMLElement>(null)`, call `usePointerDotBackground(appShellRef)`, and update the existing root only:

```tsx
<main ref={appShellRef} className="app-shell" aria-label={copy.appName} data-theme={theme}>
```

Add an `App.test.tsx` assertion that the main shell has the `app-shell` class and receives `data-pointer-active="true"` after a mocked frame flush. Do not place pointer listeners on `StudioHome`, `Studio`, or `Workbench`.

- [ ] **Step 5: Replace the root decorative gradients with two neutral dot layers**

In `window.css`, replace the existing grid block with:

```css
.app-shell {
  --workspace-dot-size: 20px;
  --workspace-dot-base: color-mix(in srgb, var(--on-surface) 13%, transparent);
  --workspace-dot-focus: color-mix(in srgb, var(--on-surface) 42%, transparent);
  --pointer-x: 50%;
  --pointer-y: 50%;
  position: relative;
  isolation: isolate;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  background: var(--background);
}

.app-shell::before,
.app-shell::after {
  content: '';
  position: absolute;
  z-index: 0;
  inset: 0;
  pointer-events: none;
  background-size: var(--workspace-dot-size) var(--workspace-dot-size);
}

.app-shell::before {
  background-image: radial-gradient(circle, var(--workspace-dot-base) 1px, transparent 1.25px);
}

.app-shell::after {
  opacity: 0;
  background-image: radial-gradient(circle, var(--workspace-dot-focus) 1.15px, transparent 1.4px);
  -webkit-mask-image: radial-gradient(circle 150px at var(--pointer-x) var(--pointer-y), #000 0%, transparent 100%);
  mask-image: radial-gradient(circle 150px at var(--pointer-x) var(--pointer-y), #000 0%, transparent 100%);
}

.app-shell[data-pointer-active='true']::after { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .app-shell::after { display: none; }
}
```

Keep `.window-bar` fully transparent with `border-bottom: 0`, and retain `.window-bar, .studio, .welcome { position: relative; z-index: 1; }`. Remove the colored diagonal gradient and both repeating line gradients. In `studio.css` and `studio-home.css`, ensure `.studio`, `.studio-main`, `.studio-home`, and `.studio-home-create` have no full-page opaque background.

- [ ] **Step 6: Update the CSS integration contract**

Replace the old repeating-gradient assertion with exact ownership checks:

```ts
expect(windowStyles).toMatch(/\.app-shell::before\s*\{[\s\S]*radial-gradient\(circle,[\s\S]*var\(--workspace-dot-base\)/);
expect(windowStyles).toMatch(/\.app-shell::after\s*\{[\s\S]*circle 150px at var\(--pointer-x\) var\(--pointer-y\)/);
expect(windowStyles).toMatch(/\.app-shell\[data-pointer-active='true'\]::after\s*\{\s*opacity:\s*1/);
expect(windowStyles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.app-shell::after\s*\{\s*display:\s*none/);
expect(windowStyles).not.toMatch(/linear-gradient\(118deg/);
expect(homeStyles.match(/\.studio-home\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '').not.toMatch(/background:/);
```

- [ ] **Step 7: Run hook, App, and integration tests**

Run:

```bash
pnpm exec vitest run src/app/usePointerDotBackground.test.tsx src/app/App.test.tsx tests/integration/layout-contract.test.ts
```

Expected: PASS; pointer updates happen only after the queued frame and reduced motion does not queue frames.

- [ ] **Step 8: Commit the root background**

```bash
git add src/app/usePointerDotBackground.ts src/app/usePointerDotBackground.test.tsx src/app/App.tsx src/app/App.test.tsx src/app/styles/window.css src/app/styles/studio.css src/app/studio/studio-home.css tests/integration/layout-contract.test.ts
git commit -m "feat: add interactive dot workspace background"
```

### Task 6: Verify Responsive Home And End-To-End Handoff

**Files:**
- Modify: `tests/e2e/test-workspace.ts:1-125`
- Modify: `tests/e2e/studio.spec.ts:221-323`

- [ ] **Step 1: Update the shell material test to use shared selectors and no-shadow assertions**

Change the home composer selector to `.conversation-dock--expanded`, include `boxShadow` in `inspect()`, and assert:

```ts
expect(shell.projects.boxShadow === 'none' || shell.projects.boxShadow.startsWith('rgba(255, 255, 255')).toBe(true);
expect(shell.composer.boxShadow).not.toContain('14px 34px');
expect(shell.backdrop).toContain('radial-gradient');
await expect(page.getByLabel('提示词建议')).toHaveCount(0);
```

Update reduced-transparency checks to inspect `.conversation-dock--expanded` instead of `.home-conversation__composer`.

- [ ] **Step 2: Add an end-to-end pointer interaction test**

Add:

```ts
test('dot workspace follows the pointer without intercepting home controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);
  const shell = page.locator('.app-shell');
  await page.mouse.move(820, 360);
  await expect(shell).toHaveAttribute('data-pointer-active', 'true');
  const coordinates = await shell.evaluate((element) => ({
    x: element.style.getPropertyValue('--pointer-x'),
    y: element.style.getPropertyValue('--pointer-y'),
  }));
  expect(parseFloat(coordinates.x)).toBeGreaterThan(700);
  expect(parseFloat(coordinates.y)).toBeGreaterThan(250);
  await page.getByRole('textbox', { name: '设计需求' }).click();
  await expect(page.getByRole('textbox', { name: '设计需求' })).toBeFocused();
});
```

- [ ] **Step 3: Add deterministic conversation and failure options to the E2E workspace**

Change the helper signature without breaking existing callers:

```ts
type TestWorkspaceOptions = {
  conversationConnected?: boolean;
  failProjectCreation?: boolean;
  projectCount?: number;
};

export const gotoTestWorkspace = async (
  page: Page,
  scene: DesignScene | null = null,
  options: TestWorkspaceOptions = {},
): Promise<void> => {
  await page.addInitScript(({ initialScene, fixtureOptions }) => {
```

Close the existing init script with `}, { initialScene: scene, fixtureOptions: options });`. Inside the browser fixture:

```ts
const submittedTasks: Array<Record<string, unknown>> = [];

createProjectContainer: async (input: typeof createdProjectInput) => {
  if (fixtureOptions.failProjectCreation) throw new Error('PROJECT_CREATE_FAILED');
  createdProjectInput = input;
  return { projectId: 'project-created' };
},
hasCredential: async () => fixtureOptions.conversationConnected ?? false,
listActiveProjects: async () => Array.from(
  { length: fixtureOptions.projectCount ?? 1 },
  (_, index) => index === 0 ? project : {
    ...project,
    projectId: `project-e2e-${index}`,
    name: `测试项目 ${index + 1}`,
  },
),
listTasks: async () => submittedTasks,
submitConversation: async (input: { message: string; documentId?: string }) => {
  const task = {
    id: 'task-home-conversation',
    requestId: 'request-home-conversation',
    requestText: input.message,
    documentId: input.documentId,
    state: 'completed',
    cancelRequested: false,
    attempt: 1,
    analysisThreadId: 'analysis-home-conversation',
    result: { text: '已完成首轮设计分析。' },
  };
  submittedTasks.splice(0, submittedTasks.length, task);
  return task;
},
```

The default remains disconnected so unrelated tests retain their current fixture behavior.

- [ ] **Step 4: Add a reduced-motion end-to-end assertion**

Create a test context with `page.emulateMedia({ reducedMotion: 'reduce' })`, move the pointer, and assert the root does not receive `data-pointer-active`. Also inspect `getComputedStyle(shell, '::before').backgroundImage` to prove the static dot layer remains present.

- [ ] **Step 5: Exercise automatic project creation with an attachment**

Start this test with `gotoTestWorkspace(page, null, { conversationConnected: true })`. Use `setInputFiles` on “添加图片 / Add image”, fill the expanded dock, submit, then assert:

```ts
await expect(page.getByRole('region', { name: '设计画布' })).toBeVisible();
await expect(page.getByRole('form', { name: 'AI 操作坞' })).toHaveClass(/conversation-dock--compact/);
await expect(page.getByRole('textbox', { name: '修改说明' })).toHaveValue('');
await expect(page.getByText('已完成首轮设计分析。')).toBeVisible();
```

Use the existing 1×1 PNG fixture already embedded in `studio.spec.ts` so the test does not add a binary fixture.

- [ ] **Step 6: Verify failed automatic creation preserves the complete home draft**

Start with `gotoTestWorkspace(page, null, { conversationConnected: true, failProjectCreation: true })`, attach `failed-reference.png`, enter `失败后仍保留`, and submit. Assert that the app stays on the home, the textbox keeps the exact message, the attachment preview remains visible, and the inline notification says project creation failed.

- [ ] **Step 7: Verify independent scrolling and fixed home controls at 1024×720**

At a 1024×720 viewport, call `gotoTestWorkspace(page, null, { projectCount: 18 })` to make `.studio-home-projects__list` scroll. Record the bounding boxes of `.conversation-dock--expanded` and `.home-designer-rail`, scroll only the project list, and assert both bounding boxes are unchanged while the list's `scrollTop` increases and `document.documentElement.scrollWidth <= window.innerWidth` remains true.

- [ ] **Step 8: Run the focused E2E suite at both supported home sizes**

Run:

```bash
pnpm exec playwright test tests/e2e/studio.spec.ts --config playwright.config.ts
```

Expected: PASS at the existing 1280×800 scenarios, plus no horizontal overflow in the 1024×720 scenario and a successful expanded-to-compact handoff.

- [ ] **Step 9: Commit the E2E coverage**

```bash
git add tests/e2e/test-workspace.ts tests/e2e/studio.spec.ts
git commit -m "test: cover shared dock and dot workspace"
```

### Task 7: Full Verification And Diff Review

**Files:**
- Verify only; fix failures in the smallest owning file and rerun the failed command before continuing.

- [ ] **Step 1: Run the focused unit suite**

```bash
pnpm exec vitest run src/app/studio/ConversationDock.test.tsx src/app/studio/HomeConversationComposer.test.tsx src/app/studio/StudioHome.test.tsx src/app/studio/Workbench.test.tsx src/app/usePointerDotBackground.test.tsx src/app/App.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run all unit and integration tests**

```bash
pnpm test:unit
pnpm test:integration
```

Expected: both commands exit 0 with no failed tests.

- [ ] **Step 3: Run static verification**

```bash
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all four commands exit 0; lint emits zero warnings; `git diff --check` prints nothing.

- [ ] **Step 4: Run the full browser suite**

```bash
pnpm test:e2e
```

Expected: all Playwright tests PASS, including the 1024×720 and 1280×800 layout checks.

- [ ] **Step 5: Review the final diff against the approved spec**

Run:

```bash
git diff --stat
git diff -- src/app/studio/ConversationDock.tsx src/app/studio/HomeConversationComposer.tsx src/app/studio/Workbench.tsx src/app/studio/conversation-dock.css src/app/studio/studio-home.css src/app/usePointerDotBackground.ts src/app/App.tsx src/app/styles/window.css tests/integration/layout-contract.test.ts tests/e2e/studio.spec.ts
```

Confirm all of these are true before reporting completion:

- Home and canvas import the same `ConversationDock`.
- Home has no prompt suggestions or canvas-only actions.
- Failed home creation preserves message and attachment bytes.
- Project panel and both dock variants have glass borders/blur and no external shadow.
- Header has no background band or divider.
- Only `.app-shell` owns the page background.
- Static dots remain under reduced motion while pointer following is inactive.
- No colored glow, decorative gradient, or payload/task semantic change was introduced.

- [ ] **Step 6: Commit any verification-only corrections**

If verification required changes, stage only those corrected files and commit:

```bash
git add src/app tests
git commit -m "fix: close shared workspace verification gaps"
```

If no correction was required, do not create an empty commit.
