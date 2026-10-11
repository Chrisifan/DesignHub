# Project Canvas Only and Unified Image Input

## Goal

Make the project canvas the only project editing surface. A project no longer opens a document or a document workbench; generated images and imported images are both durable project designs and use the same selection, layout, image-tool, conversation-reference, and export flows.

This is an intentional contract removal. The old document/revision schema is not migrated or adapted.

## Product Flow

- Opening a project enters `ProjectCanvas` directly, whether the workspace is writable or read-only.
- There is no project-document detail page, document picker, document-open state, active document ID, or document-specific workbench route.
- The project canvas remains the source of truth for project images. Generated task outputs append `ProjectDesign` records; imported images append records of the same type.
- A selected project design can be added to the next conversation, exported, or sent through the existing image-tool flow. Imported designs do not require a special tool path.

## Image Input Contract

The conversation dock and project canvas accept the same set of image files:

- Clipboard paste reads image files from `clipboardData.files`.
- Drag and drop reads image files from `dataTransfer.files` and prevents the browser's default navigation.
- Non-image files are ignored and produce the existing localized validation notice where the input surface already provides notices.
- The existing eight-image and 8 MiB-per-file limits remain in force for conversation attachments.
- Read-only surfaces do not mutate attachments or project designs.

Conversation input keeps a temporary `ConversationDockAttachment` until submit. Canvas input imports each file as a managed asset, then creates a `ProjectDesign` with the imported asset ID, decoded width and height, a safe display title, a local-import source task ID, and the current timestamp. The new design is persisted through `addProjectDesigns` and enters the same selection/layout refresh path as generated designs.

## Data Model and API Removal

Remove document-only fields from project metadata and renderer contracts:

- `documentId`, `documentEntries`, document counts, source/finalized document fields, and final-revision attribution.
- `loadDocumentScene`, `saveDocumentScene`, document revision loading/commit/finalization, and their IPC registration and storage implementations.
- Workbench-only task submission requirements and document-scoped task filtering.

Remove `Workbench`, `CanvasWorkspace`, document scene hydration, document revision UI, finalization controls, and their dedicated tests. Keep `DesignScene` only where it is a transient image-tool/export request payload; it must not be persisted as a document scene or exposed as a project document concept.

Project metadata validation rejects the removed document schema instead of silently translating it. Existing project designs and canvas layouts remain valid project-level data.

## Component Responsibilities

`Studio` owns project selection and renders `ProjectCanvas` directly. It no longer tracks document navigation or entry candidates tied to a document.

`ProjectCanvas` owns project-design refresh, image import orchestration, selection, image tools, conversation context, and project-canvas layout persistence.

`ProjectCanvasStage` owns canvas paste/drop event handling, viewport and node interactions, and delegates imported files to `ProjectCanvas` through a narrow callback. It does not write project metadata directly.

`ConversationDock` owns common file filtering/read limits for temporary attachments and exposes identical paste/drop behavior for its textarea surface.

## Error Handling

- Missing or invalid managed assets keep the canvas interactive and preserve the existing broken-image state.
- Import failures do not append a partial `ProjectDesign`; a localized notice is shown.
- Layout persistence failures do not block viewing, selection, or image processing.
- Old document-format projects fail closed with the existing project-load error path; no synthetic document is created.

## Verification

Unit and component tests cover:

- direct project-to-canvas navigation with no document controls or state;
- removal of `Workbench`/`CanvasWorkspace` entry points and document-only API contracts;
- conversation textarea paste and drop using the same attachment result;
- project canvas paste and drop importing managed image bytes;
- imported design records carrying decoded dimensions and entering the same list as generated designs;
- selected imported designs invoking the existing image-tool and export paths;
- non-image, read-only, oversized, and import-failure behavior.

Run the focused Vitest suites, TypeScript check/build, and the relevant Studio E2E checks before completion.

## Explicit Non-Goals

- No raster decomposition into editable text or shape layers.
- No compatibility adapter for old document/revision manifests.
- No second image object type for dropped files.
- No change to provider generation or image-tool model behavior beyond removing document-only inputs.
