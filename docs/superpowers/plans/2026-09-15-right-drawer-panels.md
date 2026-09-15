# Right Drawer Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace persistent detail and inspector columns with an accessible, right-side overlay drawer that opens when users select the corresponding item.

**Architecture:** A focused `Drawer` primitive owns portal rendering, focus handling, dismissal, and background scroll locking. Each library surface, CanvasWorkspace, and Workbench retains its selected-item state and moves its current right-panel markup inside that primitive. The in-flow grids contain only primary content, so it takes the complete usable width while the drawer is closed.

**Tech Stack:** React 19, TypeScript, React Testing Library, Vitest, existing CSS custom properties.

---

## File structure

- Create `src/app/studio/Drawer.tsx`: portal-based accessible overlay drawer.
- Create `src/app/studio/Drawer.test.tsx`: interaction and focus restoration coverage.
- Modify `src/app/styles/studio.css`: shared drawer visual, transition, compact, and reduced-motion rules.
- Modify `src/app/studio/LibraryPages.tsx` and `src/app/studio/library.css`: migrate asset, brand, provider, and delivery right panels.
- Modify `src/app/studio/DesignerLibrary.tsx` and `src/app/studio/persona.css`: migrate PersonaInspector.
- Modify `src/features/canvas/CanvasWorkspace.tsx` and `src/app/studio/workbench.css`: migrate the canvas Inspector.
- Modify `src/app/studio/Workbench.tsx` and `src/app/studio/workbench.css`: migrate the context panel.
- Modify the corresponding `*.test.tsx` files to cover selection opening and dismissal.

### Task 1: Create the shared Drawer

**Files:**

- Create: `src/app/studio/Drawer.test.tsx`
- Create: `src/app/studio/Drawer.tsx`
- Modify: `src/app/styles/studio.css: after .ui-dialog rules`

- [ ] **Step 1: Write a failing Drawer test.**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

