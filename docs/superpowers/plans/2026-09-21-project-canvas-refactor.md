# Project Canvas Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the project-detail/document-finalization flow with a project-level Konva canvas that permanently displays every generated design and supports selection, movement, conversation continuation, and export.

**Architecture:** Introduce a versioned project design collection and separate canvas layout state. Open projects directly into a new `ProjectCanvas` surface backed by a Konva stage; generation completion writes managed assets and design records, while the renderer appends them as canvas nodes. Remove document detail and finalization paths instead of adapting old project manifests.

**Tech Stack:** React 19, TypeScript, Electron IPC, `react-konva`, existing managed asset store, Vitest, Playwright.

---

## File Map

- `src/features/projects/metadata.ts`: define the new project metadata and `ProjectDesign` validation; reject the old document/revision shape.
- `src/features/workspace/project-store.ts`: expose project design creation/listing and canvas-layout persistence contracts.
- `src/desktop/storage/project-store.ts`: persist the new metadata/design/layout files and enforce the new format version.
- `src/desktop/ipc/projects.ts`, `src/desktop/main.ts`, `src/desktop/preload.ts`, `src/platform/contracts.ts`: expose validated project-design and layout IPC methods.
- `src/features/agent/task-service.ts`, `src/features/tasks/state.ts`, `src/features/tasks/runtime.ts`: make design generation project-scoped and attach each generated asset to a project design record.
- `src/app/studio/ProjectCanvas.tsx`: project-level orchestration for designs, conversation, selection, export, and task updates.
- `src/app/studio/ProjectCanvasStage.tsx`: Konva camera, grid, image cache, node layout, selection, dragging, and skeletons.
- `src/app/studio/ProjectCanvasToolbar.tsx`: project breadcrumb/back action and selected-design actions.
- `src/app/studio/Studio.tsx`: route project clicks directly to `ProjectCanvas`, remove `ProjectDetailPage`, document state, manual document creation, and finalization callbacks.
- `src/app/studio/types.ts`: replace document-oriented `Project` fields with project design metadata and canvas state.
- `src/app/studio/studio-home.css`, `src/app/studio/project-canvas.css`: layout for the canvas surface, toolbar, selection panel, and loading states.
- `src/app/studio/ProjectDetailPage.tsx`, `src/app/studio/project-detail.css`: delete after callers and tests are removed.
- `src/app/studio/Workbench.tsx`, `src/app/studio/workbench.css`, `src/features/canvas/CanvasWorkspace.tsx`: extract/reuse Konva primitives and remove candidate-finalization/document-scene ownership from the project flow.
- Tests beside each changed module plus `src/app/Studio.test.tsx`, `src/desktop/storage/project-store.test.ts`, `tests/integration`, and `tests/e2e/studio.spec.ts`.

## Task 1: Replace Project Metadata With the New Design Collection

**Files:**
- Modify: `src/features/projects/metadata.ts`
- Modify: `src/features/workspace/project-store.ts`
- Modify: `src/app/studio/types.ts`
- Test: `src/features/projects/metadata.test.ts`, focused `src/app` project fixtures and consumers

- [ ] **Step 1: Write failing metadata tests.** Add cases that create metadata with `designs: []`, accept a valid `ProjectDesign`, reject duplicate design IDs and invalid asset/dimensions, and reject input containing `documents` or revision fields with `INVALID_PROJECT_METADATA`.
- [ ] **Step 2: Run the focused tests.** Run `pnpm exec vitest run src/features/projects/metadata.test.ts --config vitest.config.ts`; confirm the new tests fail because the current metadata requires document fields.
- [ ] **Step 3: Implement the new types and validators.** Replace `ProjectDocumentMetadata` with `ProjectDesign`, add `ProjectCanvasLayout`, add `designs` and `canvasLayout` to `ProjectMetadata`, and make `createProjectMetadata`/`updateProjectMetadata` validate design IDs, managed asset IDs, positive dimensions, ISO timestamps, and unique IDs. Reject the old document keys instead of normalizing them.
- [ ] **Step 4: Update shared project types.** Change `Project` to expose `designs`, `designCount`, and optional `canvasLayout`; remove `documentId`, `documents`, and `documentEntries`. Update `ActiveProject` and create/update inputs to use the new fields.
- [ ] **Step 5: Run all metadata/type consumers.** Run `pnpm typecheck`; record every compile error as a migration target for later tasks rather than adding compatibility aliases.
- [ ] **Step 6: Commit the contract change.** `git add src/features/projects/metadata.ts src/features/workspace/project-store.ts src/app/studio/types.ts src/features/projects/metadata.test.ts && git commit -m "refactor: model project designs"`.

