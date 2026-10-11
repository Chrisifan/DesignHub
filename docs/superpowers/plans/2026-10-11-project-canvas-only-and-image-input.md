# Project Canvas Only and Unified Image Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Remove the project-document/workbench model and make generated and imported images share the project-level `ProjectDesign` flow, including paste and drag-and-drop input.

**Architecture:** `Studio` opens `ProjectCanvas` directly. Project metadata, tasks, exports, search records, and IPC contracts become project-scoped; `DesignScene` remains only a transient payload for image tools and export. A shared image-file reader feeds temporary conversation attachments, while canvas files are imported as managed assets and persisted as `ProjectDesign` records.

**Tech Stack:** TypeScript, React, React Testing Library, Vitest, Electron IPC/preload, react-konva, local project-library storage.

**Spec:** `docs/superpowers/specs/2026-10-11-project-canvas-only-and-image-input-design.md`

## Global Constraints

- Opening a project enters `ProjectCanvas` directly; there is no document picker, document-open state, or document-specific workbench route.
- Generated and imported images are both `ProjectDesign` records; no second dropped-image object type is introduced.
- The old document/revision schema is rejected rather than adapted.
- `DesignScene` is retained only as a transient image-tool/export request payload.
- Read-only surfaces never mutate project designs or attachments.
- Each task must follow a red-green-refactor cycle and end with a focused test run.

---

### Task 1: Remove Document Fields From the Project Contract

**Files:**
- Modify: `src/features/projects/metadata.ts`
- Modify: `src/features/workspace/project-store.ts`
- Modify: `src/desktop/storage/project-store.ts`
- Modify: `src/app/studio/types.ts`
- Modify: `src/app/studio/Studio.tsx`
- Test: `src/features/projects/metadata.test.ts`, `src/desktop/storage/project-store.test.ts`, `src/app/Studio.test.tsx`

**Interfaces:**
- Produces project metadata containing `designs` and `canvasLayout` without `documents` or document identifiers.
- Keeps `createProjectContainer`, `updateProjectMetadata`, `addProjectDesigns`, and `listProjectDesigns` project-scoped.

- [ ] **Step 1: Write failing contract tests.** Add assertions that project metadata rejects `documents`/document fields, that new project creation does not synthesize a document, and that a project with only designs normalizes successfully.
- [ ] **Step 2: Run the focused tests and verify the new assertions fail.**

  Run: `pnpm vitest run --config vitest.config.ts src/features/projects/metadata.test.ts src/desktop/storage/project-store.test.ts src/app/Studio.test.tsx`

- [ ] **Step 3: Remove document fields and validation.** Delete `ProjectDocumentMetadata`, document normalization, document-count fields, and document arguments from the project-store input/patch types. Update storage serialization and project construction in `Studio` so manual/composition/mockup/preview projects only create project metadata and designs.
- [ ] **Step 4: Make project opening direct.** Remove `documentOpen`, `activeDocumentId`, and document-derived pending-candidate state from `Studio`; make `openProject` select the project and render the project canvas path.
- [ ] **Step 5: Run the focused tests and the TypeScript check.**

  Run: `pnpm vitest run --config vitest.config.ts src/features/projects/metadata.test.ts src/desktop/storage/project-store.test.ts src/app/Studio.test.tsx && pnpm exec tsc --noEmit`

- [ ] **Step 6: Commit.**

  `git add src/features/projects/metadata.ts src/features/workspace/project-store.ts src/desktop/storage/project-store.ts src/app/studio/types.ts src/app/studio/Studio.tsx src/features/projects/metadata.test.ts src/desktop/storage/project-store.test.ts src/app/Studio.test.tsx && git commit -m "refactor: make project metadata documentless"`

### Task 2: Convert Task Submission and Candidate State to Project Scope

**Files:**
- Modify: `src/features/agent/task-service.ts`, `src/features/agent/task-record-factory.ts`, `src/features/tasks/state.ts`, `src/features/tasks/runtime.ts`
- Modify: `src/desktop/services/task-service-factory.ts`, `src/desktop/main.ts`
- Modify: `src/desktop/ipc/tasks.ts`, `src/desktop/ipc/register-task-handlers.ts`, `src/desktop/preload.ts`, `src/platform/contracts.ts`
- Modify: `src/features/composition/design-scene-candidate.ts`, `src/app/studio/candidate-controller.ts`
- Test: `src/features/agent/task-service.test.ts`, `src/features/agent/task-record-factory.test.ts`, `src/features/agent/task-chain.test.ts`, `src/features/tasks/runtime.test.ts`, `src/desktop/ipc/tasks.test.ts`, `src/desktop/ipc/register-task-handlers.test.ts`, `tests/integration/design-generation-batch.test.ts`, `tests/integration/task-recovery.test.ts`

