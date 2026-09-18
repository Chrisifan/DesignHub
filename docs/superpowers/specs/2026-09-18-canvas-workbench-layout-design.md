# Canvas Workbench Layout Design

## Goal

Reorganize the canvas workspace to match the supplied reference image's functional layout while preserving the application's existing theme, tokens, typography, and business behavior.

The finished workspace should read as a full-screen editing surface: the artwork is the visual center, persistent controls are reduced to compact edge rails, contextual controls float over the canvas, and AI actions live in a bottom command dock.

## Confirmed Direction

Use the reference-style full-screen workbench layout:

- a narrow tool rail on the left;
- horizontal and vertical rulers around the canvas;
- a canvas that fills the remaining workspace;
- a floating quick-properties panel for the active selection;
- a compact tool rail on the right;
- a bottom AI command dock with model status, prompt input, task/history access, and send/generate actions;
- overlay panels or drawers for detailed content that does not fit in the compact surface.

This change does not copy the reference image's color palette, typography, or branding. Existing theme variables remain authoritative in dark and light modes.

## Layout Architecture

### Workbench shell

`Workbench` remains the state owner for project-level editing controls, context panel selection, prompt state, revision state, task state, and export behavior. Its DOM is reorganized into one canvas-first shell instead of a toolbar above a multi-column body.

The shell has five spatial layers:

1. A compact top strip containing document identity, save state, viewport controls, and export.
2. A left tool rail containing selection, text, shape, image, and layers controls.
3. A central canvas surface with rulers and document metadata.
4. A right tool rail containing properties, conversation, history, and image-tools entry points.
5. A bottom command dock containing connection state, the current prompt, task/history shortcuts, and send/generate actions.

The central canvas remains the only in-flow content area. Rails, floating panels, and the command dock overlay it without reducing its size.

### Layers

The existing layer list is no longer a persistent left column. The layers control in the left rail toggles a floating layer panel anchored beside the rail. The panel keeps all existing selection, visibility, and lock controls. Closing it does not clear the selected layer.

For workspace-backed documents, the embedded `CanvasWorkspace` must not render a second header and permanent layer column. It adopts an embedded presentation in which the canvas stage fills its host and its scene controls are surfaced through the workbench layout. This removes duplicated chrome without changing scene persistence or editing behavior.

### Rulers and canvas

The workbench canvas gains horizontal and vertical ruler bands with evenly spaced tick marks and a centered coordinate label. They are interface guides only; they do not alter scene coordinates or persistence.

The existing optional grid remains functional. Rulers stay visible regardless of grid state. The canvas stage is inset by the ruler dimensions and centers the document within the remaining area. Zoom continues to affect the document preview, not the surrounding rails or dock.

### Quick properties

Choosing a layer or the properties entry point reveals a compact floating properties panel over the right side of the canvas. It contains the existing active-layer summary and high-frequency controls such as position and opacity. It is context-dependent and can be dismissed without clearing selection.

The panel uses the project's existing surface, border, input, badge, and focus styles. It does not introduce reference-specific colors.

### Right tool rail and detailed drawers

Properties, conversation, history, and image tools remain the four workbench contexts. Their compact entry points move from the top toolbar to the right rail.

- Properties opens the floating quick-properties panel.
- Conversation focuses or reveals the bottom command dock.
- History opens the existing detailed drawer.
- Image tools opens the existing detailed drawer.

Detailed history, revision comparison, candidate actions, and image-tool configuration remain in the shared right-side `Drawer`. Their data flow and actions are unchanged.

### Bottom command dock

The bottom command dock replaces the conversation drawer as the primary prompt entry. It contains:

- the current model connection state and connection shortcut;
- the current prompt text area in a compact single-row presentation;
- task and history shortcuts;
- send and generate actions.

The same `prompt`, `submitPromptRequest`, and `submitGeneration` logic continues to power these controls. Read-only mode disables mutation actions as it does today. Longer conversation guidance and connection messaging may remain available through an expanded conversation drawer or popover, but the prompt's primary workflow must be available without covering the canvas.

## Responsive Behavior

The reference layout targets the desktop Electron workspace. At wide sizes, both rails, rulers, floating properties, and the command dock are visible at once.

At narrower window widths:

- the floating layer and properties panels stay within the canvas bounds;
- the command dock reduces secondary labels before reducing the prompt width;
- detailed content continues to use the existing near-full-width drawer behavior;
- controls remain reachable and no horizontal page scrolling is introduced.

The canvas remains usable down to the application's existing compact-window breakpoint. This change does not introduce a separate mobile layout.

## State and Data Flow

No new persisted state is required.

- Layer selection, visibility, locking, zoom, grid visibility, and context panel state remain local React state.
- Scene changes continue through `persistScene` and `CanvasWorkspace`'s existing `onSceneChange` path.
- Prompt submission continues through the existing conversation and image-generation callbacks.
- Revision loading, saving, comparison, continuation, and finalization remain unchanged.
- Closing a floating panel changes visibility only; it does not mutate the active layer, scene, prompt, or revision state.

## Accessibility

All tool rails retain toolbar roles and accessible names. Icon buttons retain text labels through the existing `IconButton` component. Floating layer and quick-properties panels use labelled complementary regions; drawers retain their current dialog behavior and keyboard handling.

Focus order follows the visual workflow: top document controls, left tools, canvas, right context tools, then bottom command dock. Floating panels must not trap focus. Shared drawers continue to trap and restore focus according to the existing drawer contract.

## Error Handling and Edge Cases

- When no layer is selected, the quick-properties panel remains closed.
- When a selected layer is locked, its mutation controls remain disabled and the existing lock guidance is shown.
- When no model is connected, prompt text remains preserved and the existing connection action is used.
- When a workspace document has no scene layers, the canvas remains visible and no empty floating inspector is opened.
- Read-only workspaces remain fully inspectable while editing, generation, and revision actions stay disabled.
- Canvas-unavailable fallback content remains centered inside the stage and does not displace the surrounding workbench chrome.

## Testing

Update focused `Workbench` and `CanvasWorkspace` tests to verify:

- the canvas is the only in-flow body region;
- the left and right controls expose their existing accessible labels;
- the layers control opens and closes the floating layer panel without clearing selection;
- properties open as a floating panel rather than a drawer;
- history and image tools still open the shared drawer;
- the bottom command dock submits conversation and generation requests through the existing callbacks;
- read-only behavior is preserved;
- workspace-backed scenes render without duplicate canvas headers or permanent layer columns;
- rulers and document metadata render around the stage;
- compact viewport styling does not create horizontal overflow.

Run the focused Vitest suites, type checking, linting, and the existing Playwright workbench flow. Capture desktop and compact-window screenshots for visual comparison against the approved functional layout.

## Non-goals

- No theme, color-token, typography, icon-library, or brand redesign.
- No changes to the Konva scene model, document persistence, image loading, revisions, tasks, or provider APIs.
- No new drawing tools or canvas manipulation modes.
- No attempt to reproduce decorative content from the reference artwork.
- No redesign of detailed history, revision comparison, or image-tool forms beyond their placement in existing drawers.
