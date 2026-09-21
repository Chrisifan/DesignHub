# Project Canvas Refactor Design

## Goal

Make a project open directly into a project-level canvas. The canvas shows every design in the project, including previously generated project designs and new conversation candidates. Designs remain in the project without a finalization step. New designs are created only through conversation generation.

This change intentionally introduces a new project data contract. Projects written with the previous document/revision schema are allowed to fail to open; no compatibility adapter is required.

## Approved Direction

Use a freeform, large Konva canvas. The canvas is a camera over a large virtual board with a persistent dot grid. Design nodes are placed horizontally first and wrap to a new row when the configured board width is exceeded. Empty board space pans the camera; the wheel zooms around the pointer; design nodes can be selected and dragged independently.

The first implementation uses the existing `react-konva` and `CanvasWorkspace` rendering primitives. It does not migrate to a separate DOM virtualization layer in this iteration.

## Data Model

The project manifest uses a new schema version and stores a project design collection instead of document finalization state.

```ts
type ProjectDesign = {
  id: string;
  projectId: string;
  assetId: string;
  sourceTaskId: string;
  sourceConversationTaskId?: string;
  width: number;
  height: number;
  title: string;
  createdAt: string;
};

type ProjectCanvasLayout = {
  viewport: { zoom: number; offsetX: number; offsetY: number };
  nodes: Record<string, { x: number; y: number }>;
};
```

Project designs are managed assets referenced by ID. Binary data is never copied into task records or layout state. Layout coordinates are separate from the image asset and may be persisted as project canvas state so a user's arrangement survives reopening the project.

The new project contract does not contain `documentEntries`, `documentId`, `finalizedRevisionId`, `sourceRevisionId`, `sourceDocumentId`, or final-revision attribution. Old projects using those fields are not required to load.

## Project Flow

The home project list remains the project selector. Clicking a project immediately opens `ProjectCanvas`; there is no project detail route or intermediate detail page.

Project creation creates project metadata and an empty design collection. The existing project brief, cover, optional designer snapshot, and brand snapshot remain available as generation context. Manual design-document creation is removed. A project receives its first design only after a conversation generation task completes.

The project canvas contains:

- a workspace/project breadcrumb and back-to-home action;
- the large Konva stage with grid and design nodes;
- a right-side selection toolbar;
- the existing analysis/conversation dock at the bottom;
- generation placeholders that use the requested output dimensions until the managed asset is ready.

The right-side toolbar is selection-driven. With no selected design it disables design-specific actions. With a selected design it offers add-to-next-conversation, export, continue conversation, and source/task inspection. It does not offer finalize, replace-formal-scene, or remove-other-candidates actions.

## Generation Flow

Conversation analysis continues to use the current analysis thread, including its text, image attachments, project brief, brand snapshot, and the snapshot of the designer selected when the thread began.

Design generation is project-scoped. The generation request references the completed analysis task and project, not a document or base revision. When the generation task produces one or more managed image assets, the main process creates one `ProjectDesign` record per asset with the source task and conversation task IDs. The renderer receives task progress and the new design records, then appends nodes to the current canvas.

Generation failures leave task diagnostics and do not create design records. Cancellation cannot create designs. A completed candidate is never hidden because another candidate was selected; all generated designs remain in the project.

## Canvas Rendering

`ProjectCanvasStage` owns:

- Konva stage size observation;
- camera zoom and offsets;
- wheel zoom centered on the pointer;
- pointer-capture panning from empty board space;
- dot-grid rendering;
- image cache and managed-asset loading;
- node hit testing, selection, and drag persistence.

Design nodes render as image thumbnails at their own dimensions. While an asset is loading, the node renders a dimensionally accurate skeleton. The stage does not render a blank placeholder image as a project design. Asset loading is cancellable and cached by asset ID; nodes outside the visible camera bounds may defer full-resolution decoding while retaining a lightweight preview.

Initial layout uses a stable row-major algorithm with a maximum board width. New nodes are inserted in generation order and the camera is moved so the newest node is centered in the viewport. Dragging a node changes only `ProjectCanvasLayout`, never the managed image asset.

## Removal Scope

Remove the project detail page route and its project-detail-only components. Remove manual document creation state, drawer, toolbar action, related metadata APIs, and tests. Remove finalize controls, confirmation copy, candidate-to-scene replacement, final revision metadata updates, and UI labels for finalized/derived document status.

Revision storage may be removed from the project-generation path once no remaining feature consumes it. Export should build a temporary scene containing the selected managed asset, without committing a final revision.

Task history remains available for analysis and generation diagnostics. Candidate task records remain source metadata, while project designs become the durable display and export index.

## Error Handling

- Invalid or old project manifests fail closed with a clear “project cannot be opened” message and do not partially render a canvas.
- Missing managed assets render a broken-asset state on the corresponding node and keep the rest of the canvas interactive.
- A failed generation task does not append a node.
- Layout persistence failures do not block viewing or selecting designs; the in-memory layout remains active and a non-blocking notification is shown.
- Read-only workspaces allow viewing, panning, zooming, selecting, and exporting, but disable conversation generation and layout writes.

## Testing

Unit tests cover:

- new project metadata validation and rejection of the old schema;
- project design records created for each generated asset;
- row-major layout and wrapping;
- viewport zoom/pan math and pointer-centered zoom;
- node hit testing, selection, and drag updates;
- skeleton dimensions and missing-asset states;
- generation failure/cancellation not creating designs;
- export using the selected project design asset;
- no finalize or manual document creation controls.

Integration tests cover:

- creating a project, generating multiple designs, closing and reopening it with all designs restored;
- a generation task completing while the project canvas is open;
- switching projects without leaking designs or conversation context;
- read-only project viewing and export;
- old project manifests failing with an actionable error.

E2E tests cover:

- project card opens directly into the canvas;
- all project designs are visible and arranged horizontally before wrapping;
- canvas panning and zooming without browser scrollbars;
- selecting and dragging a design without moving the canvas;
- generating a design shows a correctly sized skeleton and then a new selected node;
- selected design can be added to the next conversation and exported;
- no project detail, manual design creation, or finalize entry is visible.

## Boundaries

- This iteration does not automatically decompose raster designs into editable text or shape layers.
- Existing old-format projects are intentionally unsupported.
- The first implementation uses Konva and stable image caching; full viewport virtualization can be added later if measurement shows it is necessary.
- Project designs are retained; there is no “final” or “discard other candidates” state.