it('closes a labelled drawer by button, backdrop, and Escape', () => {
  const onClose = vi.fn();
  render(<Drawer open title="素材详情" onClose={onClose}><p>内容</p></Drawer>);
  expect(screen.getByRole('dialog', { name: '素材详情' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByTestId('drawer-backdrop'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 2: Verify the test fails.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Drawer.test.tsx`

Expected: FAIL because `./Drawer` does not exist.

- [ ] **Step 3: Implement the minimal Drawer interface and behavior.**

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '../i18n';
import { IconButton, t } from './ui';

export type DrawerProps = { open: boolean; title: string; locale?: Locale; onClose: () => void; children: ReactNode };
const focusable = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export const Drawer = ({ open, title, locale = 'zh-CN', onClose, children }: DrawerProps) => {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) { returnFocusRef.current?.isConnected && returnFocusRef.current.focus({ preventScroll: true }); return; }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const targets = [...panelRef.current.querySelectorAll<HTMLElement>(focusable)];
      if (!targets.length) return;
      const first = targets[0]!; const last = targets.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); };
  }, [onClose, open]);
  if (!open) return null;
  return createPortal(<div className="ui-drawer-root"><button type="button" className="ui-drawer__backdrop" data-testid="drawer-backdrop" aria-label={t(locale, '关闭抽屉', 'Close drawer')} onClick={onClose} /><aside ref={panelRef} className="ui-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}><header className="ui-drawer__heading"><h2 id={titleId}>{title}</h2><IconButton name="x" label={t(locale, '关闭', 'Close')} onClick={onClose} /></header><div className="ui-drawer__content">{children}</div></aside></div>, document.body);
};
```

- [ ] **Step 4: Add the visual contract.**

```css
.ui-drawer-root { position: fixed; z-index: 100; inset: 0; display: flex; justify-content: flex-end; }
.ui-drawer__backdrop { position: absolute; inset: 0; border: 0; background: color-mix(in srgb, var(--surface-container-lowest) 68%, transparent); backdrop-filter: blur(3px); }
.ui-drawer { position: relative; display: flex; flex-direction: column; inline-size: min(520px, 92vw); max-block-size: 100dvh; border-left: 1px solid var(--outline-variant); background: var(--surface-container-low); box-shadow: var(--shadow-overlay); animation: drawer-enter 180ms ease-out; }
.ui-drawer__heading { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--border-subtle); }
.ui-drawer__content { min-block-size: 0; overflow-y: auto; scrollbar-gutter: stable; }
@keyframes drawer-enter { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
@media (prefers-reduced-motion: reduce) { .ui-drawer { animation: none; } }
```

- [ ] **Step 5: Add focus-restoration coverage, then run the Drawer tests green.**

```tsx
it('restores focus to the trigger after close', () => {
  const { rerender } = render(<button>春间标志</button>);
  const trigger = screen.getByRole('button', { name: '春间标志' }); trigger.focus();
  rerender(<><button>春间标志</button><Drawer open title="素材详情" onClose={vi.fn()}><p>内容</p></Drawer></>);
  rerender(<><button>春间标志</button><Drawer open={false} title="素材详情" onClose={vi.fn()}><p>内容</p></Drawer></>);
  expect(screen.getByRole('button', { name: '春间标志' })).toHaveFocus();
});
```

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Drawer.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the primitive.**

```bash
git add src/app/studio/Drawer.tsx src/app/studio/Drawer.test.tsx src/app/styles/studio.css
git commit -m "feat: add reusable right drawer"
```

### Task 2: Migrate asset and brand details

**Files:**

- Modify: `src/app/studio/LibraryPages.tsx: AssetsPage and BrandsPage`
- Modify: `src/app/studio/library.css: .library-split, .library-split--brand, .details-panel`
- Modify: `src/app/studio/LibraryPages.test.tsx`

- [ ] **Step 1: Write failing selection and dismissal tests.**

```tsx
it('opens selected asset details in a drawer', () => {
  render(<Harness initialView="assets" />);
  fireEvent.click(screen.getByRole('button', { name: /春间标志/ }));
  expect(screen.getByRole('dialog', { name: '素材详情' })).toHaveTextContent('春间标志');
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog', { name: '素材详情' })).not.toBeInTheDocument();
});

it('opens selected brand details in a drawer', () => {
  render(<Harness initialView="brands" />);
  fireEvent.click(screen.getAllByRole('button', { name: /春间/ })[0]!);
  expect(screen.getByRole('dialog', { name: '品牌详情' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify both tests fail.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx -t "drawer"`

Expected: FAIL because asset and brand details are in-flow asides.

- [ ] **Step 3: Keep selection state, add local reveal state, and use the shared Drawer.**

```tsx
const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
const selectAsset = (id: string) => { onSelect(id); setAssetDrawerOpen(true); };
// Asset-card onClick={(): void => selectAsset(item.id)}

const [brandDrawerOpen, setBrandDrawerOpen] = useState(false);
const selectBrand = (id: string) => { onSelect(id); setBrandDrawerOpen(true); };
// Brand-row onClick={(): void => selectBrand(brand.id)}
```

Replace the asset detail aside currently at `LibraryPages.tsx:375-417` with `Drawer(open={assetDrawerOpen && Boolean(selected)}, title=素材详情, onClose=setAssetDrawerOpen(false))` and place that exact aside, including its preview, metadata, action buttons, and preview note, inside it unchanged. Replace the brand detail aside at `LibraryPages.tsx:529-571` the same way with `brandDrawerOpen`, title `品牌详情`, and its existing edit/delete actions unchanged. Do not create a drawer for failed or empty states.

- [ ] **Step 4: Remove only the detail grid track; do not remove existing empty/error states.**

```css
.library-split,
.library-split--wide,
.library-split--brand { grid-template-columns: minmax(0, 1fr); }
.details-panel { border-left: 0; }
.ui-drawer .details-panel { min-height: 100%; padding: 24px; }
```

- [ ] **Step 5: Run the whole LibraryPages suite.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx`

Expected: PASS; managed asset actions and brand edit/delete controls remain usable inside the drawer.

- [ ] **Step 6: Commit.**

```bash
git add src/app/studio/LibraryPages.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/library.css
git commit -m "feat: show library details in drawers"
```

### Task 3: Migrate provider and delivery configuration

**Files:**

- Modify: `src/app/studio/LibraryPages.tsx: ConnectionsPage and DeliveryPage`
- Modify: `src/app/studio/library.css: connection and delivery layouts`
- Modify: `src/app/studio/LibraryPages.test.tsx`

- [ ] **Step 1: Write failing configuration-drawer tests.**

```tsx
it('opens provider configuration when a capability is selected', async () => {
  render(<Harness initialView="connections" />);
  fireEvent.click(await screen.findByRole('button', { name: '图片生成与编辑' }));
  expect(screen.getByRole('dialog', { name: '连接配置' })).toHaveTextContent('图片生成与编辑');
});

it('shows delivery configuration in a drawer for an active project', () => {
  render(<Harness initialView="delivery" deliveryProject={project} />);
  expect(screen.getByRole('dialog', { name: '导出配置' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify the tests fail.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx -t "configuration"`

Expected: FAIL because configuration remains a grid column.

- [ ] **Step 3: Open a provider drawer from a matrix selection and keep provider state unchanged.**

```tsx
const [providerDrawerOpen, setProviderDrawerOpen] = useState(false);
const selectProfile = (profile: ProviderProfile) => { setActiveProfile(profile); setProviderDrawerOpen(true); };
// matrix-profile-button onClick={(): void => selectProfile(profile)}
```

Replace the `ProviderSettings` child currently at `LibraryPages.tsx:644-666` with the same element inside `Drawer(open={providerDrawerOpen}, title=连接配置, onClose=setProviderDrawerOpen(false))`; retain every existing callback prop and replace only `onActiveProfileChange` with `selectProfile`.

- [ ] **Step 4: Open delivery configuration when the route supplies a project, then preserve manual close.**

```tsx
const [deliveryDrawerOpen, setDeliveryDrawerOpen] = useState(Boolean(project));
useEffect(() => { setDeliveryDrawerOpen(Boolean(project)); }, [project?.id]);
```

Wrap the existing `delivery-config` div at `LibraryPages.tsx:1015` through its closing tag in `Drawer(open={deliveryDrawerOpen && Boolean(project)}, title=导出配置, onClose=setDeliveryDrawerOpen(false))`. Keep the format picker, source fields, archive checkbox, export button, and export history behavior unchanged.

- [ ] **Step 5: Keep only the primary connection/delivery content in flow.**

```css
.connection-layout,
.delivery-layout { grid-template-columns: minmax(0, 1fr); }
.connection-layout > .empty-state,
.connection-layout > .capability-matrix { grid-column: 1; border-right: 0; }
.ui-drawer .provider-settings,
.ui-drawer .delivery-config { padding: 28px; border-left: 0; }
```

- [ ] **Step 6: Run the full LibraryPages suite and commit.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx`

Expected: PASS; provider persistence, export-format, and disabled-export tests remain green.

```bash
git add src/app/studio/LibraryPages.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/library.css
git commit -m "feat: move configuration panels into drawers"
```

### Task 4: Migrate the designer inspector

**Files:**

- Modify: `src/app/studio/DesignerLibrary.tsx`
- Modify: `src/app/studio/persona.css`
- Modify: `src/app/studio/DesignerLibrary.test.tsx`

- [ ] **Step 1: Write the failing test.**

```tsx
it('opens selected designer inspection in a drawer', () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} preview initialProfiles={personaProfiles} />);
  fireEvent.click(screen.getByRole('button', { name: /纸感排版/ }));
  expect(screen.getByRole('dialog', { name: '设计师检查器' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog', { name: '设计师检查器' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify red.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx -t "drawer"`

Expected: FAIL because PersonaInspector is in a persistent split layout.

- [ ] **Step 3: Make selection reveal the existing PersonaInspector through Drawer.**

```tsx
const [inspectorOpen, setInspectorOpen] = useState(false);
const selectProfile = (id: string) => { setSelectedId(id); setInspectorOpen(true); };
```

Pass `onSelect={selectProfile}` to the existing `PersonaRepository` at `DesignerLibrary.tsx:764-775`. Move the existing `PersonaInspector` invocation at `DesignerLibrary.tsx:776-813` into `Drawer(open={inspectorOpen && Boolean(selected)}, title=设计师检查器, onClose=setInspectorOpen(false))`, retaining every current prop and callback unchanged.

- [ ] **Step 4: Make the repository the only in-flow designer column.**

```css
.library-split--designer { grid-template-columns: minmax(0, 1fr); }
.designer-library-page .persona-repository { min-height: var(--content-panel-min-height); }
.ui-drawer .persona-inspector { min-height: 100%; }
```

- [ ] **Step 5: Run designer and inspector suites, then commit.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx src/app/studio/PersonaInspector.test.tsx`

Expected: PASS; edit/archive/restore/read-only flows remain available.

```bash
git add src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/persona.css
git commit -m "feat: open designer inspector in drawer"
```

### Task 5: Migrate the CanvasWorkspace Inspector

**Files:**

- Modify: `src/features/canvas/CanvasWorkspace.tsx`
- Modify: `src/features/canvas/CanvasWorkspace.test.tsx`
- Modify: `src/app/studio/workbench.css: canvas workspace layout`

- [ ] **Step 1: Write the failing selection test.**

```tsx
it('opens the inspector drawer for a selected layer and closes it when selection clears', () => {
  render(<CanvasWorkspace locale="zh-CN" scene={editable} />);
  fireEvent.click(screen.getByText('标题'));
  expect(screen.getByRole('dialog', { name: '检查器' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('region', { name: '画布' }));
  expect(screen.queryByRole('dialog', { name: '检查器' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify red.**

Run: `pnpm vitest run --config vitest.config.ts src/features/canvas/CanvasWorkspace.test.tsx -t "drawer"`

Expected: FAIL because Inspector is the third canvas grid column.

- [ ] **Step 3: Derive visibility from selected IDs and preserve selection after manual drawer close.**

```tsx
const [inspectorDismissed, setInspectorDismissed] = useState(false);
const select = (ids: string[]) => { setSelectedIds(selectLayerIds(scene, ids)); setInspectorDismissed(false); };
const inspectorOpen = selectedIds.length > 0 && !inspectorDismissed;
<Drawer open={inspectorOpen} title={messages.canvasInspector} locale={locale} onClose={() => setInspectorDismissed(true)}>
  <Inspector locale={locale} layer={selectedLayer} selectedLayers={selectedLayers} onChange={updateLayer} onChangeMany={updateLayers} readOnly={readOnly} />
</Drawer>
```

- [ ] **Step 4: Remove the in-flow inspector track.**

```css
.canvas-workspace__body { grid-template-columns: 180px minmax(0, 1fr); }
.ui-drawer .canvas-inspector { min-height: 100%; padding: 20px; border-left: 0; }
```

- [ ] **Step 5: Run the canvas suite and commit.**

Run: `pnpm vitest run --config vitest.config.ts src/features/canvas/CanvasWorkspace.test.tsx src/features/canvas/TextEditor.test.tsx`

Expected: PASS; persistence and multi-selection editing work from within the drawer.

```bash
git add src/features/canvas/CanvasWorkspace.tsx src/features/canvas/CanvasWorkspace.test.tsx src/app/studio/workbench.css
git commit -m "feat: show canvas inspector in drawer"
```

### Task 6: Migrate the Workbench context panel

**Files:**

- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/Workbench.test.tsx`
- Modify: `src/app/studio/workbench.css: .workbench-body and .workbench-context`

- [ ] **Step 1: Write the failing context-drawer test.**

```tsx
it('opens a workbench context drawer without narrowing the canvas', () => {
  render(<Workbench {...makeProps()} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  expect(screen.getByRole('dialog', { name: '工具' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog', { name: '工具' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify red.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Workbench.test.tsx -t "drawer"`

Expected: FAIL because workbench context is an in-flow aside.

- [ ] **Step 3: Separate the active context from its visibility.**

```tsx
const [panel, setPanel] = useState<ContextPanel>('properties');
const [panelOpen, setPanelOpen] = useState(true);
const showPanel = (next: ContextPanel) => { setPanel(next); setPanelOpen(true); };
// Replace setPanel(next) in context selector actions with showPanel(next).
```

Wrap the existing `workbench-context` aside from `Workbench.tsx:696` through its matching closing tag in `Drawer(open={panelOpen}, title={panelCopy[panel].label}, onClose=setPanelOpen(false))`. Remove its existing internal close IconButton because the Drawer supplies the single accessible close control; retain every conditional properties, conversation, history, and tools branch unchanged.

- [ ] **Step 4: Keep only left tools/layers and canvas in the in-flow grid.**

```css
.workbench-body,
.workbench-body--panel-closed { grid-template-columns: 248px minmax(0, 1fr); }
.ui-drawer .workbench-context { min-height: 100%; border-left: 0; }
.ui-drawer .workbench-context__content { min-height: 0; overflow-y: auto; }
```

- [ ] **Step 5: Run tests and commit.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Workbench.test.tsx`

Expected: PASS; properties, conversation, history, and tools remain reachable within the drawer.

```bash
git add src/app/studio/Workbench.tsx src/app/studio/Workbench.test.tsx src/app/studio/workbench.css
git commit -m "feat: move workbench context into drawer"
```

### Task 7: Full verification and visual inspection

**Files:**

- Modify only files required to correct a reproduced verification failure.

- [ ] **Step 1: Run static and complete unit verification.**

Run: `pnpm lint && pnpm typecheck && pnpm test:unit`

Expected: every command exits 0 without warnings or failures.

- [ ] **Step 2: Run browser verification.**

Run: `pnpm test:e2e`

Expected: Playwright exits 0. Update a screenshot expectation only after verifying it reflects the intended overlay behavior.

- [ ] **Step 3: Inspect the desktop behavior manually.**

Run: `pnpm start`

Expected: selecting an asset, brand, designer, provider capability, canvas layer, and workbench context opens a right-side overlay; backdrop, Escape, and the close control dismiss it; the main content stays full width while closed.

- [ ] **Step 4: Check the final diff and commit only verified corrections.**

```bash
git diff --check
git status --short
git diff -- src/app/studio src/features/canvas
git add src/app/studio/Drawer.tsx src/app/styles/studio.css
git commit -m "fix: polish drawer panel integration"
```