**Interfaces:**
- `ConversationTaskInput`, `DesignGenerationInput`, candidate publish/resolve inputs, and `TaskRecord` no longer require or validate `documentId`.
- Project generation validation checks only project ownership and referenced asset IDs.

- [ ] **Step 1: Write failing project-scope tests.** Update/add tests proving project conversation and design-generation requests submit without `documentId`, completed generation creates project design records, and candidate publish/resolve does not look up a document.
- [ ] **Step 2: Run the affected tests and verify failures are caused by document guards.**

  Run: `pnpm vitest run --config vitest.config.ts src/features/agent src/features/tasks src/desktop/ipc/tasks.test.ts tests/integration/design-generation-batch.test.ts`

- [ ] **Step 3: Remove document arguments and guards.** Delete document-only fields from task inputs/records and remove synthetic document IDs, metadata document lookups, and revision checks from the task service factory and Electron main handlers.
- [ ] **Step 4: Preserve project design creation.** Ensure generated asset completion uses `{ projectId, assetId, sourceTaskId, sourceConversationTaskId, width, height, title, createdAt }` and persists through the project store.
- [ ] **Step 5: Run all agent/task/integration tests and `pnpm exec tsc --noEmit`.**
- [ ] **Step 6: Commit.**

  `git add src/features/agent src/features/tasks src/desktop/services/task-service-factory.ts src/desktop/main.ts src/desktop/ipc/tasks.ts src/desktop/ipc/register-task-handlers.ts src/desktop/preload.ts src/platform/contracts.ts src/features/composition src/app/studio/candidate-controller.ts tests/integration && git commit -m "refactor: make generation tasks project-scoped"`

### Task 3: Remove Scene and Revision Persistence IPC

**Files:**
- Delete: `src/features/canvas/CanvasWorkspace.tsx`, `src/features/canvas/CanvasWorkspace.test.tsx`, `src/features/canvas/EditSession.ts`, `src/desktop/ipc/scenes.ts`, `src/desktop/ipc/scenes.test.ts`, `src/desktop/ipc/revisions.ts`, `src/desktop/ipc/revisions.test.ts`, `src/desktop/storage/scene-store.ts`, `src/desktop/storage/scene-store.test.ts`, `src/desktop/storage/revision-store.ts`, `src/desktop/storage/revision-store.test.ts`
- Modify: `src/desktop/ipc/register-content-handlers.ts`, `src/desktop/main.ts`, `src/desktop/preload.ts`, `src/platform/contracts.ts`
- Delete: `src/features/revisions/CompareRevisions.tsx`, `src/features/revisions/Timeline.tsx`, `src/features/revisions/commit-revision.ts`, `src/features/revisions/model.ts` and their tests; remove the `commit-revision` agent tool contract.
- Modify: `src/features/canvas/scene.ts` only to remove document/revision persistence references while retaining transient scene helpers
- Test: `tests/native/electron-smoke.spec.ts`; delete `tests/integration/canvas-recovery.test.ts`, `tests/integration/revisions.test.ts`, and `tests/integration/project-package-handoff.test.ts` because they exercise removed document persistence

**Interfaces:**
- No preload or `DesktopApi` methods named `loadDocumentScene`, `saveDocumentScene`, `loadDocumentRevisions`, `commitDocumentRevision`, or `setFinalDocumentRevision` remain.
- `DesignScene` constructors and validation remain available to image-tool/export code without storage APIs.

- [ ] **Step 1: Write failing absence tests.** Assert the preload contract and content-handler registration do not expose scene/revision channels, while transient `createScene` and export payload tests continue to pass.
- [ ] **Step 2: Run the focused tests and verify they fail because the old channels still exist.**
- [ ] **Step 3: Remove scene/revision IPC registration, preload bridges, main-process adapters, and storage modules.** Remove their imports and dependency injection fields without touching unrelated asset/project handlers.
- [ ] **Step 4: Remove only document persistence dependencies from transient scene code.** Keep `createScene`, `replaceSceneLayer`, and image-tool scene construction used by project-level tools.
- [ ] **Step 5: Run focused IPC/native/integration tests and `pnpm exec tsc --noEmit`.**
- [ ] **Step 6: Commit.**

  `git add src/features/canvas src/features/revisions src/desktop/ipc src/desktop/storage src/desktop/main.ts src/desktop/preload.ts src/platform/contracts.ts tests/native tests/integration && git commit -m "refactor: remove document scene and revision persistence"`

### Task 4: Make Export History and Search Project-Scoped

