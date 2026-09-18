# Designer Rule Tooltip Design

## Goal

Keep negative-rule rows compact in every designer workflow while preserving access to the complete rule text. Review-and-publish, the shared designer dossier, portfolio analysis, and the designer edit preview must show one visual line with an ellipsis and an application-rendered tooltip.

This specification supersedes the native `title` tooltip decision in `2026-09-17-compact-designer-grid-and-rule-tooltip-design.md` for negative-rule text.

## Scope

The change covers three presentation paths:

- `DesignerDossier`, shared by review-and-publish and the designer inspector.
- The portfolio analysis result shown before Avatar generation.
- The negative-rule summary inside the designer edit preview.

Stored profile data, editing inputs, parsing, publishing, and persistence do not change.

## Shared Tooltip

Add a reusable Tooltip component to the studio UI layer instead of using the browser `title` attribute.

- The trigger remains ordinary inline content and receives keyboard focus.
- Hovering or focusing the trigger opens the tooltip.
- Leaving the trigger, blurring it, or pressing Escape closes the tooltip.
- The tooltip is rendered through a portal with fixed positioning so drawer and modal overflow cannot clip it.
- Position is derived from the trigger bounds, constrained to the viewport, and may move above the trigger when there is insufficient space below.
- The tooltip uses `role="tooltip"`; the trigger references it with `aria-describedby` only while it is open.
- Tooltip text may wrap within a bounded width. It must not introduce page-level horizontal overflow.
- Negative-rule triggers must not have a `title` attribute.

The component owns presentation and interaction only. Consumers provide the complete localized string.

## Rule Presentation

Each visible rule row keeps its existing alert icon and visual treatment. The text area becomes a dedicated flex child with `min-width: 0`, `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap`.

For the designer edit preview, the rules label remains above the value. The preview value collapses embedded newlines into a single visual line; the tooltip preserves the complete localized draft text, including separate rules.

The tooltip is available whenever a rule value is present. The empty-state copy remains plain text and does not receive a tooltip.

## Accessibility

- Full text remains available in the DOM inside the tooltip.
- Mouse hover and keyboard focus expose the same content.
- Focus indicators use the existing studio focus treatment.
- Escape dismisses the tooltip without changing drawer or modal state.
- Existing section labels, list semantics, and alert icons remain unchanged.

## Testing

Component coverage must verify:

- Hover and focus reveal a tooltip containing the complete rule.
- Escape, pointer leave, and blur dismiss it.
- The trigger uses `aria-describedby` while open and never uses `title`.
- Review dossier rules and the edit preview use the shared tooltip.

Style-contract or browser coverage must verify:

- Dossier, analysis, and edit-preview values compute to one-line ellipsis styles.
- Long rules stay inside their containers without horizontal overflow.
- The tooltip is visible above drawer and modal content and remains inside the viewport.

## Out of Scope

- Tooltip migration for unrelated tags, names, or controls.
- Changes to negative-rule editing syntax or stored values.
- Changes to drawer, modal, or dossier dimensions.
