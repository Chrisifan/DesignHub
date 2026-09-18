# Canvas Workbench Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the canvas workspace into the approved reference-style functional layout without changing DesignHub's theme or editing behavior.

**Architecture:** Keep `Workbench` as the owner of editing, prompt, revision, and panel state, but replace its in-flow columns with a canvas-first shell and overlay controls. Add an embedded presentation to `CanvasWorkspace` so workspace-backed documents do not render duplicate headers and permanent side columns. Reuse the existing `Drawer` only for detailed history and image-tool flows.

**Tech Stack:** React 19, TypeScript, CSS custom properties, React Konva, Vitest, Testing Library, Playwright.

---

## File Structure

- Modify `src/app/studio/Workbench.tsx`: canvas-first DOM structure, floating panels, rulers, side rails, and bottom command dock.
- Modify `src/app/studio/workbench.css`: layout, overlays, ruler ticks, dock, responsive constraints, and embedded canvas rules.
- Modify `src/app/studio/Workbench.test.tsx`: interaction and accessibility coverage for the reorganized controls.
- Modify `src/features/canvas/CanvasWorkspace.tsx`: add an embedded presentation contract for the workbench host.
- Modify `src/features/canvas/CanvasWorkspace.test.tsx`: ensure embedded mode removes duplicate chrome while keeping the scene stage.
- Modify `tests/e2e/studio.spec.ts`: verify desktop and compact geometry, overflow, and screenshots.

### Task 1: Lock the canvas-first interaction contract

**Files:**

- Modify: `src/app/studio/Workbench.test.tsx`

- [ ] **Step 1: Replace drawer-specific conversation and property expectations with the approved surface semantics.**

Add focused coverage equivalent to:

```tsx
it('lays out the workbench around one canvas surface', () => {
  render(<Workbench {...makeProps()} />);

  const canvas = screen.getByRole('region', { name: '设计画布' });
  expect(canvas.querySelector('.workbench-ruler--horizontal')).toBeInTheDocument();
  expect(canvas.querySelector('.workbench-ruler--vertical')).toBeInTheDocument();
  expect(screen.getByRole('toolbar', { name: '画布工具' })).toBeInTheDocument();
  expect(screen.getByRole('toolbar', { name: '上下文工具' })).toBeInTheDocument();
  expect(screen.getByRole('form', { name: 'AI 操作坞' })).toBeInTheDocument();
  expect(document.querySelector('.workbench-body')).toHaveClass('workbench-body--canvas-first');
});

it('opens layers and properties as floating canvas panels', () => {
  render(<Workbench {...makeProps()} />);

  fireEvent.click(screen.getByRole('button', { name: '图层' }));
  expect(screen.getByRole('complementary', { name: '图层' })).toHaveClass('workbench-layers--expanded');
  fireEvent.click(screen.getByRole('button', { name: '属性' }));
  expect(screen.getByRole('complementary', { name: '属性' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: '属性' })).not.toBeInTheDocument();
});

it('focuses the command dock for conversation and keeps detailed contexts in drawers', () => {
  render(<Workbench {...makeProps()} />);

  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  expect(screen.getByRole('textbox', { name: '修改说明' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  expect(screen.getByRole('dialog', { name: '历史' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  expect(screen.getByRole('dialog', { name: '工具' })).toBeInTheDocument();
});
```

Move existing prompt submission assertions from `within(dialog)` to the command-dock form. Keep their callback and prompt-preservation assertions unchanged.

- [ ] **Step 2: Run the focused tests and verify red.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Workbench.test.tsx`

Expected: FAIL because rulers, the right toolbar, the command dock, and floating properties do not exist yet.

- [ ] **Step 3: Commit the failing contract tests.**

```bash
git add src/app/studio/Workbench.test.tsx
git commit -m "test: define canvas-first workbench layout"
```

### Task 2: Reorganize Workbench controls around the canvas

**Files:**

- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/workbench.css`

- [ ] **Step 1: Add prompt focus and context visibility behavior.**

Import `useRef`, create `promptRef`, and replace `showPanel` with explicit placement behavior:

```tsx
const promptRef = useRef<HTMLTextAreaElement>(null);

const showPanel = (nextPanel: ContextPanel): void => {
  setPanel(nextPanel);
  if (nextPanel === 'conversation') {
    setPanelOpen(false);
    requestAnimationFrame(() => promptRef.current?.focus());
    return;
  }
  setPanelOpen(true);
};

const detailedPanelOpen = panelOpen && (panel === 'history' || panel === 'tools');
const propertiesOpen = panelOpen && panel === 'properties';
```