**Files:**
- Modify: `src/platform/contracts.ts`, `src/desktop/ipc/export.ts`, `src/desktop/ipc/register-content-handlers.ts`, `src/desktop/main.ts`
- Modify: `src/features/delivery/export-history.ts`, `src/features/delivery/export-history.test.ts`, `src/desktop/storage/export-history-store.test.ts`
- Modify: `src/features/library/indexer.ts`, `src/features/library/filter.ts`, `src/desktop/storage/search-index-store.ts`
- Test: `src/desktop/ipc/export.test.ts`, `src/desktop/ipc/export-history.test.ts`, `src/desktop/ipc/register-export.test.ts`, `src/features/delivery/export-history.test.ts`, `src/desktop/storage/export-history-store.test.ts`, `src/desktop/ipc/search.test.ts`, `src/desktop/ipc/register-search.test.ts`, `src/desktop/storage/search-index-store.test.ts`
- Modify: `src/app/studio/ProjectCanvas.tsx`, `src/app/studio/LibraryPages.tsx`, `src/features/delivery/*`

**Interfaces:**
- Export input uses `libraryId`, `projectId`, `format`, and transient `scene`; it has no `documentId` or revision ID.
- Export history identifies a project and exported scene/assets without document fields.
- Search records identify projects/designs without `documentId` or finalized-document flags.

- [ ] **Step 1: Write failing project-scoped export/search tests.** Cover selected `ProjectDesign` export, project-level history validation, and search index uniqueness by project/design identity.
- [ ] **Step 2: Run export/search tests and verify failures reference required document/revision fields.**
- [ ] **Step 3: Update main-process export naming/history to use project/design IDs and preserve archive-copy behavior.**
- [ ] **Step 4: Remove document/finalized filters and fields from delivery/search UI and storage adapters.**
- [ ] **Step 5: Run focused delivery/search/Studio tests and `pnpm exec tsc --noEmit`.**
- [ ] **Step 6: Commit.**

  `git add src/platform/contracts.ts src/desktop/ipc src/desktop/main.ts src/features/delivery src/features/library src/desktop/storage src/app/studio/ProjectCanvas.tsx src/app/studio/LibraryPages.tsx && git commit -m "refactor: scope exports and search to projects"`

### Task 5: Remove Workbench and Document-Only UI

**Files:**
- Delete: `src/app/studio/Workbench.tsx`, `src/app/studio/Workbench.test.tsx`, `src/app/studio/ProjectDetailPage.tsx`, `src/app/studio/ProjectDetailPage.test.tsx`, `src/app/studio/ProjectDocumentPreview.tsx`, `src/app/studio/ProjectDocumentPreview.test.tsx`
- Modify: `src/app/studio/Studio.tsx`, `src/app/studio/Studio.test.tsx`, `src/app/studio/LibraryPages.tsx`, `src/app/studio/LibraryPages.test.tsx`
- Delete: `src/app/studio/candidate-controller.ts`, `src/app/studio/candidate-controller.test.ts`, `src/app/studio/tool-submit-controller.ts`, `src/app/studio/tool-submit-controller.test.ts` after the `rg` caller check confirms the project canvas no longer imports them
- Test: `src/app/Studio.test.tsx`, `tests/e2e/studio.spec.ts`

**Interfaces:**
- `Studio` renders one project editing surface: `ProjectCanvas`.
- Project-level image tools use the existing `ProjectCanvas` selected-design flow; no workbench selection, revision, or candidate-finalization props remain.

- [ ] **Step 1: Add a failing Studio regression test that a project opens directly to `设计画布` and no document controls, workbench, or finalize controls render.**
- [ ] **Step 2: Run the regression test and verify it fails while the document route exists.**
- [ ] **Step 3: Delete document-only components and remove their imports, states, props, callbacks, and tests.**
- [ ] **Step 4: Update project creation/opening and E2E fixtures to use `designs`/`canvasLayout` only.**
- [ ] **Step 5: Run Studio component/E2E tests and `pnpm exec tsc --noEmit`.**
- [ ] **Step 6: Commit.**

  `git add src/app/studio tests/e2e/studio.spec.ts && git commit -m "refactor: open projects directly on canvas"`

### Task 6: Add Shared Image File Reading and Conversation Drop Input

**Files:**
- Create: `src/app/studio/image-input.ts`, `src/app/studio/image-input.test.ts`
- Modify: `src/app/studio/ConversationDock.tsx`, `src/app/studio/ConversationDock.test.tsx`, `src/app/studio/conversation-dock.css`

**Interfaces:**
- `readImageFiles(files: readonly File[], limits?: { maxCount: number; maxBytes: number }): Promise<ConversationDockAttachment[]>` filters images, reads bytes, creates preview URLs/data URLs, and reports rejected files through the caller.
- `getImageDimensions(file: File): Promise<{ width: number; height: number }>` uses `createImageBitmap` where available and an object-URL image fallback.

