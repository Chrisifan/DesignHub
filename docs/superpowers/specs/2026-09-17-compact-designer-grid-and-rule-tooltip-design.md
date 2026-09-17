# Compact Designer Grid and Rule Tooltip

## Goal

Increase the designer repository's scanning density and prevent long negative-rule text from changing the portfolio analysis layout.

## Designer Repository

- Use four equal-width columns at the normal desktop layout.
- Preserve the existing whole-card selection interaction and dossier content.
- Keep the artwork at a stable 4:3 ratio and tighten spacing only where necessary for the four-column layout.
- Preserve the existing single-column layout at viewports up to 720px.
- Names, signatures, tags, metrics, and version text must remain inside the card without horizontal overflow.

## Negative Rules

- Each negative rule remains an individual chip in the portfolio analysis result.
- Rule text stays on one line.
- Text that exceeds the available width is truncated with an ellipsis.
- Hovering the truncated text exposes the complete rule through the repository's existing native `title` tooltip pattern.
- The alert icon remains visible and must not shrink when the text is long.

## Accessibility

- The full negative-rule value remains in the DOM and in the `title` attribute.
- Visual truncation must not replace or mutate the stored rule value.
- Existing region labels and whole-card accessible names remain unchanged.

## Verification

- Unit coverage verifies that negative rules expose their complete tooltip text.
- Browser coverage verifies four repository columns at desktop width and one column at the existing narrow breakpoint.
- Browser coverage injects a long negative rule and verifies one-line ellipsis without horizontal overflow.
- Desktop and narrow screenshots are inspected for card density, text containment, and rule-chip stability.
