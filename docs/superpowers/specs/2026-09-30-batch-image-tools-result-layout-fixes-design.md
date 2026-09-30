# Batch Image Tools Result Layout Fixes

## Scope

This change fixes five presentation and interaction defects shared by the batch image-tool result pages without changing task execution, persistence, or output generation.

## Layout

- Align the top edge of the right-side job overview with the top edge of the left task list by removing the detail column's extra top inset.
- Keep the existing spacing below each column so the result list remains visually separated from the overview.
- Show a single result-section title, `处理结果`; remove the duplicate `逐图结果` eyebrow.

## Result Directory Action

- Keep `打开结果目录` as the primary directory action.
- Replace the unsupported icon name with a directory icon already supported by the shared icon component.
- Preserve the existing click behavior and disabled state.

## Card Size Control

- Replace the decorative control with a real two-option segmented control: compact cards and large-preview cards.
- Store the selection as local page state and expose the selected state with `aria-pressed`.
- Apply the selected mode to the result grid so column width, preview height, and card density visibly change.
- Default to compact mode to preserve the current information density.

## Transparency Grid

- Build the checkerboard from semantic surface tokens with `color-mix()` instead of fixed light-gray colors.
- Keep the pattern subtle in light theme and low-contrast in dark theme while preserving transparent-image visibility.
- Apply the pattern to the full preview surface so it remains visible around contained images.

## Verification

- Component tests cover the single result title, rendered directory icon, and functional compact/large card control.
- Existing image-tool tests must remain green.
- The layout end-to-end test verifies column top alignment and that the card-size control changes rendered card geometry.
- A production build or type-check confirms no unsupported icon or styling regressions remain.
