# DesignHub UI framework implementation plan

**Goal:** Deliver a browsable desktop UI framework for the approved P01–P20 destinations, isolated from ongoing M01/native-storage verification.
**Architecture:** Existing Electron window bar and secure desktop bridge remain the host. React owns application navigation and a visibly labelled, in-memory example workspace. Theme and locale are local preferences; project/model/file operations are only enabled when their actual capability exists.
**Tech stack:** Existing React 19 / TypeScript / Vite / CSS tokens / Vitest. Browser-native dialog owns modal focus and Escape behavior; Lucide SVG assets are copied with license rather than installing a new shared dependency.
**Spec:** `../specs/2026-09-08-designhub-v1-design.md`, `../../product/UI-FOUNDATIONS.md`, `../../product/APPLICATION-GUIDE-FOR-UI.md` and the user's 2026-09-09 request to build the overall UI first.

## Scope and decisions

Professional, quiet creative workstation: opaque artwork surfaces, thin dividers, semantic cyan in dark mode, indigo in light mode. Shared geometry across themes, 40px native-safe window bar, 44px toolbar, 280px navigation, 320px context panel; navigation collapses below 1280px. Content is organized as projects, designers, assets, brands, model connections/tasks, delivery, trash/backup and settings; workbench contains layers, properties, conversation, tools and history.

The approved visual baseline plus this user request authorizes the framework. Detailed business implementations and native acceptance remain in M02–M08. Example projects and draft interactions are explicitly labelled; no fake successful saves, connection tests, generations, exports or backups. No project data, credentials, or assets are written to disk. Preferences may be stored locally with failure-tolerant access. No external fonts or remote imagery at runtime.

## Task 1 — Navigation, shell and common surfaces

Files: `src/app/App.tsx`, `src/app/studio/{Studio,ui,types,copy,examples}.tsx/ts`, `src/app/styles/{tokens,studio}.css`, `src/app/Studio.test.tsx`.
- [x] Write navigation, filter preservation, draft creation, missing-backend and theme/locale behavior tests; run against current App and observe missing UI behavior.
- [x] Implement shared navigation and main content switching, example workspace entry, search, view controls, app status, drawer/dialog and complete tokens.
- [x] Preserve welcome chooser cancellation and error recovery, native safe areas and renderer boundary.

## Task 2 — Libraries and management destinations

Files: `src/app/studio/LibraryPages.tsx`, `src/app/studio/library.css`, focused behavior tests.
- [x] Build project overview/documents, designer library and profile draft/detail, asset library/detail, brands, connection/task, delivery, backup/trash, settings surfaces.
- [x] All visible actions navigate, change local view/draft state or explain unavailable capability. No dead decorative buttons or fictional provider status.

## Task 3 — Workbench composition

Files: `src/app/studio/Workbench.tsx`, `src/app/studio/workbench.css`, focused behavior tests.
- [x] Build document header/toolbar, artwork view, layers, zoom/grid, selection inspector, and one secondary context panel at a time.
- [x] Editing affects example session only; no model call, disk save or false export. Layer visibility, selection and inspector editing should be observable.

## Task 4 — Verification and delivery

- [x] Run unit/integration, lint, typecheck and production build; review branch against scope.
- [x] Browser QA at 1280×800 and 1024×720, both languages/themes, keyboard dialog open/close/focus return, long text, empty search, page overflow and narrow inspector. Capture screenshots.
- [x] Record actual evidence in `docs/verification/UI-FRAMEWORK.md`; document native/platform limits separately.
- [x] Keep changes on `codex/ui-framework`, open local preview and provide its location. No merge into active verification checkout.

Delivered on the isolated `codex/ui-framework` branch. Real storage, image execution/rendering, providers and native platform gates remain in M02–M08.