Attach `ref={promptRef}` to the sole `修改说明` textarea in the command dock.

- [ ] **Step 2: Make the canvas the only in-flow body surface.**

Change the body class to `workbench-body workbench-body--canvas-first`. Keep `workbench-canvas` as the in-flow section and move these controls inside it as positioned siblings of `workbench-canvas__stage`:

```tsx
<div className="workbench-ruler workbench-ruler--horizontal" aria-hidden="true">
  <span>0</span><span>480</span><span>960</span><strong>{documentMeta?.width ?? scene.width}</strong><span>1440</span><span>1920</span>
</div>
<div className="workbench-ruler workbench-ruler--vertical" aria-hidden="true">
  <span>0</span><span>600</span><span>1200</span><span>1800</span>
</div>
```

Move `workbench-left` after the canvas stage and keep only the compact `workbench-toolstrip` persistently visible. Render the existing `workbench-layers` section beside it with its `workbench-layers--expanded` modifier; it must be absolutely positioned for every viewport width, not only below `1279px`.

- [ ] **Step 3: Move context entries to a right-side toolbar.**

Replace the toolbar-level `workbench-panel-switcher` with:

```tsx
<div className="workbench-context-tools" role="toolbar" aria-label={t(locale, '上下文工具', 'Context tools')}>
  {panelOrder.map((panelId) => (
    <IconButton
      key={panelId}
      name={panelCopy[panelId].icon}
      label={panelCopy[panelId].label}
      aria-pressed={(panelId === 'conversation' ? false : panelOpen) && panel === panelId}
      onClick={() => showPanel(panelId)}
    />
  ))}
</div>
```

Keep export in the compact top strip. Do not introduce new editing modes or icons.

- [ ] **Step 4: Render properties as a non-modal floating panel.**

Wrap the existing properties content in a labelled complementary region and render it inside the canvas only when `propertiesOpen`:

```tsx
{propertiesOpen && (
  <aside className="workbench-properties-float" aria-label={panelCopy.properties.label}>
    <div className="workbench-panel-heading">
      <div><p>{t(locale, '快速检查', 'Quick inspect')}</p><h2>{panelCopy.properties.label}</h2></div>
      <IconButton name="x" label={t(locale, '关闭属性', 'Close properties')} onClick={() => setPanelOpen(false)} />
    </div>
    <div className="workbench-context__content workbench-properties">{propertiesContent}</div>
  </aside>
)}
```

Define `propertiesContent` from the existing active-layer summary, locked state, title, coordinates, and opacity controls without changing callbacks or disabled conditions.

- [ ] **Step 5: Add the bottom AI command dock.**

Move the existing prompt textarea and its three actions into the canvas:

```tsx
<form className="workbench-command-dock" aria-label={t(locale, 'AI 操作坞', 'AI command dock')} onSubmit={submitPrompt}>
  <button type="button" className="workbench-command-dock__connection" onClick={onConnections} disabled={readOnly}>
    <span className="workbench-model-dot" data-connected={modelConnected || undefined} />
    <span>{modelConnected ? t(locale, '模型已连接', 'Model connected') : t(locale, '连接模型', 'Connect model')}</span>
  </button>
  <textarea ref={promptRef} rows={1} value={prompt} disabled={readOnly} aria-label={t(locale, '修改说明', 'Edit request')} onChange={(event) => setPrompt(event.target.value)} />
  <IconButton name="history" label={t(locale, '历史', 'History')} onClick={() => showPanel('history')} />
  <Button variant="ai" icon="arrow-up-right" onClick={submitPromptRequest} disabled={readOnly}>{t(locale, '发送', 'Send')}</Button>
  <Button variant="ai" icon="sparkles" onClick={submitGeneration} disabled={readOnly}>{t(locale, '生成', 'Generate')}</Button>
</form>
```

Remove the conversation branch and footer from `Drawer`. Open the shared drawer with `open={detailedPanelOpen}` and retain only the existing history and tools content and footers.

- [ ] **Step 6: Implement the spatial CSS without changing theme tokens.**

Use the existing variables in these contracts:

```css
.workbench-body--canvas-first { position: relative; display: block; overflow: hidden; }
.workbench-canvas { position: absolute; inset: 0; }
.workbench-canvas__stage { inset: 22px 0 0 22px; padding: 48px 72px 92px; }
.workbench-ruler { position: absolute; z-index: 4; color: var(--on-surface-variant); background: var(--surface-container-lowest); font: 9px/1 'JetBrains Mono', monospace; }
.workbench-ruler--horizontal { inset: 0 0 auto 22px; height: 22px; display: flex; justify-content: space-between; padding: 6px 18px 0; border-bottom: 1px solid var(--border-subtle); }
.workbench-ruler--vertical { inset: 22px auto 0 0; width: 22px; display: flex; flex-direction: column; justify-content: space-between; padding: 16px 0 100px 5px; border-right: 1px solid var(--border-subtle); }
.workbench-left { position: absolute; z-index: 7; top: 34px; bottom: 88px; left: 30px; display: block; }
.workbench-layers { position: absolute; top: 0; left: 48px; width: 232px; max-height: min(520px, 72vh); display: none; border: 1px solid var(--border-subtle); box-shadow: var(--shadow-overlay); }
.workbench-layers--expanded { display: flex; }
.workbench-context-tools { position: absolute; z-index: 7; top: 50%; right: 18px; display: flex; flex-direction: column; transform: translateY(-50%); }
.workbench-properties-float { position: absolute; z-index: 6; top: 34%; right: 68px; width: min(340px, calc(100% - 152px)); max-height: 52%; overflow: auto; }
.workbench-command-dock { position: absolute; z-index: 8; right: 48px; bottom: 18px; left: 48px; min-height: 52px; display: grid; grid-template-columns: auto minmax(160px, 1fr) 32px auto auto; }
```

Add existing-token borders, surfaces, radii of at most `8px`, focus states, and shadows. Preserve the current dark and light token values.

- [ ] **Step 7: Run the focused workbench tests green.**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/Workbench.test.tsx`

Expected: PASS, including prompt submission, read-only, revision, and image-tool cases.

- [ ] **Step 8: Commit the workbench layout.**

```bash
git add src/app/studio/Workbench.tsx src/app/studio/workbench.css src/app/studio/Workbench.test.tsx
git commit -m "feat: reorganize canvas workbench controls"
```

### Task 3: Embed workspace-backed CanvasWorkspace without duplicate chrome

**Files:**

- Modify: `src/features/canvas/CanvasWorkspace.tsx`
- Modify: `src/features/canvas/CanvasWorkspace.test.tsx`
- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/workbench.css`

- [ ] **Step 1: Write the failing embedded-mode test.**

```tsx
it('renders an embedded stage without duplicate canvas chrome', () => {
  render(<CanvasWorkspace locale="zh-CN" scene={editable} embedded />);

  expect(screen.getByRole('img', { name: '设计画布' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '画布' })).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: '图层' })).not.toBeInTheDocument();
});
```

If the canvas test environment exposes the mocked Konva stage under a different role, assert `.canvas-workspace__stage` instead of changing production accessibility.

- [ ] **Step 2: Run the test and verify red.**

Run: `pnpm vitest run --config vitest.config.ts src/features/canvas/CanvasWorkspace.test.tsx -t "embedded stage"`

Expected: FAIL because `embedded` is not a recognized prop and duplicate chrome still renders.

- [ ] **Step 3: Add the embedded presentation prop.**

Extend the public props and conditionally render chrome:

```tsx
export type CanvasWorkspaceProps = {
  locale: Locale;
  scene: DesignScene;
  onSceneChange?: (scene: DesignScene) => void;
  workspaceId?: string;
  projectId?: string;
  documentId?: string;
  readOnly?: boolean;
  assetAction?: CanvasAssetAction;
  onAssetActionHandled?: (actionId: string) => void;
  embedded?: boolean;
};

export const CanvasWorkspace = ({ locale, scene, onSceneChange, workspaceId, projectId, documentId, readOnly = false, assetAction, onAssetActionHandled, embedded = false }: CanvasWorkspaceProps) => {
```

Do not change the function body before its `return`. Apply these exact render guards to the header, layer list, and drawer blocks:

```tsx
className={`canvas-workspace${embedded ? ' canvas-workspace--embedded' : ''}`}

{!embedded && (
  <header>
    <h1>{messages.canvasTitle}</h1>
    <div>
      <Button icon="maximize-2" onClick={() => setViewport(fitViewport(scene, stageDimensions))}>{messages.canvasFit}</Button>
      <Button icon="scan" onClick={() => setViewport(initialViewport)}>{messages.canvasReset}</Button>
    </div>
  </header>
)}

{!embedded && (
  <LayerList locale={locale} layers={scene.layers} selectedIds={selectedIds} onSelect={select} onMove={move} onDuplicate={duplicate} onDelete={remove} onRename={rename} readOnly={readOnly} />
)}

<Drawer open={!embedded && inspectorOpen} title={messages.canvasInspector} locale={locale} onClose={() => setInspectorDismissed(true)}>
  <Inspector locale={locale} layer={selectedLayer} selectedLayers={selectedLayers} onChange={updateLayer} onChangeMany={updateLayers} readOnly={readOnly} />
</Drawer>
```