## Task 2: Persist New Projects, Designs, and Canvas Layout

**Files:**
- Modify: `src/desktop/storage/project-store.ts`
- Modify: `src/desktop/ipc/projects.ts`
- Modify: `src/desktop/main.ts`
- Modify: `src/desktop/preload.ts`
- Modify: `src/platform/contracts.ts`
- Test: `src/desktop/storage/project-store.test.ts`, `src/desktop/ipc/workspace.test.ts`

- [ ] **Step 1: Add failing storage tests.** Cover creation with an empty design list, adding multiple designs atomically, saving/loading layout, and opening a manifest with the previous `documents` shape or old format version returning `PROJECT_FORMAT_UNSUPPORTED`.
- [ ] **Step 2: Run the storage tests.** Run `pnpm exec vitest run src/desktop/storage/project-store.test.ts src/desktop/ipc/workspace.test.ts --config vitest.config.ts`; confirm the new cases fail against the current SQLite/manifest contract.
- [ ] **Step 3: Bump the project format and storage schema.** Replace `projectFormatVersion = 1` with the new version, add a `designs` table or equivalent project-content record, and store `canvas-layout.json` (or the project database equivalent) with validated `ProjectCanvasLayout`. Do not migrate old rows; reject them during manifest/database validation.
- [ ] **Step 4: Add store methods.** Implement `addProjectDesigns(projectId, designs)`, `listProjectDesigns(projectId)`, `loadProjectCanvasLayout(projectId)`, and `saveProjectCanvasLayout(input)` with workspace/project ownership checks and atomic writes.
- [ ] **Step 5: Expose the methods over IPC.** Add typed channels and preload methods; ensure handlers validate the active workspace, project ID, design IDs, and layout object before calling storage.
- [ ] **Step 6: Run storage and IPC tests.** Confirm new records survive close/reopen and old manifests fail without partial project data.
- [ ] **Step 7: Commit persistence.** `git add src/desktop/storage/project-store.ts src/desktop/ipc/projects.ts src/desktop/main.ts src/desktop/preload.ts src/platform/contracts.ts src/desktop/storage/project-store.test.ts src/desktop/ipc/workspace.test.ts && git commit -m "feat: persist project canvas designs"`.

## Task 3: Make Generation Create Durable Project Designs

**Files:**
- Modify: `src/features/agent/task-service.ts`
- Modify: `src/features/tasks/state.ts`
- Modify: `src/features/tasks/runtime.ts`
- Modify: `src/desktop/ipc/agent.ts`
- Modify: `src/desktop/main.ts`
- Test: `src/features/agent/task-service.test.ts`, `src/features/tasks/runtime.test.ts`, `src/desktop/ipc/agent.test.ts`

- [ ] **Step 1: Write failing generation tests.** Add tests proving a completed generation with three assets creates three project design records, each record keeps the source generation and conversation task IDs, and failed/cancelled generation creates none.
- [ ] **Step 2: Run the tests to verify failure.** Run `pnpm exec vitest run src/features/agent/task-service.test.ts src/features/tasks/runtime.test.ts src/desktop/ipc/agent.test.ts --config vitest.config.ts` and confirm current document/base-revision validation prevents the new project-scoped input.
- [ ] **Step 3: Change the generation input.** Define `ProjectDesignGenerationInput` with `workspaceId`, `projectId`, `conversationTaskId`, `connectionId`, optional `count`, and project-level size/context fields. Remove `documentId` and `baseRevisionId` from this path. Keep conversation context and designer/brand snapshots in the task context.
- [ ] **Step 4: Persist designs at completion.** After managed image assets are stored, call the project store to add one `ProjectDesign` per asset. Keep task candidates as diagnostics/source metadata, but make the project design collection the durable display index.
- [ ] **Step 5: Remove finalize-side effects.** Delete scene replacement, final revision commits, `setFinalDocumentRevision`, and candidate-removal calls from the generation completion path. Export will later use a temporary scene only.
- [ ] **Step 6: Run focused generation tests and typecheck.** Confirm three design records, failure behavior, cancellation behavior, and no revision writes.
- [ ] **Step 7: Commit generation behavior.** `git add src/features/agent src/features/tasks src/desktop/ipc/agent.ts src/desktop/main.ts src/features/agent/task-service.test.ts src/features/tasks/runtime.test.ts src/desktop/ipc/agent.test.ts && git commit -m "refactor: persist generated designs without finalization"`.

