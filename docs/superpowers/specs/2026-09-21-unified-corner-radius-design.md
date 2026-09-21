# Unified Corner Radius Design

## Goal

Give DesignHub one consistent rectangular corner language by matching the existing analysis-result panel radius. All rectangular application surfaces and controls use a shared `10px` radius instead of unrelated fixed pixel values.

## Scope

The change covers application CSS under `src/app`, including the window shell, shared studio primitives, home, project detail, project canvas, conversation dock, workbench, designer/persona views, and library views.

The shared token is defined in the global token layer:

```css
--radius-ui: 10px;
```

Rectangular panels, cards, buttons, inputs, menus, popovers, dialogs, thumbnails, previews, and other ordinary rectangular controls must use `var(--radius-ui)`.

## Shape Exceptions

The following values retain their semantic meaning and are not converted to `10px`:

- `0` for intentionally square or edge-to-edge surfaces.
- `50%` for circles such as avatars, status dots, and circular icon buttons.
- `999px` for pills, tags, and capsule actions.
- `inherit` when a child must follow its parent clipping shape.
- Percentage-based or asymmetric radii used to draw artwork and organic decorative shapes.

Responsive overrides that only change a rectangular radius are removed or changed to `var(--radius-ui)`. A component must not invent a different fixed pixel radius based on viewport size.

## Migration Strategy

Add `--radius-ui` beside the existing shared layout tokens in `src/app/styles/tokens.css`. Replace every fixed, nonzero pixel `border-radius` in application CSS with the shared token unless it belongs to an explicit shape exception.

The migration changes presentation only. Component markup, interaction behavior, dimensions, spacing, and state handling remain unchanged. Existing dirty worktree changes are preserved and reviewed separately from the mechanical radius migration.

## Visual Result

The analysis-result panel remains the reference surface. Large cards and compact controls share its `10px` geometry, producing a more systematic interface. Circles, pills, and artwork remain visually recognizable because their shapes communicate function rather than hierarchy.

## Verification

- Add a CSS contract test that scans application styles and fails when a non-exempt fixed pixel radius remains.
- Verify the contract recognizes only `var(--radius-ui)`, `0`, `50%`, `999px`, `inherit`, and approved asymmetric or percentage artwork shapes.
- Run focused component tests for the project canvas and shared controls.
- Run ESLint, TypeScript, the production build, and the complete unit suite; report unrelated existing failures separately rather than masking them.
- Inspect representative light-theme surfaces: the project canvas, home, project detail, workbench, designer library, and modal/popover controls.

## Non-goals

- Changing colors, shadows, spacing, typography, or component dimensions.
- Redesigning circular controls or pill-shaped status elements.
- Refactoring component structure or application behavior.