- [ ] **Step 1: Write failing utility tests for image filtering, byte reads, data URLs, dimension extraction, size/count limits, and read failures.**
- [ ] **Step 2: Run `pnpm vitest run --config vitest.config.ts src/app/studio/image-input.test.ts` and verify red.**
- [ ] **Step 3: Implement the small utility with browser-safe `File.arrayBuffer`/`FileReader` fallback and deterministic error codes.**
- [ ] **Step 4: Write failing `ConversationDock` tests for textarea drop and paste producing the same attachment shape and preventing default drop navigation.**
- [ ] **Step 5: Run the dock tests and verify red.**
- [ ] **Step 6: Wire `onDragOver`, `onDragLeave`, and `onDrop` to the same `addFiles` path as paste; add a visible drag state without changing attachment limits.**
- [ ] **Step 7: Run utility and dock tests, then commit.**

  `git add src/app/studio/image-input.ts src/app/studio/image-input.test.ts src/app/studio/ConversationDock.tsx src/app/studio/ConversationDock.test.tsx src/app/studio/conversation-dock.css && git commit -m "feat: support dropped images in conversation dock"`

### Task 7: Import Canvas Images as Project Designs

**Files:**
- Modify: `src/app/studio/ProjectCanvasStage.tsx`, `src/app/studio/ProjectCanvasStage.test.tsx`
- Modify: `src/app/studio/ProjectCanvas.tsx`, `src/app/studio/ProjectCanvas.test.tsx`

**Interfaces:**
- `ProjectCanvasStage` accepts `onImportImages?: (files: readonly File[]) => void | Promise<void>` and invokes it for paste/drop image files only.
- `ProjectCanvas` implements `importProjectImages(files)` by reading bytes/dimensions, calling `importAssets`, creating `ProjectDesign` records with `sourceTaskId: local-import-<uuid>`, and calling `addProjectDesigns`.

- [ ] **Step 1: Write failing stage tests for paste/drop dispatch, non-image filtering, read-only suppression, and `preventDefault`.**
- [ ] **Step 2: Run `pnpm vitest run --config vitest.config.ts src/app/studio/ProjectCanvasStage.test.tsx` and verify red.**
- [ ] **Step 3: Add the narrow stage callback and event handlers; keep node selection, camera pan, and drag behavior unchanged.**
- [ ] **Step 4: Write failing `ProjectCanvas` tests for asset import arguments, decoded dimensions, generated-equivalent `ProjectDesign` shape, and refresh/selection behavior.**
- [ ] **Step 5: Run the ProjectCanvas tests and verify red.**
- [ ] **Step 6: Implement managed import and append through `addProjectDesigns`; show localized failures and do not append partial results.**
- [ ] **Step 7: Run stage and ProjectCanvas tests, then commit.**

  `git add src/app/studio/ProjectCanvasStage.tsx src/app/studio/ProjectCanvasStage.test.tsx src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvas.test.tsx src/platform/contracts.ts && git commit -m "feat: import dropped canvas images as project designs"`

### Task 8: Full Verification and Contract Sweep

**Files:**
- Modify: `tests/e2e/test-workspace.ts`, `tests/e2e/studio.spec.ts`, `tests/native/electron-smoke.spec.ts`, and any fixture file reported by the contract sweep
- Test: repository-wide TypeScript, Vitest, build, native smoke, and Studio E2E suites

- [ ] **Step 1: Run a repository sweep for forbidden document symbols.**

  Run: `rg -n "Workbench|CanvasWorkspace|documentId|documentEntries|loadDocumentScene|saveDocumentScene|loadDocumentRevisions|commitDocumentRevision|setFinalDocumentRevision|ProjectDocumentPreview" src tests`

  Expected: no product/runtime references; any intentional migration-error fixture must be isolated in a test explicitly asserting rejection.

- [ ] **Step 2: Run the focused contract and UI suites.**

  Run: `pnpm vitest run --config vitest.config.ts src/features/projects/metadata.test.ts src/desktop/storage/project-store.test.ts src/app/Studio.test.tsx src/app/studio/ProjectCanvas.test.tsx src/app/studio/ProjectCanvasStage.test.tsx src/app/studio/ConversationDock.test.tsx src/features/agent/task-service.test.ts src/features/tasks/runtime.test.ts src/desktop/ipc/tasks.test.ts src/desktop/ipc/export.test.ts src/desktop/ipc/search.test.ts`
- [ ] **Step 3: Run the complete Vitest suite.**

  Run: `pnpm run test:unit`

- [ ] **Step 4: Run TypeScript, production build, native smoke, and relevant E2E suites.**

  Run: `pnpm exec tsc --noEmit && pnpm build && pnpm exec playwright test --config playwright.native.config.ts tests/native/electron-smoke.spec.ts && pnpm exec playwright test --config playwright.config.ts tests/e2e/studio.spec.ts`

- [ ] **Step 5: Review `git diff --check`, inspect the final diff, and commit any fixture-only cleanup.**

  `git diff --check && git status --short`