## Task 4: Build the Konva Project Canvas Stage

**Files:**
- Create: `src/app/studio/ProjectCanvasStage.tsx`
- Create: `src/app/studio/project-canvas.css`
- Modify: `src/features/canvas/CanvasWorkspace.tsx` or extract shared Konva helpers into `src/features/canvas/konva-stage.tsx`
- Test: `src/app/studio/ProjectCanvasStage.test.tsx`, `src/features/canvas/CanvasWorkspace.test.tsx`

- [ ] **Step 1: Add failing layout/math tests.** Test row-major placement with a fixed maximum width, wrapping, pointer-centered zoom, empty-space pan, node hit selection, and drag position updates.
- [ ] **Step 2: Run the tests to verify failure.** Run `pnpm exec vitest run src/app/studio/ProjectCanvasStage.test.tsx src/features/canvas/CanvasWorkspace.test.tsx --config vitest.config.ts` and confirm the new module is absent.
- [ ] **Step 3: Implement pure canvas helpers first.** Add exported functions for `layoutProjectDesigns`, `zoomAroundPointer`, `panViewport`, and `centerNodeInViewport`; keep them deterministic and independent of React so they can be tested without a real canvas.
- [ ] **Step 4: Implement the stage.** Render a persistent dot grid, image nodes, dimensionally accurate skeleton rectangles, missing-asset states, selection stroke, and drag handlers using `react-konva`. Use an asset cache keyed by `assetId`; revoke object URLs on replacement/unmount.
- [ ] **Step 5: Implement interaction boundaries.** Start panning only when the stage background is hit; stop propagation from design nodes; select on click/tap; persist node coordinates through an `onLayoutChange` callback; center the newest node after insertion.
- [ ] **Step 6: Verify stage behavior.** Run the focused tests and `pnpm typecheck`; ensure jsdom tests use the existing canvas fallback and do not require a browser GPU.
- [ ] **Step 7: Commit the stage.** `git add src/app/studio/ProjectCanvasStage.tsx src/app/studio/ProjectCanvasStage.test.tsx src/app/studio/project-canvas.css src/features/canvas && git commit -m "feat: add project canvas stage"`.

## Task 5: Add ProjectCanvas Orchestration and Selection Toolbar

**Files:**
- Create: `src/app/studio/ProjectCanvas.tsx`
- Create: `src/app/studio/ProjectCanvasToolbar.tsx`
- Modify: `src/app/studio/ConversationDock.tsx`, `src/app/studio/AnalysisPanel.tsx`, `src/app/studio/CandidateBoard.tsx` as needed to share selection/generation state
- Test: `src/app/studio/ProjectCanvas.test.tsx`, `src/app/studio/ProjectCanvasToolbar.test.tsx`

