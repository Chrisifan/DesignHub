# Page Empty State Alignment Design

## Goal

Remove the redundant title row from the designer repository and center every full-page empty state horizontally and vertically within the available page-content area.

## Scope

The designer repository no longer displays its local `PERSONA REPOSITORY / 设计师档案 / count` heading. The shared workspace breadcrumb remains the page context, while the repository list or its empty state begins directly in the content area.

Full-page empty states use a shared page-level layout container that fills the remaining page-content height and centers `EmptyState` on both axes. This includes empty project library, brands, connections, tasks, storage, and repository/search-result pages when the absence of data represents the whole page's primary content.

## Boundaries

Do not center a local empty state against the entire page when it belongs to a bounded region. Asset-details errors, drawer content, delivery previews, split-pane panels, loading indicators, and any other embedded/secondary state remain centered or positioned only within their own existing container.

Search results that replace the page's primary collection count as page-level empty states and receive the centered layout. The page toolbar and breadcrumb stay outside the centered region, so controls retain their fixed location.

## Implementation shape

Add a semantic shared class such as `page-empty-state` to full-page empty-state wrappers. Its CSS sets a minimum block size appropriate to the scrollable page content and uses grid or flex centering. Apply the class at call sites rather than globally changing `.empty-state`, preserving panel-level empty-state behavior.

Remove the designer repository header JSX and the CSS rules dedicated to it. Keep the repository’s accessible label, selected-row behavior, toolbar controls, and drawer interaction unchanged.

## Accessibility and responsiveness

`EmptyState` retains its existing heading, description, buttons, and focusable controls. Centering changes visual layout only. On narrow viewports, the page-level region continues to fill available page height without horizontal overflow; empty-state text remains naturally constrained by the existing page padding.

## Verification

Add focused tests confirming that the designer repository no longer exposes its local heading and that applicable empty states render inside the page-level empty-state wrapper. Run the relevant Studio, library, and designer Vitest suites, followed by the complete unit suite, type check, lint, and production build.
