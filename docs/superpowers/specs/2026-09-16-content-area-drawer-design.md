# Content-Area Drawer Boundary Design

## Goal

Change shared drawers from covering the entire application window to covering only the right-side studio work area. The top window bar and the left navigation remain visible and interactive while a drawer is open.

## Scope

- Keep existing drawer content, open/close triggers, focus behavior, Escape handling, backdrop dismissal, and scroll behavior.
- Change only the drawer's mounting boundary and the CSS positioning needed to fill that boundary.
- Apply the behavior to every existing consumer of the shared `Drawer` component.
- Preserve a `body` fallback for isolated renders where the studio host is not mounted.
- Do not redesign drawer content or introduce a mobile-specific sheet variant.

## Architecture

### Drawer host

`Studio` marks `.studio-main` with a stable drawer-host attribute. The element already represents the complete right-side work area, including the workspace toolbar and page body, and excludes the window bar and navigation sidebar.

### Shared Drawer

`Drawer` resolves the nearest available studio host when it opens. Its portal target is the host when present and `document.body` otherwise. The fallback keeps component tests and standalone consumers functional without requiring a full `Studio` shell.

The drawer root changes from viewport-fixed to host-absolute positioning. It fills the host with `inset: 0`, keeps the existing right alignment, and retains its existing z-index, backdrop, panel width, animation, and independent content scrolling.

### Layout interaction

Because the host is the real layout container rather than a hard-coded offset, the drawer follows the studio main area when the sidebar is collapsed, the window is resized, or the application enters compact layout. The drawer does not change document flow and does not narrow the underlying page.

## Behavior

- Opening a drawer masks only `.studio-main`.
- The window bar and `.studio-sidebar` remain visible.
- Clicking the work-area backdrop, pressing Escape, or using the close button closes the drawer.
- Focus returns to the triggering control after close.
- The body overflow lock remains in place while the drawer is open, preventing background page scrolling.
- If no host exists, the existing body portal behavior is used.

## Testing

Add focused tests that verify:

- A drawer rendered inside the studio uses the studio host as its portal boundary.
- The drawer root has the host-scoped class/attributes needed for absolute positioning.
- The existing standalone drawer tests still pass with the body fallback.
- Existing studio, library, workbench, designer, and canvas drawer interactions remain available and closable.

Manual verification should confirm that the overlay starts at the right work-area edge, never covers the top window bar or left navigation, and still reaches the bottom of the studio work area at both expanded and collapsed sidebar widths.

## Non-goals

- No change to drawer width, panel typography, form controls, or content spacing.
- No change to global dialogs or toast placement.
- No change to selection persistence or page navigation semantics.
