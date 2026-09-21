# Canvas Analysis History Layout

## Goal

Improve the project canvas analysis controls so the conversation surface uses less horizontal space and the analysis history is complete, visually consistent, and anchored to the lower-left corner.

## Scope

- Include the currently displayed analysis task in the analysis history list and count.
- Keep analysis history ordered newest first.
- Keep the selected analysis task visible in the analysis panel when a history item is chosen.
- Anchor the analysis column to the lower-left of the canvas.
- Place the history list below the current analysis panel in normal layout flow so an opened list grows upward from the bottom anchor.
- Match the history container to the existing analysis/dialog glass treatment.
- Reduce the canvas conversation dock width while preserving responsive behavior.

## Interaction and Data Flow

`ProjectCanvas` derives conversation tasks from the refreshed project task list. The displayed task remains the selected task when a history item is chosen; a newly submitted task becomes selected immediately and is also included in the history list. The history list is sorted by `createdAt` descending and its count includes every conversation task in the active analysis thread.

The analysis column is positioned from the bottom-left rather than the top-left. Its children remain in source order with the current analysis panel above the history list. When history is open, the list receives a bounded scroll area so the column cannot exceed the canvas viewport.

## Visual Treatment

- Use existing `--shell-glass`, `--shell-glass-border`, `--shell-backdrop`, and `--shadow-overlay` tokens.
- Keep the same border radius, internal divider, typography, hover, and selected-state treatment across the analysis panel and history list.
- Use a compact canvas conversation dock width (`min()` plus viewport padding) and retain the mobile width override.
- Use the expanded-state chevron to indicate that the history content opens upward from the anchored trigger.

## Verification

- Add focused `ProjectCanvas` tests for latest-task inclusion, newest-first ordering, count, and history selection.
- Verify the history section remains anchored at the lower-left and opens upward through CSS contract assertions or browser inspection.
- Run the focused Vitest suite, typecheck, and lint.
- Run the desktop/e2e canvas check when the local runtime is available.

## Out of Scope

- Changing task persistence or task-service semantics.
- Changing analysis markdown rendering or generation behavior.
- Redesigning unrelated dialogs or workspace panels.
