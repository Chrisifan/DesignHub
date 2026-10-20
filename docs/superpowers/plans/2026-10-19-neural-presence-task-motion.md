# Neural Presence Task Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the canvas Neural Presence fixed at its lower-right anchor while it communicates analysis, design work, and explicit task outcomes through its own animation.

**Architecture:** Extend the existing canvas renderer with thinking, working, success, and failure modes. Derive one foreground task from existing `TaskRecord`s in `ProjectCanvas`, detect terminal transitions once per task, and keep analysis result-panel motion in an independent layer so it expands upward without translating the entity.

**Tech Stack:** React 19, TypeScript, Canvas 2D, CSS, Vitest, React Testing Library, Playwright for runtime visual verification.

**Spec:** `docs/superpowers/specs/2026-10-19-neural-presence-task-motion-design.md`

## Global Constraints

- Keep the Neural Presence fixed at its existing lower-right history anchor.
- Do not add visible success/failure badges or labels around or over the entity.
- Preserve the result panel's streamed typewriter behavior and existing task/error/history affordances.
- Treat `cancelled` and `unknown` as neutral outcomes; only `completed` and `failed` produce terminal feedback.
- Respect `prefers-reduced-motion` without changing task or history semantics.
- Preserve the existing working-tree changes in `ProjectCanvas.tsx`, `ProjectCanvas.test.tsx`, `AnalysisPanel.tsx`, `AnalysisPanel.test.tsx`, `project-canvas.css`, and `workbench.css`; stage only implementation-owned hunks when committing.

---

## File Map

- `src/app/previews/AgentConstellationPreview.tsx`: presence modes, deterministic layer motion, and canvas rendering for active and terminal states.
- `src/app/previews/AgentConstellationPreview.test.tsx`: pure motion-profile and mode-rendering tests.
- `src/app/studio/neural-presence-state.ts`: task selection and terminal-transition policy for the single visible entity.
- `src/app/studio/neural-presence-state.test.ts`: isolated tests for analysis/work priority, terminal outcomes, and transition deduplication.
- `src/app/studio/ProjectCanvas.tsx`: map project tasks to the entity's mode and short-lived feedback; keep the visible entity fixed.
- `src/app/studio/ProjectCanvas.test.tsx`: verify task-to-mode behavior and existing history/result interactions.
- `src/app/studio/project-canvas.css`: fixed entity anchor, panel-only upward reveal, and reduced-motion rules.
- `src/app/studio/AnalysisPanel.test.tsx`: regression coverage for result text/typewriter behavior if integration changes touch its render lifecycle.

## Task 1: Add Intrinsic Renderer Modes

**Files:**
- Modify: `src/app/previews/AgentConstellationPreview.tsx`
- Modify: `src/app/previews/AgentConstellationPreview.test.tsx`

**Interfaces:**
- Consumes: existing `PresenceMode`, `drawPresence`, `getNeuralLayerMotion`, `getMembraneRotation`, and `NeuralPresence` APIs.
- Produces: `PresenceMode` values for `idle`, `sensing`, `thinking`, `working`, `success`, and `failure`; an exported deterministic `getTerminalFeedbackProfile(mode, elapsedMs)` helper for finite success/failure shape and tint envelopes.

- [ ] **Step 1: Add failing renderer tests**

Add tests to `AgentConstellationPreview.test.tsx` that assert working mode has faster layer rotation/motion than idle without using the thinking connection profile, and that terminal profiles have a nonzero pulse/distortion during the event and return to neutral at or after the terminal duration. Also render `<NeuralPresence mode="success" compact />` and assert `data-mode="success"` with no visible success/failure label.

