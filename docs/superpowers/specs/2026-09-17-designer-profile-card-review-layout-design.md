# Designer Profile Card And Review Layout Design

## Goal

Rework the portfolio wizard review step and the designer library cards into one cohesive profile-card language inspired by the supplied reference image, while preserving the existing 520-pixel portfolio drawer and current designer workflow.

The review step should feel like a complete, publishable designer dossier. The library should reuse the recognizable upper portion of that dossier so profiles are easy to scan and compare.

## Constraints

- Keep the portfolio drawer width at `520px`, capped at `92vw`.
- Treat the supplied image as visual reference only. Do not copy unsupported labels or invent data.
- Keep the existing four-step workflow, generation behavior, publishing behavior, inspector, persistence model, and footer actions.
- Keep library-card actions in the existing inspector. The cards themselves remain single-action selection controls.
- Support the existing light and dark themes with project tokens rather than fixed reference-image colors.
- Preserve usable layouts at desktop and narrow viewports without horizontal overflow.

## Considered Directions

### A. Vertical dossier

Place a compact Avatar and identity header first, followed by a two-column metric summary and vertically stacked Style DNA and Negative Rules sections. This is the selected direction because it preserves the reference image's technical dossier character while remaining readable inside a 520-pixel drawer.

### B. Compressed horizontal dossier

Keep the Avatar on the left and place identity and metrics beside it, followed by a denser two-column detail area. This more literally resembles the reference image, but creates cramped copy and fragile wrapping in the fixed-width drawer.

## Shared Presentation Boundary

Introduce a reusable designer-profile presentation component with two explicit modes:

- `review`: the full review-and-publish dossier.
- `library`: a compact card used by the designer repository.

The component consumes existing `PersonaProfile` data plus display state such as whether the profile is the default. It does not own selection, publishing, editing, generation, or persistence.

The portfolio review step currently holds a `DesignerDraft` and generated artwork before publishing. Convert that data into the same display shape at the call site, or expose a narrowly typed view model, so the shared presentation does not depend on wizard state.

## Review Layout

### Identity Header

The top dossier section contains:

- A square Avatar, approximately `112px` in the normal drawer layout.
- Designer name.
- Signature.
- Version and current status.
- Up to the available style tags, wrapped without changing the stable Avatar dimensions.

Use a restrained outlined container, a small monospace metadata treatment, and the existing primary accent. The Avatar must use `object-fit: cover` and a stable aspect ratio.

When a managed Avatar cannot load, replace the broken image presentation with a neutral icon-and-label fallback surface that retains the same dimensions and accessible name. Built-in profiles that do not have a generated Avatar continue to use their existing artwork treatment instead.

### Core Signals

Show four metrics in a two-column grid:

- Contrast.
- Shadow airiness.
- Whitespace ratio.
- Diffuse light.

Each metric includes its localized label, numeric percentage, and a short progress track. Invalid or missing data displays `--`, has no `aria-valuenow`, and renders an empty track. Grain remains in the material section so the header does not become overly dense.

### Style DNA

Present one vertically ordered Style DNA section containing:

- Up to four palette colors with their source values.
- Typography and composition summaries.
- Type family, weight, tracking rhythm, and composition topology when present.
- Texture and rendering summaries.
- Grain as a percentage metric.

The presentation is read-only. It must not restore the removed edit controls.

### Negative Rules

Present each negative rule as an individual compact warning row with an icon. Empty rule collections show a localized empty state rather than an empty container.

Do not add the reference image's rendering engine, step count, denoise strength, MBTI, or archetype fields because they do not exist in the current profile model.

### Footer And Published State

Keep the existing drawer footer actions:

- Back to Avatar.
- Publish preview.

After successful publishing, keep the dossier visible and show a localized published state. A publishing error must preserve all current profile content and show the existing error treatment.

## Library Card Layout

The designer repository continues to use a responsive two-column grid where space allows and collapses to one column at narrow widths.

Each card contains:

- A stable-ratio Avatar area in the upper portion.
- A small status label over or immediately below the image.
- Name and signature.
- Up to two style tags, followed by `+N` when additional tags exist.
- Two representative metrics selected consistently across every profile: whitespace and diffuse light.
- Version metadata.

Profiles without a generated Avatar retain the existing built-in artwork as their visual fallback. Generated profiles use their managed Avatar URL.

Default status is represented by an explicit localized label plus the current selected/default border treatment. Archived and draft states remain distinguishable without changing card dimensions.

The whole card remains one button. Activating it opens the existing inspector. Editing, using for a new project, setting the default, restoring, and deleting remain in the inspector footer.

## Content Resilience

- Long names and signatures use line clamps or ellipsis and expose full text with `title` where truncation occurs.
- Library tags show at most two visible values and a `+N` overflow indicator.
- Review tags may wrap across lines within the available width.
- Palette values are validated by the existing data path; malformed values must not break layout.
- Missing signals display explicit empty values rather than fabricated percentages.
- Stable aspect ratios and minimum content heights prevent cards from shifting as images load.

## Responsive Behavior

- The portfolio drawer remains `min(520px, 92vw)`.
- At normal drawer width, the identity header keeps Avatar and identity copy side by side.
- At narrow content widths, the identity header becomes vertical.
- The four core metrics use two columns normally and one column when necessary.
- Style DNA and Negative Rules remain vertically ordered in the drawer.
- Library cards retain the repository's two-column layout on desktop and collapse to one column at the existing narrow breakpoint.
- Footer actions may wrap but must not overlap content or each other.

## Accessibility

- Library cards retain button semantics, visible focus, a useful accessible name, and selected state.
- The dossier uses semantic headings and labelled sections.
- Metric tracks use `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-valuenow` only for valid numeric values.
- Decorative labels and artwork overlays are hidden from assistive technology where they duplicate visible text.
- Avatar fallback content preserves the same accessible image meaning.
- Color is not the only indication of default, draft, published, or archived status.

## Testing

### Component tests

- Review mode renders identity, Avatar, four core signals, Style DNA, palette, grain, and negative rules from existing data.
- Missing signals render `--` and omit `aria-valuenow`.
- Library mode renders the expected compact fields and only two visible tags plus an overflow count.
- Generated artwork and built-in artwork fallback paths both render.
- Avatar load failure switches to the stable fallback.
- Default and non-default cards expose distinct textual and selected states.
- Long names and signatures retain their full accessible or `title` text.
- Clicking a library card continues to invoke profile selection without triggering another action.

### Workflow tests

- The review step retains the generated Avatar and does not submit another generation request.
- Publishing still writes the selected generated asset to the profile.
- Back from review still returns to the Avatar step.
- Publishing failure preserves the dossier and reports the error.

### Browser tests

- The review drawer remains 520 pixels at desktop and respects the `92vw` cap.
- The review page has no horizontal overflow at desktop and narrow viewports.
- Footer controls remain visible and non-overlapping.
- Designer cards render as two columns on desktop and one column at the narrow breakpoint.
- Long identity content does not resize or overflow a card.

## Out Of Scope

- Changes to designer analysis or Avatar generation prompts.
- New profile fields such as MBTI, archetype, rendering engine, step count, or denoise strength.
- Inline editing on the review page or library cards.
- Moving inspector actions onto library cards.
- Changing the portfolio drawer width.
- Redesigning the existing designer inspector.
