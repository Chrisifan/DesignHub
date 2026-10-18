# Neural Presence Analysis Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the collapsed lower-right analysis history affordance with the Neural Presence entity and coordinate its history, thinking, result, and return transitions in the project canvas.

**Architecture:** Keep task/history data and transition orchestration in `ProjectCanvas`. Extend the existing `NeuralPresence` renderer with a compact embedding mode so the project canvas can render the same entity without importing preview-only layout. Render one shared dock wrapper with explicit `presence`, `history`, `thinking`, and `result` presentation states; CSS owns the lower-right/upper-right travel and reduced-motion behavior. Keep `AnalysisPanel` responsible only for completed/failed result content and its existing typewriter stream.

**Tech Stack:** React, TypeScript, Vitest + Testing Library, CSS animations/transitions, existing canvas renderer.

---

### Task 1: Add the compact Neural Presence embedding contract

**Files:**
- Modify: `src/app/previews/AgentConstellationPreview.tsx`
- Modify: `src/app/previews/agent-constellation-preview.css`
- Test: `src/app/previews/AgentConstellationPreview.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Add tests that render `NeuralPresence` with `mode="idle"`, `compact`, and a history count, then assert:

```tsx
render(<NeuralPresence mode="idle" compact historyCount={3} />);
expect(screen.getByRole('img', { name: /待命中/u })).toBeInTheDocument();
expect(screen.getByTestId('neural-presence-history-count')).toHaveTextContent('3');
expect(screen.getByTestId('neural-presence-history-ticks').querySelectorAll('i')).toHaveLength(3);
```

Also assert `compact` adds a compact root class/data attribute and preserves the existing standalone preview output when omitted.

- [ ] **Step 2: Run the focused test and verify it fails for the missing contract**

Run: `pnpm vitest run --config vitest.config.ts src/app/previews/AgentConstellationPreview.test.tsx -t "compact"`

Expected: FAIL because `NeuralPresence` does not yet accept/render `compact` or `historyCount`.

- [ ] **Step 3: Implement the minimal embedding API**

Export `PresenceMode`, extend `NeuralPresence` props with `compact?: boolean` and `historyCount?: number`, and render the count/tick overlay only when `compact` is true. Keep the existing canvas/status markup and behavior intact. Use a bounded count for visual ticks while the numeric badge uses the exact count.

Add compact CSS with a stable square size, a non-blocking overlay, and a visible focus ring on the outer button supplied by the canvas (the renderer itself remains presentational).

- [ ] **Step 4: Run the focused preview tests**

Run: `pnpm vitest run --config vitest.config.ts src/app/previews/AgentConstellationPreview.test.tsx`

Expected: all preview tests pass, including the existing thinking polyline and membrane-motion tests.

- [ ] **Step 5: Commit the isolated renderer contract**

```bash
git add src/app/previews/AgentConstellationPreview.tsx src/app/previews/agent-constellation-preview.css src/app/previews/AgentConstellationPreview.test.tsx
git commit -m "feat: expose compact neural presence embedding"
```

### Task 2: Model the analysis dock presentation states in ProjectCanvas

**Files:**
- Modify: `src/app/studio/ProjectCanvas.tsx`
- Test: `src/app/studio/ProjectCanvas.test.tsx`

- [ ] **Step 1: Add failing state-transition tests**

Extend the existing canvas fixture with a controllable `onSubmitConversation` result and add tests for these observable states:

```tsx
it('renders the collapsed history as a counted neural presence', async () => {
  renderProjectCanvasWithTasks([completedConversation('a'), completedConversation('b')]);
  expect(await screen.findByRole('button', { name: /打开分析历史.*2/u })).toBeInTheDocument();
});