```ts
it('gives working mode a distinct active motion profile', () => {
  const idle = Math.abs(getMembraneRotation(0, 8_000, 'idle'));
  const working = Math.abs(getMembraneRotation(0, 8_000, 'working'));
  const thinking = Math.abs(getMembraneRotation(0, 8_000, 'thinking'));
  expect(working).toBeGreaterThan(idle * 1.4);
  expect(working).toBeLessThan(thinking);
});

it('settles terminal feedback back to a neutral profile', () => {
  expect(getTerminalFeedbackProfile('success', 420).intensity).toBeGreaterThan(0);
  expect(getTerminalFeedbackProfile('failure', 420).distortion).toBeGreaterThan(0);
  expect(getTerminalFeedbackProfile('success', 1_500)).toMatchObject({ intensity: 0, distortion: 0 });
  expect(getTerminalFeedbackProfile('failure', 1_500)).toMatchObject({ intensity: 0, distortion: 0 });
});
```

- [ ] **Step 2: Run renderer tests and confirm they fail**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/previews/AgentConstellationPreview.test.tsx`

Expected: FAIL because `working` and terminal modes/helpers are not yet supported.

- [ ] **Step 3: Implement finite canvas motion profiles**

Extend `PresenceMode` and localized accessible copy. Add `getTerminalFeedbackProfile(mode, elapsedMs)` returning `{ intensity, distortion, tint }`, clamped to a finite 1,200ms envelope. Use it inside `drawPresence` to deform the existing core/membrane points and blend a restrained green-cyan or coral tone. Give `working` a faster membrane/layer profile than idle while keeping generated polyline connections exclusive to `thinking`. Keep the compact renderer free of visible status labels.

```ts
export type TerminalPresenceMode = 'success' | 'failure';
export type TerminalFeedbackProfile = { intensity: number; distortion: number; tint: number };
export const getTerminalFeedbackProfile = (
  mode: TerminalPresenceMode,
  elapsedMs: number,
): TerminalFeedbackProfile => {
  const progress = Math.max(0, Math.min(1, elapsedMs / 1_200));
  const envelope = Math.sin(Math.PI * progress);
  return {
    intensity: envelope,
    distortion: mode === 'failure' ? envelope : 0,
    tint: envelope,
  };
};
```

- [ ] **Step 4: Run renderer tests and confirm they pass**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/previews/AgentConstellationPreview.test.tsx`

Expected: PASS, including existing idle, thinking-connection, and membrane-rotation coverage.

- [ ] **Step 5: Commit renderer changes**

Stage only the new renderer/test hunks if either file contains unrelated user changes, inspect `git diff --cached`, then commit with `feat: add neural presence task motion modes`.

## Task 2: Derive Foreground Task Mode and One-Shot Outcomes

**Files:**
- Create: `src/app/studio/neural-presence-state.ts`
- Create: `src/app/studio/neural-presence-state.test.ts`
- Modify: `src/app/studio/ProjectCanvas.tsx`
- Modify: `src/app/studio/ProjectCanvas.test.tsx`

**Interfaces:**
- Consumes: existing `TaskRecord`, `TaskState`, `PresenceMode`, current `tasks`, and the optimistic `analysisThinking` flag.
- Produces: `getForegroundPresenceTask(tasks, threadId)` returning `{ taskId, capability, mode, state } | null`, plus a terminal outcome classifier returning `'success' | 'failure' | null`; `ProjectCanvas` supplies the resulting `PresenceMode` to `NeuralPresence`.

- [ ] **Step 1: Add failing task-policy tests**

Test that queued/running conversation work maps to `thinking`; queued/running `design-generation`, `image-editing`, and `local-transform` work maps to `working`; only `completed` and `failed` classify as terminal outcomes; and the active task with the newest `createdAt` wins when operations overlap.

