# Breadcrumb Toolbar Convergence Design

## Goal

Converge each studio destination on one compact workspace toolbar: navigation context remains on the left, while page-specific controls are rendered on the right in a predictable sequence. This removes the duplicate page-header control strip without removing page identity or functionality.

## Chosen layout

Use the approved **Scheme A**. The existing `.studio-toolbar` is the sole desktop toolbar for page actions. Its right side renders applicable controls in this fixed order:

1. Category or status filter, as a compact segmented control matching the approved reference: a quiet shared container with the active item on a subtle raised surface and primary cyan text.
2. Search input.
3. Grid/list or other representation switch.
4. Page actions as compact icon buttons. When an action needs a text label to remain understandable, it stays in the toolbar as the existing labeled button rather than being converted into an ambiguous icon.

The left side continues to show sidebar toggle, workspace name, and current breadcrumb. The visible page heading is reduced to semantic identity only: title, optional eyebrow, and optional description. It no longer renders a second action group.

The toolbar owns only controls that are meaningful for the current destination. Pages without a category, search, representation toggle, or action omit that slot; no disabled or empty substitute controls are introduced. The surviving controls always preserve the same order.

## Component boundary and data flow

`Studio` remains the coordinator. It computes a `toolbarActions` element for the active surface/destination and passes existing handlers and state into the relevant page views. Page views expose their filter, search, display-switch, and action controls through a focused toolbar slot instead of independently placing them in `PageHeader` or content-level header strips.

`PageHeader` retains the current title, eyebrow, and description API but no longer needs to act as a page-action host. Its structural action wrapper is removed or made absent when no action slot is supplied, so every destination shares a compact vertical rhythm.

Existing input state and callbacks remain authoritative in their current owners. Moving a control must not reset a search term, category, view mode, selection, import state, or permission state while navigating between supported destinations.

## Destination rules

- **Project library:** project-status category, project search, current view switch when available, then project actions.
- **Assets:** asset-type category, asset search, grid/list switch, then import/create actions subject to existing writable/read-only guards.
- **Designer/persona repository:** persona-status category and search are promoted from the local repository header; it has no representation switch unless one already exists.
- **Brands, connections, tasks, delivery, settings, and project/detail surfaces:** promote only their existing header-level controls. Existing content tabs that change the main body remain content tabs rather than being reclassified as toolbar categories.
- **New-design and canvas flows:** retain their navigation-oriented toolbar controls; do not add irrelevant category or search controls.

## Responsive behavior

At wide widths the toolbar is one line, with the page control group aligned to the right of the breadcrumb. At narrow widths the breadcrumb location keeps priority and the right group wraps below it in the same slot order. Controls retain their current accessible labels, touch targets, focus behavior, disabled states, and overflow protection. The search field may flex to fill remaining space but does not force horizontal scrolling.

## Styling

Use the existing studio tokens and control primitives. Introduce a shared compact segmented-control style for toolbar categories rather than reusing the larger underlined content tabs. Search, view toggles, and icon actions use the existing control height, border, and hover/focus language so that migrated pages match the workspace shell and the previously approved drawer UI.

## Accessibility and error handling

Category filters remain semantic buttons with `aria-pressed`; layout switches retain their existing grouped labels and pressed state; search fields retain `type="search"` and accessible labels. Page actions preserve disabled/read-only/importing behavior exactly. If a destination has no controls, the right toolbar action container is empty without creating blank spacing.

## Verification

Add focused component and Studio integration tests for:

- the fixed category → search → view → action DOM order on an asset-like destination;
- project actions continuing to appear in the workspace toolbar and no longer appearing in the page heading;
- persona category/search promotion without a spurious view switch;
- filter/search state surviving navigation as it does today;
- narrow-layout class rules or rendered structure maintaining one toolbar ownership point.

Run the affected Vitest suites, then the repository's full test and production build commands. Perform a visual browser pass at desktop and narrow widths for each top-level destination.
