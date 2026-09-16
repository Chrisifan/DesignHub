# Drawer Footer Actions Design

## Goal

Add a non-scrolling footer area to shared drawers and place each drawer's primary actions there, while keeping item-specific contextual actions beside the item they affect.

## Structure

The shared `Drawer` renders three regions below its existing overlay root:

1. A fixed header with the title and drawer close control.
2. A flexible, independently scrollable content region.
3. An optional fixed footer rendered from a `footer` React node.

The footer has its own background and top divider. It is outside `.ui-drawer__content`, so long content never moves the footer out of view. It is omitted when no footer is supplied.

## Action placement

- Asset details: place, reference, and replace actions move to the footer.
- Brand details: edit and delete actions move to the footer.
- Provider settings: save configuration and test image generation move to the footer; per-profile credential save/delete remain beside the API key they modify because they are field-level actions.
- Designer inspector: edit, use for new, set default, delete, and restore move to the footer.
- Workbench: panel-level send, generate, and save-version actions move to the footer. History-item and tool-entry actions remain next to their associated item.
- Canvas inspector has no action buttons and only gains the shared footer structure when a future footer is supplied.
- The drawer close button remains in the header as an overlay-level control.

## Component API

Extend `DrawerProps` with `footer?: ReactNode`. Consumers pass a compact action group through this prop; content components retain their existing callbacks and state.

## Styling and accessibility

- `.ui-drawer` remains a flex column.
- `.ui-drawer__content` keeps `min-block-size: 0` and vertical scrolling.
- `.ui-drawer__footer` is `flex: 0 0 auto`, has a top border, and uses a stable padding/background.
- Footer actions remain keyboard reachable after content actions and do not require scrolling.
- Existing focus trap, Escape handling, backdrop dismissal, and body overflow lock remain unchanged.

## Testing

Add shared Drawer tests proving the footer is outside the scroll container and is omitted when not provided. Update affected page tests to assert primary actions remain available through the footer and preserve their existing callbacks. Run the full unit suite, typecheck, lint, and the connection drawer E2E layout test.

## Non-goals

- No redesign of individual action styles or labels.
- No automatic DOM button extraction.
- No relocation of item-specific history, tool, or credential actions that depend on local context.
