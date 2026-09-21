# Analysis History and Current Analysis Panel Design

## Goal

Improve the project canvas analysis experience so users can browse prior analyses without losing list context, collapse the current analysis without hiding its activity state, inspect and reuse the original request, and scroll both analysis surfaces without visible scrollbars.

## Scope

This change applies to the project canvas analysis panel and analysis history surface. It does not change the workbench analysis panel behavior outside the project canvas, task persistence, conversation submission semantics, or design-generation behavior.

## Analysis History

- Rename the user-facing label from “分析结果” to “分析历史” and the English label from “Analysis results” to “Analysis history”.
- Keep the history list open after an item is selected.
- Continue selecting every design whose `sourceConversationTaskId` matches the selected analysis task.
- Selecting an analysis with no generated designs clears the design selection.
- Selecting a history item expands the current-analysis panel so the chosen result is immediately visible.
- Prefix each history item with a status icon:
  - completed: check icon;
  - queued or running: animated/loading icon;
  - failed or cancelled: warning icon.
- Keep the existing textual status next to the request summary so status is not communicated by icon alone.

## Current Analysis Collapse Behavior

- Add a dedicated collapsed state for the current-analysis panel. This is separate from the existing toolbar-level visibility toggle for the analysis UI.
- The expanded panel provides a collapse button.
- The collapsed representation is the approved minimal form: three animated analysis dots plus an expand button, without a title or full-width header.
- Clicking a true canvas-background area collapses the current-analysis panel.
- Clicking a design, history surface, conversation dock, toolbar, or analysis-panel content must not collapse it.
- Switching projects resets the current-analysis panel to expanded.

## Request Preview and Expansion

- The request header shows the current task request in a single ellipsized line by default.
- Place two icon actions at the right edge of the request row:
  - copy the request into the conversation composer;
  - expand or collapse request details.
- When expanded, show:
  - the complete request text;
  - all image assets referenced by the selected conversation task.
- Request-detail expansion is local to the displayed task and resets to collapsed when the displayed analysis changes.

## Loading Analysis Images

- Use the selected conversation task’s `contextAssetIds` as the source of analysis images. These IDs cover uploaded conversation attachments and referenced project assets persisted with the task.
- Resolve asset metadata through `listAssets` so the original name and MIME type are retained.
- Read bytes through `readAsset` and construct preview URLs for image-compatible assets.
- Ignore unavailable or non-previewable assets without preventing the text analysis from rendering.
- Protect asynchronous loads against task changes so stale assets are not shown for a newly selected analysis.

## Copy to Conversation Composer

- The current-analysis panel emits the selected task’s request text and resolved image attachments through an explicit callback.
- Merge copied content into the controlled conversation composer state:
  - if the composer is empty, use the copied request directly;
  - otherwise append the copied request after a blank line;
  - do not append a duplicate request when the current composer already ends with the same trimmed text.
- Merge images without replacing existing attachments.
- Deduplicate project-backed images by `assetId` and uploaded images by a stable fallback based on name, MIME type, and bytes when an asset ID is unavailable.
- Synchronize `referencedAssetIds` with the merged project-backed attachments so later submission preserves image references.

## Scrolling and Visual Treatment

- Keep wheel, trackpad, touch, and keyboard scrolling functional.
- Hide visible scrollbars for:
  - the current-analysis result body;
  - the expanded request-image strip;
  - the analysis-history list.
- Use both Firefox `scrollbar-width: none` and WebKit scrollbar suppression.
- Preserve the existing panel surfaces, shared corner radius, subtle lower shadow, typography, and blue selection treatment.

## Component Boundaries

### `ProjectCanvas`

- Owns overall analysis visibility, current-panel collapsed state, selected analysis task, selected designs, resolved task attachments, and conversation composer state.
- Loads selected-task context assets.
- Implements copy-and-merge behavior.
- Leaves the history list open after selection.
- Responds to the stage background callback by collapsing the current-analysis panel.

### `ProjectCanvasStage`

- Adds a canvas-background callback that fires only when the stage itself is clicked or tapped.
- Existing design click, double-click, drag, and selection behavior remains unchanged.

### `AnalysisPanel`

- Renders the request row, request-details expansion, copy action, and panel-collapse action.
- Keeps analysis-result streaming, markdown rendering, generation action, and retry behavior unchanged.
- Receives resolved attachments and callbacks; it does not read assets or mutate composer state.

## Error Handling

- Missing asset metadata or bytes omits only that image.
- Asset-loading failures do not close the panel or clear the displayed analysis text.
- Copy remains available for text even when no images can be resolved.
- Existing task failure and retry presentation remains unchanged.

## Accessibility

- Every icon-only action has a localized accessible label.
- Collapsed and expanded controls expose `aria-expanded` where applicable.
- History status retains visible text in addition to icons.
- The collapsed animation is decorative and does not repeatedly announce progress.
- Existing live-region behavior for streamed analysis content remains intact.

## Test Strategy

- `AnalysisPanel` tests:
  - request text is one line by default;
  - expansion reveals full text and images;
  - copy and collapse callbacks receive the expected data;
  - the collapsed representation shows the three-dot indicator and expand action.
- `ProjectCanvasStage` tests:
  - background click invokes the collapse callback;
  - design clicks do not invoke it.
- `ProjectCanvas` tests:
  - history label is updated;
  - status icons match task state;
  - selecting a history item keeps the list open;
  - selecting a history item expands the current panel and selects matching designs;
  - copying appends text, merges images, and deduplicates existing content;
  - task context images are loaded from persisted assets.
- CSS-oriented assertions verify that relevant scroll regions carry the scrollbar-hiding treatment without disabling overflow scrolling.

## Out of Scope

- Persisting panel collapse or request expansion across app restarts.
- Adding thumbnails to history rows.
- Changing the number, order, or generation semantics of design candidates.
- Changing the global analysis panel used by the document workbench.
