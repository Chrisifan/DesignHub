# Neural Presence Clarity and Working Pulse

## Goal

Make the compact Neural Presence in the project canvas legible at a glance and give its `working` mode a distinctive execution rhythm. The approved visual direction is **execution pulse**: a warmer, coherent core feeds grouped energy pulses through the entity's existing membrane structure.

## Scope

- Increase the contrast of the core, membrane outlines, cross-links, and interior fills for the compact canvas entity.
- Keep the existing circular, translucent wireframe silhouette and existing canvas placement.
- Retain irregular inter-membrane connection growth exclusively for `thinking`.
- Add `working`-only execution pulses that traverse the existing layers with a warmer accent and a repeatable rhythm.
- Preserve the existing `PresenceMode` contract, task-state mapping, terminal feedback, and reduced-motion semantics.

Out of scope:

- Changing task selection, task persistence, animation timing ownership, panel transitions, or canvas layout.
- Adding visible labels, badges, external rays, a second entity, or a new component API.
- Replacing the canvas renderer or altering the entity's underlying deterministic field geometry.

## Visual Behavior

### Shared compact clarity

The compact rendering increases opacity and line weight modestly across the core boundary, membrane polygons, radial cross-links, and membrane node dots. The core halo and fill gain enough contrast to make the entity legible against both light and dark canvas surfaces without becoming an opaque orb. The palette and translucent layering remain unchanged in character.

### Thinking

Thinking continues to use its current irregular connection-growth behavior. It remains exploratory and non-uniform: connections appear between different membrane layers, grow, then collapse. Its brightness may benefit from the shared clarity adjustments, but it receives no execution-pulse treatment.

### Working: execution pulse

Working keeps its distinct accelerated membrane movement and warm core, then adds several grouped pulses. Each pulse originates close to the core, travels outward along a selected membrane/radial route, and fades at the outer structure. Staggered launch times make the entity read as continuously processing rather than looping like a spinner. Pulses use the existing amber tone with cyan membrane contrast, so their purpose is evident without relying on text.

The pulses are deterministic from elapsed time and field indexes. They add no persisted or React state and do not change pointer interaction.

## Rendering Design

`drawPresence` remains the sole canvas renderer. It will derive two local profiles from `mode`:

- a shared compact contrast profile for the existing primitive opacities, shadows, and line widths;
- a working pulse profile that determines pulse routes, normalized progress, opacity envelope, and warm glow.

The working renderer draws its pulse layer after membranes/cross-links and before or alongside energy-seed sparks, allowing the moving energy to remain visible while preserving the core's depth. Thinking connections remain in their existing conditional block; no shared helper should cause them to render in working mode.

## Accessibility and Motion

The compact entity remains semantically unchanged: the surrounding button exposes task status, while the canvas remains non-interactive inside the project canvas. Under `prefers-reduced-motion`, the existing requestAnimationFrame behavior remains static after the initial draw; the more opaque static artwork still makes working state visually clearer without motion. No flashing, strobing, or semantic status changes are introduced.

## Testing

Add renderer-level assertions for the pure working motion profile so tests can prove it differs from thinking and idle without snapshotting pixels. The tests should verify that working pulses exist at a representative elapsed time, have bounded normalized progress and alpha, and are absent for thinking/idle. Existing mode, terminal-profile, and component tests remain regression coverage for the public contract.

## Acceptance Criteria

1. The compact canvas entity is visibly readable against the canvas without relying on hover or the status text.
2. Working state clearly reads as sustained execution through grouped outward pulses and a warm active core.
3. Thinking retains its irregular exploratory connections and does not render working pulses.
4. No task-state, layout, component API, accessibility label, or reduced-motion behavior changes.
5. Focused renderer and existing canvas tests pass.