Keep selection, scene mutation, persistence, and image hydration code unchanged. For embedded mode, selection still renders on the Konva stage; quick project-level properties remain available from the outer workbench.

- [ ] **Step 4: Pass embedded mode from Workbench and size the stage.**

Add `embedded` to the workspace-backed `CanvasWorkspace` invocation. Add:

```css
.canvas-workspace--embedded,
.canvas-workspace--embedded .canvas-workspace__body,
.canvas-workspace--embedded .canvas-workspace__stage { width: 100%; height: 100%; min-width: 0; min-height: 0; }
.canvas-workspace--embedded .canvas-workspace__body { display: block; }
.canvas-workspace--embedded .canvas-workspace__stage { display: grid; place-items: center; overflow: auto; }
```

- [ ] **Step 5: Run both focused canvas suites.**

Run: `pnpm vitest run --config vitest.config.ts src/features/canvas/CanvasWorkspace.test.tsx src/app/studio/Workbench.test.tsx`

Expected: PASS; workspace-backed rendering, scene persistence, asset placement, and the new workbench layout remain green.

- [ ] **Step 6: Commit embedded mode.**

```bash
git add src/features/canvas/CanvasWorkspace.tsx src/features/canvas/CanvasWorkspace.test.tsx src/app/studio/Workbench.tsx src/app/studio/workbench.css
git commit -m "feat: embed canvas stage in workbench"
```

### Task 4: Verify responsive geometry and visual fidelity

**Files:**

- Modify: `src/app/studio/workbench.css`
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Add failing browser geometry assertions.**

Inside the existing workbench flow, assert the approved surface relationships:

```ts
const canvas = page.getByRole('region', { name: english ? 'Design canvas' : '设计画布', exact: true });
await expect(canvas.locator('.workbench-ruler--horizontal')).toBeVisible();
await expect(page.getByRole('toolbar', { name: english ? 'Canvas tools' : '画布工具' })).toBeVisible();
await expect(page.getByRole('toolbar', { name: english ? 'Context tools' : '上下文工具' })).toBeVisible();
await expect(page.getByRole('form', { name: english ? 'AI command dock' : 'AI 操作坞' })).toBeVisible();
await expect(canvas.locator('.workbench-command-dock')).toHaveCSS('position', 'absolute');
expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
```

Add a focused interaction that opens layers and properties and checks both overlays remain within the canvas bounding box at `1280x800` and `1024x720`.

- [ ] **Step 2: Run the focused e2e test and verify any remaining geometry failures.**

Run: `pnpm playwright test tests/e2e/studio.spec.ts --config playwright.config.ts -g "workspace navigation at"`

Expected: initial failure until compact sizing and overlay bounds are complete.

- [ ] **Step 3: Add compact-window rules.**

At `max-width: 1080px`, hide nonessential command-dock connection text, keep the prompt at `minmax(120px, 1fr)`, reduce canvas stage padding, and cap floating panel widths with `calc(100% - 120px)`. Do not hide any icon-only action or move controls outside the viewport.

- [ ] **Step 4: Run verification.**

Run:

```bash
pnpm vitest run --config vitest.config.ts src/app/studio/Workbench.test.tsx src/features/canvas/CanvasWorkspace.test.tsx
pnpm typecheck
pnpm lint
pnpm build
pnpm playwright test tests/e2e/studio.spec.ts --config playwright.config.ts -g "workspace navigation at"
```

Expected: all commands exit `0`.

- [ ] **Step 5: Inspect generated screenshots.**

Open the `workbench.png` artifacts for `1280x800` and `1024x720` in both themes. Confirm that the artwork remains centered, rails do not overlap the document, the command dock does not cover essential content, all text fits, and the layout matches the approved functional reference independent of theme.

- [ ] **Step 6: Commit responsive verification.**

```bash
git add src/app/studio/workbench.css tests/e2e/studio.spec.ts
git commit -m "test: verify canvas workbench geometry"
```
