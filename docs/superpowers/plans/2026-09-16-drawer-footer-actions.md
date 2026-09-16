# Drawer Footer Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed, non-scrolling action footer to shared drawers and move each drawer's panel-level actions into it.

**Architecture:** Extend `Drawer` with an optional `footer` node rendered outside its scroll container. Consumers provide footer action groups explicitly. `ProviderSettings` exposes its internal save/test handlers through a render prop so those actions can be rendered by the parent Drawer footer without duplicating state.

**Tech Stack:** React 19, TypeScript, ReactDOM portals, Vitest, Testing Library, CSS.

---

### Task 1: Add failing shared Drawer footer tests

**Files:**
- Modify: `src/app/studio/Drawer.test.tsx`

- [ ] **Step 1: Write tests for footer placement and omission**

Add tests proving the footer is a sibling of the scroll container and is absent when no footer is passed:

```tsx
it('renders footer actions outside the independently scrolling content region', () => {
  render(
    <Drawer
      open
      title="连接配置"
      onClose={() => undefined}
      footer={<button type="button">保存配置</button>}
    >
      <p>长内容</p>
    </Drawer>,
  );

  const dialog = screen.getByRole('dialog', { name: '连接配置' });
  const footer = screen.getByRole('button', { name: '保存配置' }).closest('.ui-drawer__footer');
  expect(footer).toBeInTheDocument();
  expect(footer?.parentElement).toBe(dialog);
  expect(footer).not.toBe(dialog.querySelector('.ui-drawer__content'));
});

it('does not render an empty footer when no actions are provided', () => {
  render(<Drawer open title="素材详情" onClose={() => undefined}><p>内容</p></Drawer>);
  expect(screen.getByRole('dialog', { name: '素材详情' }).querySelector('.ui-drawer__footer')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and verify the new footer test fails**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Drawer.test.tsx -t "footer"`

Expected: the placement test fails because `DrawerProps` has no `footer` and no footer DOM region exists; the omission test passes.

### Task 2: Implement the shared footer API and styles

**Files:**
- Modify: `src/app/studio/Drawer.tsx`
- Modify: `src/app/styles/studio.css`

- [ ] **Step 1: Add the optional footer prop and markup**

Extend `DrawerProps` with `footer?: ReactNode`. Render the footer after `.ui-drawer__content` only when `footer` is truthy:

```tsx
<div className="ui-drawer__content">{children}</div>
{footer ? <div className="ui-drawer__footer">{footer}</div> : null}
```

- [ ] **Step 2: Add non-scrolling footer styles**

Add the following rules after `.ui-drawer__content`:

```css
.ui-drawer__footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-container-low);
}
.ui-drawer__footer .dialog-actions,
.ui-drawer__footer .asset-detail-actions,
.ui-drawer__footer .persona-inspector__actions,
.ui-drawer__footer .provider-profile-actions-row,
.ui-drawer__footer .workbench-compose__actions {
  margin: 0;
}
```

- [ ] **Step 3: Run shared tests**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Drawer.test.tsx`

Expected: all Drawer tests pass.

- [ ] **Step 4: Commit the shared footer**

```bash
git add src/app/studio/Drawer.tsx src/app/studio/Drawer.test.tsx src/app/styles/studio.css
git commit -m "feat: add fixed drawer action footer"
```

### Task 3: Move library and designer actions into footers

**Files:**
- Modify: `src/app/studio/LibraryPages.tsx`
- Modify: `src/app/studio/DesignerLibrary.tsx`
- Test: `src/app/studio/LibraryPages.test.tsx`
- Test: `src/app/studio/DesignerLibrary.test.tsx`

- [ ] **Step 1: Add failing placement assertions**

After each existing drawer-opening assertion, assert the primary action group is inside `.ui-drawer__footer`, for example:

```tsx
const details = screen.getByRole('dialog', { name: '素材详情' });
expect(details.querySelector('.asset-detail-actions')?.closest('.ui-drawer__footer')).toBeInTheDocument();
```

Add equivalent assertions for `.brand-actions` and `.persona-inspector__actions`.

- [ ] **Step 2: Move asset, brand, and persona action groups**

Remove each action group from its content child and pass it through the corresponding `Drawer footer={...}` prop, preserving every existing callback, label, icon, and disabled condition. Keep informational notes in the scrolling content. Apply the same structure to delivery configuration: move `.export-bar` into the footer and keep export-history re-export controls on their records.

- [ ] **Step 3: Run focused tests**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx src/app/studio/DesignerLibrary.test.tsx`

Expected: all existing interactions pass and the new placement assertions pass.

- [ ] **Step 4: Commit library and designer migrations**

```bash
git add src/app/studio/LibraryPages.tsx src/app/studio/DesignerLibrary.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/DesignerLibrary.test.tsx
git commit -m "feat: move library drawer actions to footer"
```

