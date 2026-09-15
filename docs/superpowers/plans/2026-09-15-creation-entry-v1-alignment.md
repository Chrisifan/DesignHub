# Creation Entry V1 Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make manual project creation and portfolio-derived designer creation the only creation paths, hide Settings from the sidebar without removing Settings, and synchronize the V1 product guide.

**Architecture:** The renderer stops exposing creation-draft conversation state but keeps project-scoped conversation APIs unchanged. New designer creation always uses the existing inspected-portfolio and selection task flow; editing an existing designer remains unchanged. The documentation removes obsolete P04 and description-creation claims while keeping P07 project conversations and P20 Settings.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Electron typed preload bridge.

---

### Task 1: Make project creation manual-only

**Files:**
- Modify: `src/app/studio/types.ts`
- Modify: `src/app/studio/NewDesignPage.tsx`
- Modify: `src/app/studio/Studio.tsx`
- Test: `src/app/studio/NewDesignPage.test.tsx`
- Test: `src/app/Studio.test.tsx`

- [x] **Step 1: Replace the obsolete creation-draft Studio assertion with a manual-only assertion.**

```tsx
it('exposes only manual project creation from the projects page', async () => {
  render(<Studio locale="zh-CN" theme="system" workspace={workspace} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '项目库' })).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: '对话创建' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  expect(screen.getByRole('textbox', { name: '设计目标' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '通过对话' })).not.toBeInTheDocument();
});
```

- [x] **Step 2: Run the focused project-flow tests and observe the existing type/test mismatch.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/NewDesignPage.test.tsx src/app/Studio.test.tsx`

Expected: the stale test requiring `通过对话` fails before its replacement; `pnpm typecheck` still reports the obsolete `conversationResult` props.

- [x] **Step 3: Narrow the persisted creation mode and remove all creation-draft UI branches.**

```ts
export type CreationMode = 'manual';

const openNewDesign = (personaId?: string): void => {
  newDesignReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  setDraft((previous) => ({ ...previous, mode: 'manual', personaId: personaId ?? previous.personaId }));
  setSurface('new-design');
  setView('projects');
  setSelected(null);
  setDocumentOpen(false);
};
```

Delete `creationDraftId`, `conversationResult`, their task-polling effect, the `draft.mode === 'conversation'` submission branch, the `对话创建` toolbar action, and the unsupported props passed to `NewDesignPage`. Keep `submitProjectConversation` unchanged because it belongs to P07 after a project exists. `NewDesignPage` keeps the goal textarea, designer selection, size selection and one `创建项目` submit action.

- [x] **Step 4: Rerun focused tests and static validation.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/NewDesignPage.test.tsx src/app/Studio.test.tsx && pnpm typecheck`

Expected: focused tests and typecheck exit 0; no test references `通过对话` or a `creation-draft` source through project creation.

### Task 2: Restrict new designers to portfolio analysis

**Files:**
- Modify: `src/app/studio/DesignerLibrary.tsx`
- Modify: `src/app/studio/PersonaRepository.tsx`
- Test: `src/app/studio/DesignerLibrary.test.tsx`

- [x] **Step 1: Add a portfolio-only creation regression.**

```tsx
it('creates new designers from inspected portfolio sources only', async () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-1" />);
  fireEvent.click(await screen.findByRole('button', { name: '从作品集创建' }));
  const dialog = screen.getByRole('dialog', { name: '创建设计师' });
  expect(within(dialog).getByRole('textbox', { name: '作品集链接' })).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: '检查页面' })).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: '描述' })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('textbox', { name: '风格描述' })).not.toBeInTheDocument();
});
```

- [x] **Step 2: Run the focused designer tests and observe the description-mode failure.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx`

Expected: the new assertion fails while the create modal still offers description mode or can submit a conversation task.

- [x] **Step 3: Make the new-designer state machine portfolio-only.**

```ts
const openCreate = (): void => {
  if (readOnly || loading || loadFailed) return;
  setCandidatePhase('form');
  setRightsConfirmed(false);
  setPortfolioUrl('');
  discardPortfolioInspection();
  setSelectedCandidateId(undefined);
  setCandidateProfiles([]);
  setAnalysisTaskId(undefined);
  setArtworkTask(undefined);
  setPublishedInSession(false);
  setCreationError('');
  setEditor({ mode: 'new' });
};

