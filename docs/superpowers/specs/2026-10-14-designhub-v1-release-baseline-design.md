# DesignHub V1 release baseline

Date: 2026-10-14. Status: canonical V1 specification.

This specification replaces the 2026-09-08 multi-document baseline. The current project-level image canvas is the only V1 architecture. See [ADR 0029](../../adr/0029-project-canvas-v1-baseline.md).

## Product scope

V1 includes designers, managed assets, project search, trash, backups, diagnostics, settings, project package import, nine project-canvas image tools, and four standalone batch tools. It excludes project package export, documents, revisions, finalization, Brand Kit, Workbench, accounts, cloud sync, collaboration, arbitrary provider plugins, and in-app updates.

The nine canvas tools are background removal, background replacement, object removal, inpainting, outpainting, smart crop, upscale, resize, and watermark removal. The four batch tools are background removal, upscale, resize, and format conversion.

## Data contract

- `ProjectMetadata` stores project properties, the brief, designer snapshot, `ProjectDesign[]`, and `canvasLayout`.
- Import, generation, and image-tool results append immutable `ProjectDesign` values with dimensions, position through layout, source task, and timestamps.
- `DesignScene` is transient input for an image-tool request or single-image export and is never persisted as a document.
- Removed document/revision schemas fail with `DOCUMENT_SCHEMA_REMOVED`; reads never rewrite the source.
- Package import accepts only project metadata, project design images, referenced assets, and the designer snapshot; the app exposes no project package export API.

## Runtime and provider contract

The app is an offline-first Electron desktop application with a single writer and a production single-instance lock. Native tests run serially with a unique `DESIGNHUB_TEST_USER_DATA` directory for every launch.

The only provider type is `openai-compatible`. Conversation and image capabilities have separate endpoint, credential, and model profiles. Local cancellation must never be represented as confirmed remote cancellation unless the provider confirms it. Missing cost or cancellation data is displayed as unavailable.

## Release contract

V1 is released as signed macOS arm64, macOS x64, and Windows x64 installers. Each architecture is rebuilt and tested with its native Sharp, SQLite, and keyring modules. CI creates a GitHub Release only after all three platform reports and SHA-256 manifests pass. Updates are installed manually.

M01-M08 can be marked verified only with fresh evidence. Missing live-provider access, signing credentials, or platform hardware remains an explicit blocker and cannot be replaced by mocks or historical results.