- [ ] **Step 1: Write failing orchestration tests.** Cover loading all project designs, subscribing to task completion, appending generation placeholders, replacing placeholders with managed assets, selection state, no-selection disabled actions, adding a selected asset to the next conversation, and project-scoped export.
- [ ] **Step 2: Run tests to verify failure.** Run `pnpm exec vitest run src/app/studio/ProjectCanvas.test.tsx src/app/studio/ProjectCanvasToolbar.test.tsx --config vitest.config.ts` and confirm the new surface is missing.
- [ ] **Step 3: Implement project loading.** Load project metadata/designs/layout using the desktop API, construct a single project-scoped design list, and show an actionable error without rendering a partial canvas when the manifest is unsupported.
- [ ] **Step 4: Implement generation UI state.** Track running generation tasks and render placeholders with requested width/height. On completion, refresh/add project design records and center/select the newest design. Keep all earlier designs visible.
- [ ] **Step 5: Implement selection actions.** Provide toolbar actions for add-to-conversation, export, continue conversation, and source inspection. Disable actions when no design is selected or when the workspace is read-only. Do not include finalize controls.
- [ ] **Step 6: Implement temporary export.** Build a transient one-image `DesignScene` from the selected managed asset and call `exportDocument` without saving a scene or committing a revision.
- [ ] **Step 7: Run focused tests and commit.** `git add src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvasToolbar.tsx src/app/studio/ProjectCanvas.test.tsx src/app/studio/ProjectCanvasToolbar.test.tsx src/app/studio/ConversationDock.tsx src/app/studio/AnalysisPanel.tsx src/app/studio/CandidateBoard.tsx && git commit -m "feat: add project canvas orchestration"`.

## Task 6: Route Projects Directly to Canvas and Remove Manual Documents

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/studio/types.ts`
- Modify: `src/app/studio/StudioHome.tsx`, `src/app/studio/HomeProjectPanel.tsx`
- Delete: `src/app/studio/ProjectDetailPage.tsx`, `src/app/studio/project-detail.css`
- Modify/Delete tests: `src/app/Studio.test.tsx`, `src/app/studio/ProjectDetailPage.test.tsx`

- [ ] **Step 1: Add failing route tests.** Assert that clicking a project renders `ProjectCanvas` directly, the project-detail heading/actions are absent, and the manual “新建设计稿” action is absent.
- [ ] **Step 2: Remove document route state.** Delete `documentOpen`, `activeDocumentId`, `openDocument`, `openDocumentDialog`, `createDocument`, related size/source state, and `ProjectDetailPage` rendering. Keep project selection as the canvas selection.
- [ ] **Step 3: Update project creation.** Create an empty design collection and canvas defaults instead of a `documents` array. The conversation-first project path should open `ProjectCanvas` immediately and submit its first generation through the existing analysis thread.
- [ ] **Step 4: Update home project cards.** Keep project count based on `designs.length`; clicking the card calls the direct canvas route. Remove “打开画布”/detail-only labels while retaining project archive/rename actions where still applicable.
- [ ] **Step 5: Remove obsolete tests and fixtures.** Delete detail-page assertions and document-creation tests; add direct-canvas assertions and update project fixtures to the new metadata shape.
- [ ] **Step 6: Run Studio tests.** `pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/StudioHome.test.tsx --config vitest.config.ts`; then `pnpm typecheck`.
- [ ] **Step 7: Commit routing removal.** `git add src/app/studio/Studio.tsx src/app/studio/StudioHome.tsx src/app/studio/HomeProjectPanel.tsx src/app/studio/types.ts src/app/Studio.test.tsx && git rm src/app/studio/ProjectDetailPage.tsx src/app/studio/project-detail.css src/app/studio/ProjectDetailPage.test.tsx && git commit -m "refactor: open projects directly on canvas"`.

## Task 7: Remove Finalization and Document-Scene UI From Workbench

**Files:**
- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/workbench.css`
- Modify: `src/features/canvas/CanvasWorkspace.tsx`
- Modify: `src/features/tasks/TaskDetails.tsx`
- Modify: `src/features/revisions/*` only after consumer search confirms no remaining use
- Test: `src/app/studio/Workbench.test.tsx`, `src/features/tasks/TaskDetails.test.tsx`

- [ ] **Step 1: Write failing absence tests.** Assert there is no finalize toolbar button, no “定稿” action, no candidate-removal confirmation, and no document revision update after generation.
- [ ] **Step 2: Remove finalization state and callbacks.** Delete `selectedCandidateId` finalization paths, `finalizeCandidate`, `onCandidateFinalized`, candidate-to-scene replacement, final revision UI, and related confirmation copy. Keep candidate selection only as project-design selection or conversation reference.
- [ ] **Step 3: Reuse canvas primitives without document ownership.** Extract only the generic Konva image loading, selection, and viewport helpers needed by `ProjectCanvasStage`; remove document scene hydration/persistence from the project canvas path.
- [ ] **Step 4: Simplify task details.** Keep view/compare/continue/source diagnostics but remove finalize callbacks and labels.
- [ ] **Step 5: Remove dead revision APIs only after `rg` proves unused.** Delete `setFinalDocumentRevision`, project finalization metadata updates, and unused revision imports; do not delete revision history needed by unrelated workspace features.
- [ ] **Step 6: Run workbench/task tests and commit.** `pnpm exec vitest run src/app/studio/Workbench.test.tsx src/features/tasks/TaskDetails.test.tsx --config vitest.config.ts && pnpm typecheck`; commit as `refactor: remove design finalization flow`.

