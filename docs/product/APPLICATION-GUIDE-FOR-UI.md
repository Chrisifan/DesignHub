# DesignHub V1 application guide

Updated: 2026-10-14. Scope: signed macOS arm64/x64 and Windows x64 desktop releases. This guide follows the [canonical V1 specification](../superpowers/specs/2026-10-14-designhub-v1-release-baseline-design.md).

## Product model

DesignHub is a local-first desktop tool for producing and processing marketing images. A project opens directly into one ProjectCanvas containing immutable images. There is no document picker, revision browser, finalization state, Brand Kit, or Workbench in V1.

The application works without an account. Offline users can browse and edit local project layout, import images, export images or packages, search metadata, manage trash, and run backups. Provider-dependent controls explain that a connection is required instead of hiding local work.

## Primary navigation

The first screen is the working application, not a marketing page. The global navigation provides projects, designers, assets, provider settings, model tasks, four batch tools, trash/backups, settings, and diagnostics.

Project package import belongs to the global user menu. Project package export belongs to the open project's action menu.

## ProjectCanvas

Opening a project displays its design images as stable canvas nodes. Users can pan, zoom, move nodes, select one or more images, and return Home through project actions. Layout changes persist at project level.

Images enter the project through drag and drop, paste, file selection, model generation, or an image tool. Every path creates the same `ProjectDesign` record and appears in the same canvas, selection, export, and conversation-reference flows.

A selected image exposes direct actions and nine tools: remove background, replace background, remove object, inpaint, outpaint, smart crop, upscale, resize, and remove watermark.

Tools never overwrite the selected image. A queued placeholder is shown immediately; a completed result becomes a new image node. Failures remain associated with their task and require explicit retry. Watermark removal requires an explicit rights confirmation and region selection.

The compact conversation dock is inside the bottom toolbar. It can attach local images or selected project designs. A conversation response and any requested generation are persisted as model tasks. The dock must not cover the canvas toolbar at supported sizes.

Single-image export is available on the canvas. Project package export is available for writable and read-only libraries. Canceling a save dialog is a neutral outcome; failures show a recoverable message and leave project data unchanged.

## Designers

Users can create a designer from description or from authorized portfolio material. Portfolio pages are inspected without login or cookies, and users choose images before analysis. Rights confirmation cannot be skipped.

The flow is select sources, analyze, review/edit the draft, optionally generate a portrait, publish, and optionally set as default. Published designers may be archived. Existing projects keep their saved designer snapshot when a profile changes or is archived.

## Assets and search

Imported assets are copied into managed storage and deduplicated by content. Users can browse, filter, inspect, import, trash, and restore assets. Search covers project and user-visible metadata locally; it does not upload content or claim visual semantic search.

## Batch image tools

The standalone tools are background removal, upscale, resize, and format conversion. Each job supports scanning, start, pause, continue, cancel, retry, restart recovery, conflict handling, and optional import of successful outputs into managed assets. Failure of one item does not erase successful siblings.

## Tasks and provider state

V1 exposes one OpenAI-compatible connection with separate conversation and image profiles. The task view shows capability, model, state, duration, sanitized error, and cost when the provider supplies it. Missing cost is shown as unavailable. Local stop is not labeled remote cancellation unless confirmed.

Queued or running work found after restart becomes `unknown` and is never resubmitted automatically. Retrying is an explicit user action.

## Storage and recovery

Trash is recoverable until explicit purge. Backup and restore validate identity and format before replacement. Diagnostics export is redacted. Project package import validates paths, archive expansion limits, links, conflicts, and metadata before publishing a project.

Prerelease document/revision projects are unsupported. When detected, show `DOCUMENT_SCHEMA_REMOVED`, explain the version mismatch, and offer backup guidance. Never rewrite the source directory during detection.

## Settings and accessibility

Settings include system/light/dark theme, Chinese/English language, provider profiles, default designer, backup, and diagnostics. All visible controls require a real backend behavior.

The UI must work at 1024x720 and 1280x800 at 100%, 125%, and 150% scale. Keyboard focus, accessible names, screen-reader structure, reduced motion, and reduced transparency are release requirements. Text must not overlap or rely on color alone.

## Release and updates

The About/settings surface states supported OS and CPU architecture, version, project format, manual update instructions, and known limitations. V1 does not show an automatic-update control.
