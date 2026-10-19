# Neural Presence Task Motion

## Goal

Make the lower-right Neural Presence communicate analysis and design work through its own motion while keeping the entity anchored in place. Preserve the existing analysis result typewriter behavior and history interaction.

This design supersedes the lower-right-to-upper-right entity travel described in `2026-10-18-neural-presence-analysis-dock-design.md`. The entity no longer travels vertically during a task or when a result appears.

## Scope

- Keep the Neural Presence visible at its established lower-right canvas anchor, including before any analysis history exists.
- Give intent analysis a distinct thinking animation and design generation/image-edit work a distinct working animation.
- Give explicitly successful and failed tasks a brief, intrinsic visual ending on the entity itself.
- Animate the successful analysis result panel from the entity's anchor upward into its existing result position. The entity stays at the anchor.
- Preserve the result panel's streamed typewriter behavior, analysis history content and ordering, history count, and existing error details.
- Preserve stable bottom geometry when switching between the collapsed entity and expanded history.
- Respect reduced-motion preferences.

Out of scope:

- Changing provider requests, task persistence, retry policy, result parsing, generation behavior, or image-edit behavior.
- Adding visible success/failure labels or badges around or over the entity.
- Moving the entity to another part of the canvas, adding external sensing rays, or changing the neural artwork's basic silhouette.

## Interaction Model

### Idle and history

The entity remains the lower-right analysis-history entry in both empty and populated states. Its existing count treatment is retained when records exist; no count is shown for an empty history. Clicking it continues to open or close the history panel. The history panel and entity share a stable lower-right anchor so toggling history does not alter the canvas dock's bottom spacing.

### Analysis

When an intent-analysis task enters `queued` or `running`, the entity remains at the history anchor and enters the analysis thinking mode. If history is open, it closes before the thinking animation becomes visible. The analysis progress body remains hidden while the task is active.

On successful completion, the entity briefly plays its intrinsic success motion. The existing analysis result panel then expands upward from the entity anchor to its established upper-right position. Only the panel moves; the entity remains anchored below it. The result content keeps its existing typewriter smoothing and scrolling behavior.

On an explicit failed completion, the entity briefly plays its intrinsic failure motion and returns to idle. Existing task error details and retry/history affordances remain the source of textual failure information; this change adds no status badge to the entity.

### Design work

While a design-generation task or canvas image-edit/local-transform task is queued or running, the entity remains at the same anchor and uses a working mode distinct from analysis thinking. The working motion can use the already reviewed direction: counter-rotating membranes with a faster, warmer core/node rhythm.

On successful completion, the entity plays the same intrinsic success ending used by analysis, then returns to idle. The generated or edited canvas content remains the task result surface. On explicit failure, the entity plays the intrinsic failure ending and returns to idle; existing task errors and notifications remain unchanged.

The entity shows one task mode at a time. If an analysis and a design operation overlap, the foreground operation that most recently entered a queued/running state owns the visible mode. When it ends, any still-active operation becomes visible. A task's terminal feedback is played once for that observed state transition and is not replayed by polling or rerendering.

### Terminal outcomes

- `completed` produces success feedback. For multi-slot generation, use the persisted aggregate task state; a task completed with at least one successful output is a success, consistent with the existing task aggregate.
- `failed` produces failure feedback.
- `cancelled` and `unknown` return to idle without claiming success or failure. An interrupted or indeterminate task is not necessarily a failure.
- A task already terminal on initial load does not replay a completion animation. Feedback is reserved for a terminal transition observed in the current session.

## Motion Design

- **Thinking:** irregular multi-point connections appear and disappear between membrane layers while the layers subtly deform and drift. The pace is noticeably active but remains organic rather than a uniform spinner.
- **Working:** membrane layers rotate slowly in opposite directions; core and node rhythms become faster and warmer than the analysis mode.
- **Success:** the core briefly contracts, then a coherent green-cyan pulse expands through the membranes and nodes before the entity settles back into idle breathing.
- **Failure:** the core and membranes briefly lose symmetry, nodes flicker or break rhythm, then the structure converges back to idle. Use both silhouette/rhythm change and a restrained coral tint, not color alone.
- Terminal animations are short, self-contained, and return to the idle mode without vertical displacement. No text label, pill, icon badge, or second entity is displayed in the product for either outcome.
- **Result panel:** animate the panel independently from the fixed entity, using the entity's anchor as the origin and moving the panel upward into the current result position. The panel transition must not shift canvas layout or change the history dock's bottom spacing.
- Under `prefers-reduced-motion: reduce`, suppress translation, rotation, and repeated particle/connection motion; retain a brief opacity or intensity change so state changes remain perceivable.

## State and Data Flow

The presentation mode should be derived from persisted task state plus a small, session-local terminal-feedback state. It should not introduce a second task system or persist animation state.

The visual mode contract is:

```ts
type PresenceMode = 'idle' | 'thinking' | 'working' | 'success' | 'failure';
```

The implementation may preserve any existing renderer modes still used elsewhere, but `ProjectCanvas` should map analysis tasks to `thinking`, design-generation and image-edit/local-transform tasks to `working`, and observed terminal transitions to a bounded `success` or `failure` mode. Terminal feedback must be keyed by task ID and state transition to remain idempotent across the 1.2-second task refresh cycle.

The analysis result panel remains a separate presentation layer. Its expansion is triggered by successful analysis completion and does not control or reposition the entity. History open/closed state also remains separate from task mode.

## Accessibility

- Keep the entity's existing button semantics, accessible name, and history count.
- Expose a concise localized live status for active analysis/work and terminal outcomes without announcing animation frames. The nonverbal feedback requirement applies to visible UI; screen-reader status remains available.
- Keep existing result-panel live updates, task error descriptions, and keyboard history behavior.
- Reduced-motion behavior must retain the same task and history semantics.

## Testing

Component and renderer tests should verify:

- The entity is present at the same lower-right anchor with zero or many history entries.
- Analysis queued/running uses thinking mode without moving the entity and without rendering the progress panel.
- Design generation and image-edit/local-transform queued/running use working mode, distinct from thinking.
- A completed task produces one success transition; a failed task produces one failure transition; polling and rerendering do not replay either transition.
- Cancelled/unknown tasks do not produce a false success/failure flash, and terminal tasks loaded on mount do not replay feedback.
- Successful analysis reveals the existing result panel via an upward panel-only transition while preserving typewriter behavior and fixed entity geometry.
- Successful design work leaves its canvas result behavior intact; failure keeps existing error details and retry behavior.
- Opening and closing history preserves its bottom anchor and does not cause vertical dock jumps.
- Reduced-motion mode disables spatial/repeated movement while retaining state feedback.

## Acceptance Criteria

1. The Neural Presence remains fixed at the lower-right history anchor through analysis, design work, completion, and failure.
2. Analysis and design work are visually distinguishable through the entity's own motion.
3. Explicit success and failure are distinguishable through short changes to the entity's shape, rhythm, and restrained color, with no visible status badges or labels.
4. Successful analysis opens the existing result panel upward from the entity's anchor; the entity itself does not move.
5. Existing typewriter behavior, history interaction, result/error content, and retry affordances remain intact.
6. Cancelled and indeterminate tasks do not masquerade as explicit failures.
7. History expansion/collapse retains stable bottom spacing, and reduced-motion preferences are respected.
