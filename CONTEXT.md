# DesignHub V1 domain context

Updated: 2026-10-14. This vocabulary follows the [V1 release baseline](docs/superpowers/specs/2026-10-14-designhub-v1-release-baseline-design.md) and [ADR 0029](docs/adr/0029-project-canvas-v1-baseline.md).

## Product boundary

DesignHub is an offline-first desktop application for individual designers and small creative teams. It organizes managed images, model work, and direct image tools around a project-level image canvas.

V1 does not contain design documents, revision history, finalization, Brand Kit, Workbench, accounts, cloud sync, collaboration, arbitrary provider plugins, or an in-app updater. Those terms may appear in superseded historical documents but are not current product concepts.

## Core terms

**Project library**
A user-selected local root containing projects, shared managed assets, designers, task history, trash, and backup metadata. One writer may own it at a time.
_Avoid_: workspace account, cloud space.

**Design project**
A local project directory containing its metadata and referenced managed content. Opening it goes directly to ProjectCanvas.
_Avoid_: document collection, session.

**Design brief**
The project-level creative intent and constraints saved in project metadata.
_Avoid_: temporary prompt, document brief.

**Project design (`ProjectDesign`)**
An immutable managed image on the project canvas. Imports, model generations, and image-tool outputs use the same record shape: identity, asset identity, source task, dimensions, title, and creation time.
_Avoid_: document, revision, mutable current image.

**Canvas layout (`canvasLayout`)**
The persisted project-level viewport and position of each project design. It contains no image bytes or document scene graph.

**Transient design scene (`DesignScene`)**
A temporary request value used only to describe one selected image for an image tool or single-image export. It is not persisted or exposed as a project document.

**Designer profile**
A reusable creative identity with name, visual traits, rules, prohibited traits, portfolio references, and optional generated portrait. Publication creates a versioned profile snapshot; projects retain the snapshot selected at creation.

**Authorized portfolio source**
Images or a public portfolio page the user confirms they own or may use for analysis. Rights confirmation is mandatory and page images are selected explicitly before analysis.

**Managed asset**
An imported file copied into the project library and addressed by asset ID. External source paths are not durable dependencies.

**Model task**
A persisted conversation, vision, image-generation, or image-editing operation with explicit queued, running, completed, failed, canceled, or unknown-after-restart state. Restart never silently repeats a billable request.

**Project conversation**
The compact dock within ProjectCanvas. It can reference selected project designs and temporary image attachments, but conversations are not exported in project packages.

**Image tool result**
A new immutable project design produced from an existing project design. The source is never overwritten.

**Standalone batch job**
A non-project job applying background removal, upscale, resize, or format conversion to scanned local files. Items have independent state and may be imported into managed assets after completion.

**Project package**
A portable archive containing project metadata, project design images, referenced managed assets, and the designer snapshot. It excludes credentials, conversations, diagnostics, trash, and unrelated assets.

**OpenAI-compatible connection**
The single V1 provider type. Conversation and image capabilities use separate endpoint, credential, and model profiles even when they point to the same service.

**Provider credential**
A secret stored only in the operating-system credential store. It is never returned to the renderer or written to a project, package, backup, task, or diagnostic report.

**Local cancellation**
Stopping local polling or output handling. It is not described as remote cancellation unless the provider confirms remote support and success.

**Unavailable provider data**
Cost, remote cancellation, or other provider facts not returned by the backend. The UI displays unavailable rather than inventing a value.

**Trash**
Recoverable library-local storage for deleted projects and assets. Permanent deletion requires an explicit user action.

**Backup**
A user-selected local copy with validated restore. Backup does not imply cloud synchronization.

## Invariants

- All image-producing paths append a `ProjectDesign`; none overwrite an existing record.
- `ProjectMetadata` contains project properties, brief, designer snapshot, designs, and canvas layout only.
- Removed prerelease document/revision data fails with `DOCUMENT_SCHEMA_REMOVED` and is never rewritten during detection.
- Read-only libraries may view and export projects but may not mutate them.
- Production always uses the single-instance application lock and one library writer.
- Logs, tasks, diagnostics, packages, and release reports contain neither credentials nor raw image bytes.
- V1 updates are downloaded and installed manually.
