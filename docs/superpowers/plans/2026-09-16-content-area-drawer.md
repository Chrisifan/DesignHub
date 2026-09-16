# Content-Area Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope shared right drawers to the `studio-main` work area so the window bar and left navigation remain visible.

**Architecture:** Mark `.studio-main` as the drawer host. `Drawer` portals to that host when it exists and falls back to `document.body` for isolated consumers and tests. The drawer root becomes absolute within its host while preserving its existing interaction and visual behavior.

**Tech Stack:** React 19, TypeScript, ReactDOM `createPortal`, Vitest, Testing Library, CSS.

---

### Task 1: Add a failing host-boundary regression test

**Files:**
- Modify: `src/app/studio/Drawer.test.tsx`
- Test target: `src/app/studio/Drawer.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that renders a drawer inside a marked host and asserts the portal root is mounted under that host:

```tsx
it('mounts the open drawer inside the studio work-area host', () => {
  const { container } = render(
    <div data-drawer-host>
      <Drawer open title="连接配置" onClose={() => undefined}>
        <p>内容</p>
      </Drawer>
    </div>,
  );

  const host = container.firstElementChild;
  expect(host).toHaveAttribute('data-drawer-host');
  expect(host?.querySelector('.ui-drawer-root')).toBeInTheDocument();
  expect(document.body.querySelector(':scope > .ui-drawer-root')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the intended reason**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Drawer.test.tsx -t "studio work-area host"`

Expected: FAIL because the current `Drawer` always portals to `document.body`.

### Task 2: Implement host-aware portal targeting

**Files:**
- Modify: `src/app/studio/Drawer.tsx:1-103`

- [ ] **Step 1: Resolve the host and portal target**

In `Drawer`, resolve `document.querySelector<HTMLElement>('[data-drawer-host]')` when rendering an open drawer and use it as the `createPortal` target; use `document.body` when no host is present. Keep the existing `open` early return, focus effect, and event handling unchanged.

The portal tail should be equivalent to:

```tsx
  if (!open) return null;

  const portalTarget = document.querySelector<HTMLElement>('[data-drawer-host]') ?? document.body;

  return createPortal(
    <div className="ui-drawer-root">
      <button
        type="button"
        className="ui-drawer__backdrop"
        data-testid="drawer-backdrop"
        aria-label={t(locale, '关闭抽屉', 'Close drawer')}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className="ui-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="ui-drawer__heading">
          <h2 id={titleId}>{title}</h2>
          <IconButton name="x" label={t(locale, '关闭', 'Close')} onClick={onClose} />
        </header>
        <div className="ui-drawer__content">{children}</div>
      </aside>
    </div>,
    portalTarget,
  );
```

- [ ] **Step 2: Run the focused Drawer tests**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Drawer.test.tsx`

Expected: PASS for the new host test and both existing close/focus tests; the existing tests prove the body fallback remains functional.

- [ ] **Step 3: Commit the component and regression test**

```bash
git add src/app/studio/Drawer.tsx src/app/studio/Drawer.test.tsx
git commit -m "feat: portal drawers into studio work area"
```

### Task 3: Mark the studio work area and scope drawer CSS

**Files:**
- Modify: `src/app/studio/Studio.tsx:775`
- Modify: `src/app/styles/studio.css:771-798`

- [ ] **Step 1: Mark `.studio-main` as the stable host**

Change the existing wrapper to:

```tsx
<div className="studio-main" data-drawer-host>
```

Do not move the wrapper or alter its grid rows.

- [ ] **Step 2: Make the drawer root fill its host**

Update the shared drawer root rules to use host-relative positioning:

```css
.studio-main {
  position: relative;
}
.ui-drawer-root {
  position: absolute;
  z-index: 100;
  inset: 0;
  display: flex;
  justify-content: flex-end;
}
.ui-drawer {
  position: relative;
  display: flex;
  flex-direction: column;
  inline-size: min(520px, 92vw);
  max-block-size: 100%;
  border-left: 1px solid var(--outline-variant);
  background: var(--surface-container-low);
  box-shadow: var(--shadow-overlay);
  animation: drawer-appear 180ms ease-out;
}
```

Keep `.ui-drawer__backdrop` absolute with `inset: 0`; its containing block is now the host-scoped root. Do not change width, colors, animation, or content scrolling.

- [ ] **Step 3: Run typecheck and focused integration tests**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Drawer.test.tsx src/app/studio/Workbench.test.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/DesignerLibrary.test.tsx src/features/canvas/CanvasWorkspace.test.tsx`

Expected: PASS with all existing drawer interactions intact.

- [ ] **Step 4: Commit the host and CSS changes**

```bash
git add src/app/studio/Studio.tsx src/app/styles/studio.css
git commit -m "fix: constrain drawers to studio work area"
```

### Task 4: Verify the complete change

**Files:**
- Verify: `src/app/studio/Drawer.tsx`
- Verify: `src/app/studio/Studio.tsx`
- Verify: `src/app/styles/studio.css`

- [ ] **Step 1: Run the complete unit suite**

Run: `pnpm test:unit`

Expected: exit code 0 with no failed tests.

- [ ] **Step 2: Run static checks**

Run: `pnpm typecheck && pnpm lint`

Expected: both commands exit 0 with no TypeScript errors or ESLint warnings.

- [ ] **Step 3: Inspect the final diff and working tree**

Run: `git diff HEAD~2..HEAD -- src/app/studio/Drawer.tsx src/app/studio/Drawer.test.tsx src/app/studio/Studio.tsx src/app/styles/studio.css && git status --short`

Expected: only the host-aware portal, host marker, scoped positioning, and focused regression test are present; unrelated existing changes remain untouched.

- [ ] **Step 4: Manually verify both sidebar states**

Open a connection or detail drawer in the desktop app with the sidebar expanded and collapsed. Confirm the backdrop begins at the right work-area edge, the window bar and left navigation remain undimmed, and the panel reaches the bottom of the work area while its content scrolls independently.