## Task 8: Update Export, Conversation References, and Read-Only Behavior

**Files:**
- Modify: `src/app/studio/LibraryPages.tsx`
- Modify: `src/app/studio/ConversationDock.tsx`
- Modify: `src/platform/contracts.ts`, `src/desktop/preload.ts` if export input changes
- Test: `src/app/studio/LibraryPages.test.tsx`, `src/app/studio/ConversationDock.test.tsx`

- [ ] **Step 1: Add export tests.** Verify a selected project design exports from its managed asset and no export path requires a document or finalized revision.
- [ ] **Step 2: Route export through `ProjectCanvas`.** Keep one selected-design export action; remove project-detail delivery assumptions and document selectors from the project flow.
- [ ] **Step 3: Preserve conversation references.** Selecting a design adds only its managed asset ID to the next conversation; duplicate selection is ignored; binary data is not copied into the conversation task.
- [ ] **Step 4: Enforce read-only behavior.** Read-only users may pan, zoom, select, inspect, and export; generation, dragging persistence, and conversation submission are disabled with existing notification patterns.
- [ ] **Step 5: Run focused tests and commit.** `pnpm exec vitest run src/app/studio/LibraryPages.test.tsx src/app/studio/ConversationDock.test.tsx --config vitest.config.ts && pnpm typecheck`; commit as `feat: export and reference project designs`.

## Task 9: Integration and E2E Coverage

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `tests/e2e/studio.spec.ts`, `tests/e2e/full-design-journey.spec.ts`, `tests/e2e/test-workspace.ts`
- Add: project-canvas integration fixtures as needed

- [ ] **Step 1: Add integration coverage.** Create a new project, generate multiple assets, close/reopen the workspace, and assert all `ProjectDesign` records and canvas layout restore. Add an old-format manifest fixture that fails with the actionable unsupported error.
- [ ] **Step 2: Add E2E coverage.** Verify direct project-to-canvas navigation, horizontal-first wrapping, grid visibility, pan/zoom, design selection, skeleton-to-image replacement, add-to-conversation, export, read-only behavior, and absence of detail/manual/finalize controls.
- [ ] **Step 3: Run integration tests.** `pnpm test:integration`; fix storage/IPC regressions before touching E2E.
- [ ] **Step 4: Run E2E tests.** `pnpm test:e2e`; use the built renderer directory if the preview server requires an explicit root.
- [ ] **Step 5: Commit integration coverage.** `git add tests/integration tests/e2e && git commit -m "test: cover project canvas flow"`.

## Task 10: Full Verification and Cleanup

- [ ] **Step 1: Search for removed concepts.** Run `rg "ProjectDetailPage|finalizedRevisionId|sourceRevisionId|新建设计稿|定稿|documentEntries|activeDocumentId" src tests`; remaining matches must be limited to intentionally isolated legacy migration rejection tests or unrelated revision history.
- [ ] **Step 2: Run the complete acceptance commands.**

```bash
pnpm exec vitest run src/features/agent src/features/tasks src/features/canvas src/app/studio src/desktop/ipc/agent.test.ts
pnpm test:integration
pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

- [ ] **Step 3: Review the rendered UI.** Confirm project cards open directly to the canvas, all designs are visible, the grid remains visible, the selected-design toolbar is understandable, and no finalization/manual-document affordance remains.
- [ ] **Step 4: Commit final cleanup.** Stage only the files changed by Tasks 1-9 (do not use a broad `git add src tests docs`, because the workspace may contain unrelated user changes), then commit with `git commit -m "refactor: complete project canvas workflow"`.
