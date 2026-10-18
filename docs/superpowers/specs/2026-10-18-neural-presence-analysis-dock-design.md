# Neural Presence Analysis Dock

## Goal

Replace the collapsed analysis-history presentation in the project canvas with the existing Neural Presence entity. The entity remains an always-available, recognizable presence at the lower-right of the canvas, communicates the number of analysis records, opens the history list on click, and becomes the visual process indicator while a new intent analysis is running.

## Scope

- Reuse the existing `NeuralPresence` canvas renderer and its `idle` and `thinking` modes.
- Replace the collapsed lower-right history presentation with a clickable entity.
- Preserve the existing analysis result panel, streamed text, and typewriter smoothing after analysis completes.
- Add a coordinated lower-right to upper-right transition for analysis work.
- Keep existing analysis history selection, ordering, status icons, and generation actions.
- Keep external perception rays, feelers, and outward light propagation disabled.

Out of scope:

- Redesigning the Neural Presence artwork itself.
- Changing task persistence, provider behavior, or analysis response parsing.
- Adding a new analysis history data model.

## Interaction Model

### Idle presence

When there is at least one conversation analysis in the active thread and the analysis result is not being shown, the lower-right dock renders the entity in `idle` mode. A small numeric badge gives the exact history count. A set of subtle outer tick marks repeats the count visually without placing text over the entity. The full control has an accessible label containing the count and an action label for opening history.

When there is no history, the existing analysis panel behavior remains available for the first submitted task; the entity is not shown as an empty history affordance.

### History expansion

Clicking the idle entity changes the lower-right dock from presence to history. The entity compresses toward its center while the history list expands from the same anchor. The list retains the current item selection and status treatment. Clicking the dock trigger or the entity close affordance reverses the animation and returns to the presence.

The history count remains visible in the collapsed presence state and in the expanded history header. Keyboard activation follows the same transition as pointer activation. Reduced-motion users receive an opacity/state change without spatial movement.

### Analysis submission

Submitting a new intent analysis first closes an open history list. The lower-right presence becomes the single transition source. It moves along a right-edge path to the existing upper-right analysis panel anchor while switching to `thinking`. During queued/running states, only the thinking entity is shown at the analysis anchor; the analysis panel does not render its progress body.

The existing `AnalysisPanel` remains the result surface. Once the task has completed, the thinking entity resolves into the analysis panel at the same anchor. The panel keeps its current streamed typewriter smoothing and scrolling behavior.

### Return to presence

When the result panel is dismissed by canvas-background focus or another task starts, it collapses back to the lower-right presence along the reverse path. The history count updates from the active thread task list. Selecting a history item opens the result panel for that task and does not change the active thread.

## State Contract

The canvas needs one explicit presentation state in addition to existing task state:

```ts
type AnalysisDockView = 'presence' | 'history' | 'thinking' | 'result';
```

The view is derived or synchronized from these inputs:

- `analysisHistory.length` controls the badge and tick count.
- `analysisHistoryOpen` controls `presence` versus `history` when no task is running.
- The selected analysis task state controls `thinking` versus `result`.
- `analysisCollapsed` remains the user-facing collapse intent for the result panel, but no longer renders the old dot-only collapsed panel.

Only one of presence, history, thinking, or result is visually interactive at a time. The transition wrapper owns positioning and animation classes so the Neural Presence renderer does not need project-canvas knowledge.

## Animation Rules

- Presence-to-history: 220–280ms, center compression plus list expansion from the same lower-right origin.
- Lower-right-to-upper-right travel: 420–560ms, eased on entry and exit; no teleporting or independent fade that loses spatial continuity.
- Thinking mode: uses the existing irregular membrane rotation and multi-point polyline connections.
- Thinking-to-result: 180–260ms crossfade/scale at the upper-right anchor.
- Result-to-presence: reverse travel with a short 180–240ms settle; history count updates before the entity becomes interactive.
- `prefers-reduced-motion: reduce`: disable translation and rotation transitions, retain opacity and visibility changes, and preserve all state semantics.

## Accessibility

- The collapsed entity is a real button with a localized accessible label such as “打开分析历史，3 条记录”.
- The history list remains a labelled region and its existing item buttons remain keyboard reachable.
- Thinking state exposes a polite live status (“正在分析”) without announcing every animation frame.
- The result panel retains its existing `aria-live="polite"` and busy state for streamed content.
- Focus returns to the triggering entity when history closes; focus moves to the result panel heading or body when the result surface opens.

## Testing

Unit/component tests should verify:

- Collapsed history renders the Neural Presence button and exact count.
- Clicking the presence opens the history list and preserves item selection/status.
- Submitting with an open history closes history before entering thinking state.
- Queued/running analysis renders thinking presence at the analysis anchor and does not render the progress panel.
- Completed analysis renders the existing result panel and keeps streamed typewriter behavior.
- Canvas-background dismissal returns to the lower-right presence.
- Reduced-motion classes/attributes avoid spatial transition requirements while preserving state changes.
- Existing history ordering, selection, and analysis panel tests remain green.

## Acceptance Criteria

1. A collapsed analysis history is represented by the Neural Presence entity in the lower-right, with both visual and numeric history count.
2. Clicking it opens the existing history list with a coherent shared-origin transition.
3. New intent analysis moves the entity from lower-right to upper-right, uses thinking mode while work runs, and hides the analysis progress panel.
4. Completion transitions into the existing result panel without removing its typewriter effect.
5. Dismissal returns the entity to the lower-right and refreshes the history count.
6. No exterior sensing rays, feelers, or outward light propagation are reintroduced.