```ts
const task = (input: Pick<TaskRecord, 'id' | 'capability' | 'state'> & { createdAt: string; analysisThreadId?: string }): TaskRecord => ({
  ...input,
  requestId: `${input.id}-request`,
  cancelRequested: false,
  attempt: 1,
});

it('selects the newest active operation and maps it by capability', () => {
  const selected = getForegroundPresenceTask([
    task({ id: 'analysis', capability: 'conversation', state: 'running', createdAt: '2026-10-19T10:00:00Z', analysisThreadId: 'thread-1' }),
    task({ id: 'edit', capability: 'image-editing', state: 'queued', createdAt: '2026-10-19T10:01:00Z' }),
  ], 'thread-1');
  expect(selected).toMatchObject({ taskId: 'edit', mode: 'working' });
});

it('does not classify cancellation or indeterminate state as a terminal outcome', () => {
  expect(getTerminalPresenceOutcome('completed')).toBe('success');
  expect(getTerminalPresenceOutcome('failed')).toBe('failure');
  expect(getTerminalPresenceOutcome('cancelled')).toBeNull();
  expect(getTerminalPresenceOutcome('unknown')).toBeNull();
});
```

- [ ] **Step 2: Run task-policy tests and confirm they fail**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/neural-presence-state.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement task selection and terminal classification**

Filter conversation and design-generation records to the current analysis thread; include image-edit/local-transform records already scoped to the current project by `refresh`. Ignore terminal records for foreground selection and sort active records by `createdAt`, then `updatedAt`, descending, with stable input order when both timestamps are absent. Return the winning task with `thinking` or `working` mode. Keep the existing optimistic `analysisThinking` state as a fallback before the submitted conversation record arrives. Do not convert `cancelled` or `unknown` into failure.

```ts
export const getForegroundPresenceTask: (
  tasks: readonly TaskRecord[],
  threadId: string | undefined,
) => ForegroundPresenceTask | null;

export type ForegroundPresenceTask = {
  taskId: string;
  capability: string;
  mode: 'thinking' | 'working';
  state: 'queued' | 'running';
};
export const getTerminalPresenceOutcome = (state: TaskState): 'success' | 'failure' | null =>
  state === 'completed' ? 'success' : state === 'failed' ? 'failure' : null;
```

- [ ] **Step 4: Add failing `ProjectCanvas` lifecycle tests**

Add component cases for a running design-generation task and running image-edit task showing `data-mode="working"`, and for initial failed/completed task records not replaying terminal feedback. Add a polling transition case that changes the mocked task list from running to completed and asserts one `success` mode followed by idle. Use fake timers and advance the existing 1,200ms task refresh interval inside `act`.

- [ ] **Step 5: Run the focused canvas tests and confirm they fail**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx`

Expected: FAIL because the current entity only receives `idle` or `thinking` and has no one-shot terminal state.

- [ ] **Step 6: Wire one-shot state transitions into `ProjectCanvas`**

Track the first task snapshot separately so hydrated terminal records do not animate. Compare later task states by task ID; when the foreground task transitions from `queued`/`running` to `completed`/`failed`, set `success`/`failure` for the renderer's 1,200ms envelope, then return to the current active mode or idle. Ignore polling repeats and clear timers on unmount/project change. Use one foreground task at a time; when it ends, show any still-active task. Keep the entity wrapper's lower-right position classes unchanged for every mode.

```tsx
<NeuralPresence mode={presenceMode} compact />
```

- [ ] **Step 7: Run task-policy and canvas tests and confirm they pass**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/neural-presence-state.test.ts src/app/studio/ProjectCanvas.test.tsx`

Expected: PASS; existing empty-history, history expansion, and analysis-thinking tests remain green.

- [ ] **Step 8: Commit task-mode integration**

Stage only implementation-owned hunks, inspect `git diff --cached`, then commit with `feat: connect canvas tasks to neural presence`.

## Task 3: Animate the Result Panel Without Moving the Entity

**Files:**
- Modify: `src/app/studio/ProjectCanvas.tsx`
- Modify: `src/app/studio/ProjectCanvas.test.tsx`
- Modify: `src/app/studio/project-canvas.css`
- Test: `src/app/studio/AnalysisPanel.test.tsx`

