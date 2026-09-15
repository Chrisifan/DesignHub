# 创作入口收敛 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove project conversation creation, constrain new designer creation to portfolio analysis, and hide only the left-sidebar settings menu entry while preserving settings and in-project conversations.

**Architecture:** Keep existing IPC, task-service, portfolio inspection, and settings components intact. Converge only the Studio and DesignerLibrary presentation/state transitions so manual project briefs remain the sole project creation path and portfolio analysis is the sole new-designer path.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing DesignHub desktop bridge.

---

### Task 1: Remove conversation creation from the project flow

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/studio/NewDesignPage.tsx`
- Modify: `src/app/studio/types.ts`
- Test: `src/app/studio/NewDesignPage.test.tsx`
- Test: `src/app/Studio.test.tsx`

- [ ] **Step 1: Update NewDesignPage tests to assert the manual-only form**

Replace the conversation-mode tests with assertions that the creation-mode tab, chat copy, and conversation review are absent while the creative brief remains editable:

```tsx
it('shows only the manual project brief flow', () => {
  render(<NewDesignHarness />);
  expect(screen.queryByRole('button', { name: '通过对话' })).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: '创建方式' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '设计目标' })).toBeInTheDocument();
  expect(screen.queryByText('模型已整理简报')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused NewDesignPage test and verify it fails**

Run: `pnpm exec vitest run src/app/studio/NewDesignPage.test.tsx`

Expected: FAIL because the current component still renders the conversation tab and mode-dependent props.

- [ ] **Step 3: Make NewDesignPage manual-only**

In `src/app/studio/NewDesignPage.tsx`, remove `conversationResult`, `onConfirmConversation`, `setMode`, the `form-tabs` group, the conversation conditional, and the conversation-specific submit label/icon. Render one `设计目标` textarea and keep the existing designer selector and size selector. Keep `draft.mode` accepted only for compatibility, but never branch on it.

In `src/app/studio/types.ts`, narrow `CreationMode` to `'manual'` so persisted drafts remain structurally compatible while conversation is no longer a valid UI mode.

- [ ] **Step 4: Remove the Studio project conversation entry and branch**

In `src/app/studio/Studio.tsx`:

- Delete `creationDraftId` and `conversationResult` state plus the effect that polls `creation-draft` tasks.
- Remove the `draft.mode === 'conversation'` branch from `createProject`; always validate size and create the project through `createProjectContainer` or the preview path.
- Change `openNewDesign` to accept only an optional `personaId`, and call it from the remaining “新建项目” action.
- Remove the toolbar `Button` labeled `对话创建` / `Create with chat`.
- Stop passing conversation props to `NewDesignPage`.
- Remove conversation-result resets while retaining `mode: 'manual'` in draft resets.

- [ ] **Step 5: Update Studio tests for the removed entry**

Delete or rewrite tests that click `通过对话` or assert project creation submits `submitConversation`. Add an assertion in the projects view that `screen.queryByRole('button', { name: '对话创建' })` is absent and that clicking `新建项目` still renders the manual `设计目标` field.

- [ ] **Step 6: Run focused project-flow tests**

Run: `pnpm exec vitest run src/app/studio/NewDesignPage.test.tsx src/app/Studio.test.tsx`

Expected: PASS.

### Task 2: Constrain new designer creation to portfolio analysis

**Files:**
- Modify: `src/app/studio/DesignerLibrary.tsx`
- Modify: `src/app/studio/PersonaRepository.tsx`
- Test: `src/app/studio/DesignerLibrary.test.tsx`

- [ ] **Step 1: Add a regression test for the portfolio-only new-designer modal**

Open the designer create action and assert the description source tab and style-description field are absent, while portfolio controls remain:

```tsx
it('opens new designer creation in portfolio analysis mode only', async () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-1" />);
  fireEvent.click(await screen.findByRole('button', { name: '创建' }));
  expect(screen.queryByRole('button', { name: '描述' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: '风格描述' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '作品集链接' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '检查页面' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused designer test and verify it fails**

Run: `pnpm exec vitest run src/app/studio/DesignerLibrary.test.tsx`

Expected: FAIL because the modal currently renders the description tab and permits `submitConversation`.

- [ ] **Step 3: Fix the new-designer state machine**

In `src/app/studio/DesignerLibrary.tsx`:

- Remove `creationSource` state and make `openCreate` initialize the portfolio inspection state directly.
- Make `requestCandidates` validate rights, inspected sources, and workspace exactly as the current portfolio branch does, then call only `submitPortfolioSelection`.
- Remove the `submitConversation` branch and description-specific status messages.
- Pass a fixed portfolio source to `DesignerEditorModal`; remove the source tabs and description fields from its `mode === 'new'` rendering. Keep the existing draft fields for `mode === 'edit'`.
- Keep inspection buttons for HTTPS page/image, local images, and ZIP, plus source checkboxes and rights confirmation.
- Disable example candidate fallback for new designers without a workspace; publishing must use an analyzed candidate.
- Update page and empty-state copy to say that designers are generated from imported portfolios.

- [ ] **Step 4: Remove the repository’s ambiguous create affordance copy**

In `src/app/studio/PersonaRepository.tsx`, retain the create icon/button but change its accessible label/title to `从作品集创建` / `Create from portfolio`. Change the empty-state description to `导入作品集并完成 AI 分析后会显示在这里。` / `Import a portfolio and complete AI analysis to see profiles here.`

- [ ] **Step 5: Update DesignerLibrary tests**

Rewrite description-based tests to use the existing portfolio inspection fixture and `submitPortfolioSelection`. Keep tests covering rights confirmation, source selection, candidate review, artwork generation, publish persistence, task polling, and failure handling. Add an assertion that `submitConversation` is not called by new-designer creation.

- [ ] **Step 6: Run focused designer tests**

Run: `pnpm exec vitest run src/app/studio/DesignerLibrary.test.tsx src/app/studio/LibraryPages.test.tsx`

Expected: PASS.

### Task 3: Hide only the sidebar settings menu entry and run regression checks

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Test: `src/app/Studio.test.tsx`
- Test: `src/app/studio/LibraryPages.test.tsx`

- [ ] **Step 1: Add a sidebar navigation regression assertion**

Render the Studio shell and assert that the sidebar has no button named `设置`, while the settings surface remains renderable through the existing `LibraryPages view="settings"` test harness.

- [ ] **Step 2: Remove only the settings item from the navigation array**

In `src/app/studio/Studio.tsx`, delete the `{ view: 'settings', icon: 'settings', zh: '设置', en: 'Settings' }` entry. Preserve the `View` union, `LibraryPages` settings rendering, settings IPC, theme/locale controls, and the existing bottom operator block unless the test shows it is coupled to the removed nav item.

- [ ] **Step 3: Run the full relevant test set**

Run: `pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/NewDesignPage.test.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/LibraryPages.test.tsx src/features/agent/task-service.test.ts src/desktop/ipc/settings.test.ts`

Expected: PASS with no changes to settings or in-project conversation behavior.

- [ ] **Step 4: Run typecheck/build validation**

Run: `pnpm exec tsc --noEmit` and `pnpm run build`

Expected: both commands exit with code 0.

- [ ] **Step 5: Review the diff for scope**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only the planned component/test/plan/spec files are changed, and pre-existing user modifications remain untouched.
