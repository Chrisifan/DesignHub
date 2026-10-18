# ADR 0029: Project canvas is the V1 product baseline

Status: accepted, 2026-10-14.

## Decision

DesignHub V1 uses one project-level image canvas. Imported images, model generations, and image-tool outputs are immutable `ProjectDesign` records. `ProjectMetadata` contains project properties, the brief, a designer snapshot, `ProjectDesign[]`, and `canvasLayout` only.

`DesignScene` may be constructed transiently for one image-tool request or one-image export. It is not a persisted project API. V1 has no user-visible or persisted document, revision, finalization, Brand Kit, or Workbench model.

Legacy document/revision data is rejected with `DOCUMENT_SCHEMA_REMOVED`. Detection is read-only: the original project or task file is not rewritten. The UI explains that the data belongs to an unsupported prerelease format and should be backed up before opening it with a compatible older build.

V1 imports compatible project packages containing project metadata, project design images, referenced managed assets, and the designer snapshot. It does not expose project package export. Imported packages must exclude credentials, conversations, diagnostics, trash, and unrelated assets.

V1 retains one built-in `openai-compatible` provider connection with separate conversation and image endpoints, credentials, and models. Production always takes the Electron single-instance lock. Tests isolate `userData` and run native Electron cases serially.

## Consequences

- ProjectCanvas is the only project editing surface.
- Every image-producing path must append the same immutable `ProjectDesign` shape.
- Historical document/revision plans remain available as records but are superseded.
- V1 release artifacts are macOS arm64, macOS x64, and Windows x64, signed through CI secrets.
- Updates are manual downloads; no in-app updater is part of V1.

## Supersedes

This ADR supersedes ADR 0004, 0007, 0008, and 0014 for V1, plus the document/revision portions of the 2026-09-08 V1 specification and plan.