it('opens history from the presence and closes it before thinking begins', async () => {
  renderProjectCanvasWithTasks([completedConversation('a')]);
  fireEvent.click(await screen.findByRole('button', { name: /打开分析历史/u }));
  expect(screen.getByLabelText('分析历史列表')).toHaveClass('is-open');
  // resolve a queued/running task after submitting
  fireEvent.change(screen.getByLabelText('设计需求'), { target: { value: '新需求' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(screen.queryByRole('button', { name: /打开分析历史/u })).not.toBeInTheDocument();
  expect(screen.getByTestId('project-canvas-analysis-presence')).toHaveAttribute('data-mode', 'thinking');
  expect(screen.queryByTestId('analysis-progress-panel')).not.toBeInTheDocument();
});
```

Add a completion assertion that the result panel returns and the counted presence returns to the lower-right presentation state.

- [ ] **Step 2: Run the new tests and verify the expected failures**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx -t "neural presence|thinking begins"`

Expected: FAIL because the canvas still renders the old history trigger and renders `AnalysisPanel` while tasks are running.

- [ ] **Step 3: Implement explicit presentation derivation**

Add a local `AnalysisDockView` union and derive the visible state from `analysisHistoryOpen`, `analysisTask.state`, and `analysisCollapsed`:

```ts
type AnalysisDockView = 'presence' | 'history' | 'thinking' | 'result';
```

Use the following rules:

- `history` when the lower-right history toggle is open and no analysis task is queued/running.
- `thinking` for queued/running conversation tasks.
- `result` for completed/failed/cancelled selected tasks when the result panel is not collapsed.
- `presence` for the collapsed lower-right state and after result-panel dismissal.

When `submit` starts, set `analysisHistoryOpen(false)` and set the transition source to `thinking` before awaiting the task. When a task completes, keep the selected task and allow the result view; when canvas background is clicked, set `analysisCollapsed(true)` and return to presence.

- [ ] **Step 4: Render the shared dock states**

Import `NeuralPresence` and render:

- A real button wrapping compact `NeuralPresence` for `presence` and `thinking`, with localized labels and `data-testid="project-canvas-analysis-presence"`.
- The existing history list/header for `history`, with the numeric count unchanged.
- `AnalysisPanel` only for `result` (and existing failed/cancelled result behavior), never for queued/running progress.

Keep existing `selectAnalysis`, history ordering, item status icons, copy-to-conversation, and generation callbacks unchanged.

- [ ] **Step 5: Run the ProjectCanvas tests**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx`

Expected: all existing history, selection, collapse, and canvas tests pass together with the new presentation-state tests.

- [ ] **Step 6: Commit the state orchestration**

```bash
git add src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvas.test.tsx
git commit -m "feat: route canvas analysis through neural presence states"
```

### Task 3: Implement shared-origin travel and history/presence styling

**Files:**
- Modify: `src/app/studio/project-canvas.css`
- Modify: `src/app/studio/workbench.css`
- Test: `tests/integration/project-canvas-layout.test.ts`

- [ ] **Step 1: Write failing layout-contract assertions**

Add assertions that the canvas has a stable analysis dock wrapper with lower-right and upper-right state rules, a compact square presence, a count badge, and a reduced-motion override. Assert the old collapsed-dot styling is no longer the active collapsed presentation.

- [ ] **Step 2: Run the layout tests and verify they fail**

Run: `pnpm vitest run --config vitest.config.ts tests/integration/project-canvas-layout.test.ts`

Expected: FAIL because the new dock classes and reduced-motion rules do not exist.

- [ ] **Step 3: Add the CSS state machine**

Create a shared `.project-canvas-analysis-dock` wrapper with fixed dimensions and state classes. Use `transform`/`opacity` transitions to move the same entity between the lower-right history anchor and upper-right analysis anchor. Give history expansion a same-origin scale/clip animation, keep the result panel at its current width/scroll constraints, and ensure the compact entity does not intercept pointer events outside its button.

Add count badge/tick styles and a `@media (prefers-reduced-motion: reduce)` override that removes translation/rotation animation but keeps visibility/opacity changes.

Do not reintroduce rays, feelers, or outward light effects.

- [ ] **Step 4: Run the layout tests**

Run: `pnpm vitest run --config vitest.config.ts tests/integration/project-canvas-layout.test.ts`

Expected: all layout contract tests pass.

- [ ] **Step 5: Commit the visual state machine**

```bash
git add src/app/studio/project-canvas.css src/app/studio/workbench.css tests/integration/project-canvas-layout.test.ts
git commit -m "feat: animate neural presence analysis dock"
```

### Task 4: Verify result streaming, accessibility, and browser states

**Files:**
- Modify: `src/app/studio/AnalysisPanel.test.tsx`
- Modify: `src/app/studio/ProjectCanvas.test.tsx`
- Modify: `tests/e2e/designer-drawer.spec.ts` only if an existing selector requires a stable state hook

- [ ] **Step 1: Add focused accessibility and stream regression tests**

Verify the thinking button has a polite status label, the presence button exposes the exact count, history item buttons remain keyboard reachable, and a completed result still renders the existing streamed markdown/typewriter behavior.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/AnalysisPanel.test.tsx src/app/studio/ProjectCanvas.test.tsx`

Expected: PASS with no loss of existing typewriter assertions.

- [ ] **Step 3: Run the browser preview and inspect the full sequence**

Keep the existing dev server at `http://127.0.0.1:4173/?preview=neural-presence` running for the standalone entity reference. Use the project canvas in the app to inspect:

1. Bottom-right idle presence with history count and ticks.
2. Click-to-history expansion and reverse collapse.
3. Submit while history is open: history closes, entity travels upward, and thinking connections animate.
4. Completion: result panel appears with typewriter text and entity returns to the bottom-right.
5. Canvas-background dismissal and keyboard focus return.

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit `0`; unit tests report no failures; build produces renderer, main, and preload bundles.

- [ ] **Step 5: Commit final regression coverage**

```bash
git add src/app/studio/AnalysisPanel.test.tsx src/app/studio/ProjectCanvas.test.tsx tests/e2e/designer-drawer.spec.ts
git commit -m "test: cover neural presence analysis workflow"
```

## Self-review Checklist

- [x] Covers numeric and visual history count.
- [x] Covers history open/close, thinking travel, result panel, and return travel.
- [x] Preserves existing streamed typewriter behavior and history selection.
- [x] Specifies reduced-motion and keyboard behavior.
- [x] Keeps implementation inside existing renderer, canvas, and CSS boundaries.
- [x] Does not add exterior rays, feelers, or outward light propagation.
- [x] Every implementation step has an exact file, command, or code shape.