**Interfaces:**
- Consumes: the one-shot presence mode and existing completed `analysisTask`/`analysisCollapsed` state.
- Produces: a result-panel enter class/state triggered only by successful analysis completion; the entity wrapper remains at its existing lower-right anchor.

- [ ] **Step 1: Add failing panel/anchor regression tests**

Assert that analysis `thinking` and `success` retain the same non-traveling presence wrapper state, that a session-observed successful result panel receives an enter marker, that failed/cancelled analysis and completed results loaded at mount do not receive the success-enter marker, and that opening/closing history preserves its existing dock view and count. Keep the existing `AnalysisPanel` streamed-text test as a required regression.

```tsx
expect(screen.getByTestId('project-canvas-analysis-presence')).not.toHaveClass('project-canvas-analysis-presence--thinking');
expect(document.querySelector('.project-canvas-analysis-panel')).toHaveClass('project-canvas-analysis-panel--enter-from-presence');
```

- [ ] **Step 2: Run focused canvas and panel tests and confirm the new assertions fail**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx src/app/studio/AnalysisPanel.test.tsx`

Expected: FAIL on the missing panel-enter state or current thinking-position class; all pre-existing assertions should otherwise remain unchanged.

- [ ] **Step 3: Separate panel motion from presence positioning**

Remove the CSS rule that changes the presence wrapper's `top` for thinking and remove its reduced-motion counterpart. Keep one stable lower-right anchor using the existing dock-bottom token. Store the ID of an analysis task whose successful transition was observed in the current session, and apply the panel enter marker only to that task. Add a result-panel enter animation whose origin is the lower-right entity anchor and whose end position is the existing upper-right panel location; animate only the panel's opacity/transform. Start this transition after the success feedback phase. On reduced motion, skip translation and keep an opacity-only reveal. Do not alter `AnalysisPanel`'s typewriter/rendering lifecycle.

```css
.project-canvas-analysis-presence,
.project-canvas-analysis-presence--thinking {
  top: calc(100% - var(--project-canvas-dock-bottom) - 155px);
}

@media (prefers-reduced-motion: reduce) {
  .project-canvas-analysis-panel--enter-from-presence {
    animation: project-analysis-panel-fade 120ms ease-out both;
  }
}
```

- [ ] **Step 4: Run focused canvas and panel tests and confirm they pass**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx src/app/studio/AnalysisPanel.test.tsx`

Expected: PASS with typewriter behavior and panel contents unchanged.

- [ ] **Step 5: Verify the integrated motion in the running app**

Run: `pnpm start`, open a project canvas, and use the existing analysis and design-generation flows. Confirm that analysis thinking stays at the lower-right, successful analysis reveals the panel upward while text continues typing, work mode appears for generation and image edit, terminal feedback plays once, and the lower-right entity never moves. Repeat with `prefers-reduced-motion: reduce` and verify history open/close does not shift the bottom anchor. Use screenshots at the same viewport before/during/after transitions to compare the entity's bounding box.

- [ ] **Step 6: Run final checks**

Run: `pnpm exec vitest run --config vitest.config.ts src/app/previews/AgentConstellationPreview.test.tsx src/app/studio/neural-presence-state.test.ts src/app/studio/ProjectCanvas.test.tsx src/app/studio/AnalysisPanel.test.tsx`

Expected: PASS with no new visible outcome labels and no changes to the result typewriter behavior.

- [ ] **Step 7: Commit panel transition and final regression coverage**

Stage only implementation-owned hunks, inspect `git diff --cached`, then commit with `feat: animate analysis result from neural presence`.

## Self-Review

- Renderer behavior and tests are covered by Task 1.
- Active operation priority, one-shot terminal feedback, hydration, and cancellation semantics are covered by Task 2.
- Fixed entity geometry, result-panel-only motion, typewriter regression, history spacing, and reduced motion are covered by Task 3.
- No task changes provider behavior, task persistence, retry behavior, or image/result data models.
- Existing dirty source changes are explicitly preserved and must not be swept into the implementation commits.
