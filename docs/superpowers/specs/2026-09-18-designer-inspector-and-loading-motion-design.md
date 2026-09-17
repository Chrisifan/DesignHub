# Designer Inspector and Loading Motion Design

## Goal

Align the designer inspector with the established review-and-publish dossier layout, while retaining inspector-only portfolio content and footer actions. Smooth the portfolio analysis and Avatar-generation loading animations without changing task behavior.

## Constraints

- Keep the designer inspector drawer at the existing `min(520px, 92vw)` width.
- Treat the supplied image as visual reference only. Do not copy unsupported fields or text.
- Keep edit, use-for-new, set-default, restore, and delete actions in the drawer footer.
- Preserve the current designer data model, selection behavior, persistence, analysis flow, Avatar generation flow, and four-step wizard.
- Preserve both light and dark themes through existing design tokens.
- Preserve `prefers-reduced-motion` behavior.
- Avoid horizontal overflow and incoherent text overlap at desktop and narrow viewports.

## Selected Direction

Use one shared dossier presentation for the review-and-publish step and the designer inspector. The inspector appends its curated portfolio section after the shared dossier content.

This direction was selected over two alternatives:

- Rendering the review card unchanged in the inspector would be simpler, but would remove the inspector's curated portfolio content.
- Restyling the existing inspector independently would retain all current markup, but would leave two visual systems that can diverge again.

The selected direction provides visual consistency while preserving inspector-specific information.

## Shared Presentation Boundary

Refactor the full dossier portion of `DesignerProfileCard` into a reusable read-only presentation unit. It owns only profile display and receives an existing `PersonaProfile`, locale, and narrowly scoped display options.

Both consumers use the same rendered structure for:

- Avatar and identity.
- Persona code and version.
- Signature, tags, and publication status.
- Four core visual metrics.
- Style DNA palette, typography, composition, material, rendering, and grain.
- Negative rules and their empty state.

The shared presentation must not own selection, drawer state, editing, publishing, default selection, persistence, or task execution.

`DesignerProfileCard` review mode continues to compose the shared presentation for the portfolio wizard. `PersonaInspector` composes the same presentation and then adds inspector-only sections. This retains stable public call sites while removing duplicated dossier markup.

## Inspector Layout

### Shared Dossier

The inspector begins directly with the review-and-publish dossier flow:

1. Compact Avatar and identity header.
2. Four core visual metrics in a two-column grid.
3. Style DNA section.
4. Negative Rules section.

Remove the inspector's separate profile-inspector heading, large archetype hero, project-reference counters, session-default counter, hidden creative-principle block, and duplicate Style DNA and negative-rule markup. These elements either duplicate the shared dossier or create a competing hierarchy.

Session-default state remains visible through the footer button label. It does not require another content metric.

### Curated Portfolio

Keep the inspector's curated portfolio after the shared dossier. It contains the existing portfolio sheet previews, localized titles, notes, and count. An empty portfolio collection shows a localized empty state instead of leaving an unlabeled blank section.

Use stable preview dimensions and the existing responsive grid. Long titles and notes must remain contained through wrapping or truncation appropriate to the current component.

### Notes and Footer

Retain the current read-only or workspace-storage note beneath the content when applicable.

Keep all inspector commands in the existing drawer footer:

- Edit.
- Use for new.
- Set default or current default.
- Restore for archived profiles, otherwise delete.

Footer behavior, permissions, disabled states, and callbacks do not change.

## Loading Motion

### Root Cause

The analysis loading state currently animates `background-position` independently on six large skeleton elements. This causes their painted backgrounds to be recomputed continuously. The animation also returns from its final background position to its initial position at every loop boundary, producing a visible periodic hitch. The drawer backdrop blur increases total rendering cost but is not the primary defect.

The progress indicator already animates with `transform`, but its alternating direction makes the motion reverse at each endpoint and contributes to the stop-start feeling.

### Skeleton Implementation

Render each skeleton block with a static token-based base background and clipped overflow. Add a single shimmer layer through a pseudo-element whose gradient remains visually independent from the base.

Animate only the shimmer layer's `transform: translate3d(...)`. Give the layer enough off-screen travel at both ends that the loop resets while fully outside the visible block. This removes the visible endpoint jump and keeps movement on a compositor-friendly property.

All analysis skeleton blocks use the same `1.8s linear` animation with no staggered delay, so they read as one stable loading state rather than a distracting wave.

The Avatar skeleton uses the same motion primitive and maintains its square dimensions.

### Progress Indicator

Keep the indeterminate progress track, but use a continuously forward-moving fill. The fill begins completely before the track, travels completely past it, and resets off-screen. Do not alternate direction.

Use the same `1.8s linear` duration as the skeleton shimmer so the motion does not visibly pause at the endpoints.

### Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- Disable shimmer and progress animations.
- Keep static skeleton shapes and a static partial progress fill.
- Preserve all loading text and live-region semantics.

## Responsive Behavior

- The drawer retains `min(520px, 92vw)`.
- The identity header remains side by side at the normal drawer width and stacks at the existing narrow breakpoint.
- Core metrics use two columns normally and one column when necessary.
- Style DNA and Negative Rules remain vertically ordered.
- Curated portfolio previews use the current three-column layout where space allows and reduce columns at narrow widths.
- Footer actions may wrap without overlapping or changing the drawer width.

## Accessibility

- Preserve semantic headings and labelled dossier sections.
- Preserve metric `progressbar` semantics and valid percentage normalization.
- Preserve the inspector drawer's accessible name.
- Keep skeleton shapes hidden from assistive technology while retaining localized loading text inside the polite live region.
- Do not rely on animation or color to communicate that analysis or Avatar generation is in progress.
- The curated portfolio retains meaningful localized text adjacent to decorative previews.

## Testing

### Component Tests

- The inspector renders the same identity, four metrics, Style DNA, and Negative Rules content as review mode.
- The inspector retains curated portfolio content after the shared dossier.
- The inspector no longer renders the old profile counters or duplicate inspector hierarchy.
- Empty negative rules and empty portfolio collections render localized empty states.
- Existing inspector callbacks and disabled footer states continue to work.

### Style Contract Tests

- Skeleton motion targets a pseudo-element and animates `transform`, not `background-position`.
- Progress animation is forward-only and does not use `alternate`.
- Reduced-motion rules disable both motion primitives and leave stable fallback states.
- The existing drawer width contract remains unchanged.

### Browser Tests

- At desktop and narrow viewport sizes, the inspector contains the shared dossier plus curated portfolio without horizontal overflow.
- Footer actions remain visible, contained, and operable.
- The review step and inspector show the same dossier section order and profile values.
- Screenshots verify identity hierarchy, metrics, Style DNA, rules, portfolio density, and narrow-screen wrapping.
- Loading-state screenshots and computed styles verify stable skeleton dimensions and the compositor-based animation setup.

## Out of Scope

- Changes to portfolio analysis prompts, response parsing, polling, or error recovery.
- Changes to Avatar-generation prompts, provider selection, asset transport, or retry behavior.
- New profile fields or editable inspector content.
- Changes to drawer width, footer commands, designer library cards, or portfolio wizard steps.
- Removal of the drawer backdrop blur across the rest of the application.