### Task 4: Expose provider panel actions to the Drawer footer

**Files:**
- Modify: `src/features/providers/ProviderSettings.tsx`
- Modify: `src/app/studio/LibraryPages.tsx`
- Test: `src/features/providers/ProviderSettings.test.tsx`
- Test: `src/app/studio/LibraryPages.test.tsx`

- [ ] **Step 1: Add a render prop for panel-level provider actions**

Add this prop type:

```tsx
export type ProviderSettingsActions = {
  saveConfig: () => void;
  testImageGeneration: () => void;
  testBusy: boolean;
  canTestImage: boolean;
};
export type ProviderSettingsProps = {
  locale: Locale;
  connections: readonly ProviderConnection[];
  onStoreCredential: (connectionId: string, secret: string) => Promise<boolean>;
  onDeleteCredential: (connectionId: string) => Promise<boolean>;
  onCheckCredential?: (connectionId: string) => Promise<boolean>;
  configs?: ProviderConfigMap;
  onSaveProviderConfig?: (connectionId: string, config: ProviderConfig) => Promise<boolean>;
  onTestImageGeneration?: (connectionId: string, input: { prompt: string; model?: string; size?: string }) => Promise<ImageGenerationTestResult | null>;
  activeProfile?: ProviderProfile;
  onActiveProfileChange?: (profile: ProviderProfile) => void;
  renderActions?: (actions: ProviderSettingsActions) => ReactNode;
};
```

Build `canTestImage` from the existing image configuration conditions. When `renderActions` is present, render its result instead of the current `.provider-profile-actions-row`; otherwise preserve the current inline actions for standalone ProviderSettings consumers.

- [ ] **Step 2: Render provider actions through the connection Drawer footer**

Pass `renderActions={(actions) => <div className="provider-profile-actions-row">...</div>}` to `ProviderSettings` and place the returned node in the Drawer `footer` prop. Preserve the existing save/test labels, icons, busy state, and callbacks.

- [ ] **Step 3: Add placement assertions and run focused tests**

Assert the provider profile action row is under `.ui-drawer__footer`; run:

`pnpm vitest run --config vitest.config.ts src/features/providers/ProviderSettings.test.tsx src/app/studio/LibraryPages.test.tsx`

Expected: existing standalone ProviderSettings tests and connection drawer tests pass.

- [ ] **Step 4: Commit provider migration**

```bash
git add src/features/providers/ProviderSettings.tsx src/features/providers/ProviderSettings.test.tsx src/app/studio/LibraryPages.tsx src/app/studio/LibraryPages.test.tsx
git commit -m "feat: move provider panel actions to drawer footer"
```

### Task 5: Move workbench panel-level actions into the footer

**Files:**
- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/workbench.css`
- Test: `src/app/studio/Workbench.test.tsx`

- [ ] **Step 1: Add failing placement assertions**

For conversation and history panels, assert `.workbench-compose__actions` and the save-version button are descendants of `.ui-drawer__footer`; keep history-item and tool-entry action groups in their list items.

- [ ] **Step 2: Pass panel-level action groups through `Drawer footer`**

Move the conversation form action group and history panel save-version button into footer nodes selected by `panel`. Keep the form fields, history list, and tool-entry controls inside `.ui-drawer__content`.

- [ ] **Step 3: Run focused Workbench tests**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Workbench.test.tsx`

Expected: existing context panel behavior passes and panel-level action placement assertions pass.

- [ ] **Step 4: Commit Workbench migration**

```bash
git add src/app/studio/Workbench.tsx src/app/studio/workbench.css src/app/studio/Workbench.test.tsx
git commit -m "feat: move workbench actions to drawer footer"
```

### Task 6: Verify the complete change

**Files:**
- Verify: `src/app/studio/Drawer.tsx`
- Verify: `src/app/studio/LibraryPages.tsx`
- Verify: `src/features/providers/ProviderSettings.tsx`
- Verify: `src/app/studio/DesignerLibrary.tsx`
- Verify: `src/app/studio/Workbench.tsx`

- [ ] **Step 1: Run complete unit tests**

Run: `pnpm test:unit`

Expected: exit code 0 with all tests passing.

- [ ] **Step 2: Run static checks and build**

Run: `pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 3: Run browser verification**

Run: `pnpm playwright test --config playwright.config.ts tests/e2e/connections-layout.spec.ts`

Expected: connection drawer remains within the studio work area, has no horizontal overflow, and its action footer remains visible in the captured layout.

- [ ] **Step 4: Inspect final status**

Run: `git status --short && git diff HEAD~4..HEAD --check`

Expected: only drawer footer implementation changes are present; preserve the pre-existing `src/app/studio/library.css` modification.
