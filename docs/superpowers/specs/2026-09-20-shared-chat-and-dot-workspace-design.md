# Shared Chat Dock And Interactive Dot Workspace

## Goal

Unify the Studio home and canvas around one visual workspace and one conversation composer implementation. The home uses an expanded version of the canvas command dock, while the canvas retains its compact version. All application surfaces share a regular dot background whose nearby dots become more distinct around the pointer.

## Visual Direction

The application is a restrained translucent workbench rather than a set of independently colored pages.

- The root application owns the only page background.
- The background is a regular, neutral dot grid in both themes.
- A pointer-following radial mask increases dot contrast within roughly 150 px of the pointer.
- The interaction does not introduce colored glows, gradient blobs, or layout movement.
- The window header remains transparent and has no independent color band or divider.
- The project panel and chat dock use translucent glass fills, fine borders, backdrop blur, and a subtle inner highlight.
- The project panel and chat dock have no external drop shadow.
- The home prompt suggestion chips are removed.

## Shared Conversation Composer

Extract the conversation input currently embedded in `Workbench` into a shared component with two presentation variants:

```ts
type ConversationDockVariant = 'compact' | 'expanded';
```

The shared component owns the user-facing interaction surface:

- text input;
- image input and clipboard paste;
- attachment preview and removal;
- optional referenced-candidate indicator;
- current designer presentation, including the no-designer state;
- send action and disabled/busy/read-only states;
- accessible labels and attachment preview dialog.

The component accepts state and callbacks from its host rather than owning project or task behavior. This keeps the visual and interaction implementation shared while preserving different submission semantics.

### Canvas Compact Variant

- Retains the current compact height and absolute bottom-center placement.
- Retains canvas-only actions such as model tasks, version history, generation, and references.
- Continues to submit messages into the active analysis thread.

### Home Expanded Variant

- Uses the same component structure and design tokens with a taller text area.
- Uses normal document flow rather than absolute canvas placement.
- Displays the selected optional designer, or an explicit no-designer state.
- Hides canvas-only task, history, and generation controls because no document context exists yet.
- Sends the current message and attachments to the existing automatic-project creation flow.
- Clears the draft only after project creation succeeds and the first-message handoff is accepted.
- Preserves the complete draft when creation or handoff fails.

## Background Interaction

The root application shell tracks pointer position without React state updates on every event.

- `pointermove` is coalesced through `requestAnimationFrame`.
- The handler writes pointer coordinates into root CSS custom properties.
- A root pseudo-element renders the enhanced dot layer through a radial mask centered on those variables.
- `pointerleave` removes the active mask and returns to the base grid.
- The visual layer uses `pointer-events: none` and cannot intercept application controls.
- Under `prefers-reduced-motion`, the enhanced layer remains inactive while the static dot grid remains visible.

All pages inherit this background. Page-level containers must not introduce full-page background colors that hide it.

## Component And Styling Changes

- Add a shared conversation dock component and focused tests.
- Replace the home-only composer markup with the shared expanded dock.
- Replace the Workbench inline command dock markup with the shared compact dock.
- Keep host-specific state conversion in `StudioHome` and `Workbench`.
- Remove suggestion data and suggestion markup from the home.
- Remove the external shadow from the project panel and both chat variants.
- Keep glass border, translucent fill, backdrop blur, and inner highlight tokens consistent with the canvas glass surfaces.
- Move the dot background and pointer enhancement to the application shell.
- Keep the window bar transparent with no border or independent background.

## Accessibility And Performance

- Both variants remain labelled forms.
- Icon actions retain tooltips and accessible names.
- Disabled and busy states are programmatically exposed.
- Attachment controls remain keyboard accessible.
- The enhanced dot layer never receives pointer events.
- Pointer tracking uses one animation-frame update at most and does not render React components.
- The static background remains usable when reduced motion or reduced transparency is enabled.

## Testing

### Unit Tests

- Both variants render from the same conversation dock component.
- Expanded mode has the larger input and omits canvas-only actions.
- Compact mode retains canvas actions and reference indicators.
- Attachment add, paste, preview, and removal work in both hosts.
- Home drafts clear only after success and remain after failure.
- The home contains no prompt suggestion region.
- No-designer and selected-designer states render correctly.
- Pointer tracking updates CSS variables through the animation-frame path and clears them on pointer leave.

### Integration And Layout Tests

- The project panel and home dock use glass tokens without an external box shadow.
- The window bar has no independent background or divider.
- The application shell owns the dot grid and page content does not cover it.
- The home remains usable without horizontal overflow at 1024 x 720 and 1280 x 800.
- The project list scrolls independently while the expanded conversation dock and designer rail remain visible.

### E2E Tests

- Create a project from text and attachments through the expanded shared dock.
- Verify draft preservation when automatic project creation fails.
- Verify the first message reaches the canvas analysis flow after creation.
- Verify pointer movement changes the dot-highlight coordinates without blocking clicks.
- Verify static dot behavior under reduced motion.

## Non-Goals

- No new prompt-suggestion system replaces the removed chips.
- No colored pointer glow or decorative gradient layer is added.
- No changes are made to conversation task payloads, designer snapshot authority, or candidate generation semantics.
- The home does not expose canvas-only task, history, generation, or revision actions.