const requestCandidates = async (): Promise<void> => {
  if (!rightsConfirmed || !portfolioInspection || selectedPortfolioSourceIds.length === 0 || !workspaceId) return;
  const request = getDesktopApi().submitPortfolioSelection?.({
    workspaceId,
    source: { kind: 'designer-draft', id: `designer-${crypto.randomUUID()}` },
    connectionId: 'openai-compatible',
    inspectionId: portfolioInspection.id,
    sourceIds: selectedPortfolioSourceIds,
    rightsConfirmed: true,
  });
  // Preserve the existing task-completion, candidate-review and error handlers below this request.
};
```

Remove the `creationSource` state and all `source` / `onSourceChange` props. In `DesignerEditorModal`, remove the `designer-source-tabs` element, make `CandidateReview` receive `allowExamples={false}`, remove the `mode === 'new' && source === 'portfolio'` predicate around the portfolio controls, and make the style-summary label always `风格说明` / `Style summary`. Remove the `submitConversation` request branch and every description-specific completion/progress message. Remove archive duplication/derivation actions that can create a new designer without portfolio analysis. Preserve portfolio inspection, source selection, rights confirmation, task polling, candidate review, generated artwork, publishing, and existing-profile editing. Change the repository create label and empty-state copy to `从作品集创建` / `Create from portfolio`.

- [x] **Step 4: Rerun focused designer and dependent UI tests.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx src/app/studio/PersonaRepository.test.tsx src/app/studio/LibraryPages.test.tsx`

Expected: all pass; no new-designer path calls `submitConversation`.

### Task 3: Hide only the sidebar Settings entry

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Test: `src/app/Studio.test.tsx`
- Test: `src/app/studio/LibraryPages.test.tsx`

- [x] **Step 1: Add a navigation assertion that leaves Settings renderable.**

```tsx
expect(screen.queryByRole('button', { name: '设置' })).not.toBeInTheDocument();
```

Keep the existing `LibraryPages view="settings"` harness assertion so the settings page and its non-sidebar entry points remain covered.

- [x] **Step 2: Remove only the navigation item.**

```ts
const navigation = [
  { view: 'projects', icon: 'layout-grid', zh: '项目库', en: 'Projects' },
  { view: 'designers', icon: 'users', zh: '设计师', en: 'Designers' },
  { view: 'assets', icon: 'image', zh: '素材库', en: 'Assets' },
  { view: 'brands', icon: 'palette', zh: '品牌包', en: 'Brand kits' },
  { view: 'connections', icon: 'plug', zh: '模型连接', en: 'Connections' },
  { view: 'tasks', icon: 'clock', zh: '模型任务', en: 'Model tasks' },
  { view: 'delivery', icon: 'download', zh: '导出交付', en: 'Delivery' },
  { view: 'storage', icon: 'hard-drive', zh: '工作区管理', en: 'Workspace' },
];
```

Do not remove `settings` from `View`, `LibraryPages`, settings IPC, diagnostics export, locale/theme controls, or the operator settings action.

- [x] **Step 3: Run the focused shell/settings tests.**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/Studio.test.tsx src/app/studio/LibraryPages.test.tsx src/desktop/ipc/settings.test.ts`

Expected: navigation excludes Settings, while the settings surface and its bridge contracts still pass.

### Task 4: Synchronize the V1 product documentation

**Files:**
- Modify: `docs/product/APPLICATION-GUIDE-FOR-UI.md`
- Modify: `docs/verification/MODULE-REGISTER.md`

- [x] **Step 1: Remove obsolete creation claims from the application guide.**

Replace the information architecture and P02 text so P02 says `打开项目、手动新建` and P03 says `手动新建 → 创建项目`; remove the P04 row and section; describe P11 as `图片集 / 链接 → 审阅并发布`; remove description-creation wording; update the core-journey checklist to include only manual project creation and portfolio designer creation.

- [x] **Step 2: Record the scoped change and regression evidence.**

Append a dated `UI-20260915-02` entry to `docs/verification/MODULE-REGISTER.md` that names the UI-only change, confirms that project-scoped conversations and direct Settings surfaces remain, and records the actual commands/results from Task 5. Do not claim provider, Windows, signing, or Keychain gates as complete.

### Task 5: Verify the current worktree end to end

**Files:**
- Verify only

- [x] **Step 1: Run unit, integration, lint, typecheck, build and whitespace gates.**

Run: `pnpm test:unit && pnpm test:integration && pnpm lint && pnpm typecheck && pnpm build && git diff --check`

Expected: every command exits 0.

- [x] **Step 2: Run browser and source-native smoke outside the restricted sandbox.**

Run: `pnpm test:e2e && pnpm test:native`

Expected: browser E2E passes; source Electron smoke passes and the packaged-path case is skipped only when no package path is configured.

- [x] **Step 3: Review scope.**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; changes are confined to creation entry, designer entry, sidebar navigation, their tests, and the aligned product/verification documents.
