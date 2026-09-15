# Right Drawer Panels Design

## Goal

Replace the persistent right-hand columns used for detail, inspector, and configuration views with a consistent right-side overlay drawer. The main content must use the full available width while the drawer is closed.

## Confirmed interaction model

- Drawers enter from the right and overlay the active page or canvas rather than reflowing it.
- The overlay dims the underlying content. Clicking that overlay, pressing Escape, or using the visible close control closes the drawer.
- Selecting a list row, asset, designer, connection profile, or canvas layer opens its associated drawer automatically.
- Closing a drawer retains the underlying selection unless the existing screen already clears it. No standalone “open details” button is required.
- Drawers have an independent scroll area and use `min(520px, 92vw)` as their maximum inline size so they remain usable on compact windows.
- The same interaction applies to the canvas Inspector.

## Scope

The following existing right-hand regions become overlay drawers:

| Surface | Trigger | Drawer content |
| --- | --- | --- |
| Asset library | Select an asset | Asset preview, metadata, and actions |
| Brand kits | Select a brand kit | Brand details and edit/delete actions |
| Designer library | Select a designer profile | Persona inspector |
| Model connections | Select a connection capability | Provider configuration |
| Delivery | Select an active project/document | Delivery configuration |
| Canvas workspace | Select one or more layers | Layer Inspector |
| Workbench | Select an existing context tool/panel | Properties, conversation, history, or tools context |

This change does not turn ordinary multi-field form layouts, modal editors, or inline comparison layouts into drawers. Their simultaneous visibility is intentional and remains unchanged.

## Architecture

### Shared Drawer component

Create a reusable studio UI component that renders into `document.body` with a portal. Its public contract accepts open state, an accessible title/label, close callback, and children.

The component owns:

- right-side transition and backdrop styling;
- a labelled dialog landmark, initial focus on the close control, focus trapping, and restoration of the trigger focus on close;
- Escape and backdrop dismissal;
- prevention of background scrolling while open;
- a single independently scrollable drawer body.

The drawer does not own selection or page-specific persistence. It is a presentation and accessibility boundary only.

### Page adapters

Each affected surface keeps its existing selected-item state and places the previous right-column markup in the shared Drawer. A local `isDrawerOpen` state records whether the selection is currently revealed.

- Item-selection callbacks update selection and open the drawer in one user action.
- Existing selection defaults may remain for data lookup, but must not display a detail column while the drawer is closed.
- Empty and failed states remain in the full-width main surface instead of creating an empty drawer.
- The canvas opens the Inspector only when one or more layers are selected. Deselecting layers closes it; a manual close leaves selected layers intact.
- The workbench preserves its current context panel picker. Choosing a context panel opens or replaces the drawer; closing changes only visibility, not the chosen panel.

### Layout changes

Remove the persistent right grid track from affected library and workbench layouts. Main lists, previews, and canvases become the only in-flow content. Drawer z-index and backdrop are global, avoiding clipping by page-level `overflow` rules.

The form and metadata styles inside the former columns remain unchanged wherever possible. Drawer-specific spacing is applied at the shared wrapper, keeping detail content portable across pages.

## Error handling and state edges

- A failed or empty data load shows its current full-page empty/error state and never opens a blank drawer.
- If a selected record disappears after a mutation, the surface closes its drawer and chooses or clears selection according to its existing behavior.
- Read-only mode keeps controls disabled as today; it does not block inspection.
- Pointer, keyboard, and screen-reader users can all close the drawer without relying on a selected row remaining mounted.

## Testing

Add focused component tests for the shared Drawer:

- renders only while open and exposes an accessible dialog label;
- closes from its close button, Escape, and backdrop;
- restores focus to the element that opened it.

Update affected UI tests to verify:

- selecting assets, brands, designers, connection profiles, and canvas layers opens the appropriate drawer;
- dismissing the drawer leaves the main surface usable and no longer renders a persistent split detail column;
- workbench context selection opens the context drawer;
- existing form actions and read-only behavior remain available inside a drawer.

Run the relevant Vitest suites first, then the complete test suite and the existing UI/browser test command if it is configured for the repository.

## Non-goals

- No changes to stored data, provider credentials, project metadata, or selection persistence.
- No mobile-only bottom-sheet variant in this change; compact windows use the same right drawer at near-full width.
- No redesign of the content inside existing detail or configuration panels beyond the shared drawer affordances.
