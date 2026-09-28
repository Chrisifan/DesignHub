# Single Project Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace user-visible workspaces with one user-selected project-library directory that opens directly into a project-based home, without discovering or changing legacy workspaces.

**Architecture:** Add a versioned project-library manifest and trusted main-process library handle, persist one library path under Electron `userData`, and reuse the existing project-directory, shared-data, task, trash, and lock implementations behind library-scoped APIs. Replace workspace onboarding and switcher UI with first-start selection and recovery flows while keeping projects independent and task history/trash shared across the library.

**Tech Stack:** Electron 44, React 19, TypeScript 5.9, Node filesystem APIs, better-sqlite3, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-single-project-library-design.md`

## Global Constraints

- The selected directory itself is the project-library root; do not create a named child directory.
- Persist one selected library path in Electron `userData`; do not restore from `designhub.recent.workspaces` or any other legacy workspace list.
- Never scan, open, migrate, modify, or delete legacy workspace directories.
- Initialize only an empty directory; reject unknown non-empty directories without writing to them.
- Keep projects in separate project directories while task history and trash remain library-wide shared collections.
- Keep credentials in operating-system secure storage and provider configuration in application-local `userData`.
- All path checks, locks, project-library identity checks, and write authorization remain in the Electron main process.
- Do not add multi-library switching, cloud sync, or project-format changes.

---

## File Map

- `src/features/project-library/open-project-library.ts`: project-library descriptor and handle contracts plus open-mode types.
- `src/desktop/storage/project-library-store.ts`: versioned library manifest, empty-directory initialization, open validation, writer lock, directory identity and writable lease.
- `src/desktop/storage/project-library-settings-store.ts`: atomic persistence of the single selected path under `app.getPath('userData')`.
- `src/desktop/ipc/project-library.ts`: trusted startup-status and choose/initialize/open handlers.
- `src/desktop/main.ts`, `src/desktop/preload.ts`, `src/platform/contracts.ts`, `src/platform/runtime.ts`: active-library lifecycle, allowlisted bridge methods and renderer contract.
- `src/desktop/storage/*.ts`, `src/desktop/ipc/*.ts`, and `src/features/**`: replace active `WorkspaceHandle` dependencies and workspace identity context with project-library equivalents without changing per-project storage ownership.
- `src/app/App.tsx`, `src/app/App.test.tsx`, `src/app/locales/{zh-CN,en}.json`: first-start selection, remembered-library recovery, and removal of create/open/recent workspace UI.
- `src/app/studio/Studio.tsx`, `src/app/shell/WindowBar.tsx`, related tests and `src/app/styles/window.css`: remove workspace switching and display of workspace identity.
- `tests/e2e/{welcome,studio}.spec.ts`, storage integration tests, and `docs/adr/0026-single-project-library.md`: end-to-end proof and architecture decision record superseding the workspace UX decision.

## Tasks

### Task 1: Add the project-library storage contract

**Files:**
- Create: `src/features/project-library/open-project-library.ts`
- Create: `src/desktop/storage/project-library-store.ts`
- Create: `src/desktop/storage/project-library-store.test.ts`
- Reference: `src/desktop/storage/workspace-store.ts`
- Reference: `tests/integration/workspace-open.test.ts` and `tests/integration/workspace-open-identity.test.ts`

**Interfaces:**
- Produce `ProjectLibraryDescriptor { libraryId: string; directory: string; formatVersion: number; openMode: WorkspaceOpenMode }`.
- Produce `ProjectLibraryHandle { library: ProjectLibraryDescriptor; close: () => void }`.
- Produce `initializeProjectLibrary(directory: string): Promise<ProjectLibraryHandle>` and `openProjectLibrary(directory: string, supportedFormat?: number): Promise<ProjectLibraryHandle>`.
- Produce `getWritableProjectLibraryLease(handle: ProjectLibraryHandle): ProjectLibraryDescriptor | null`.
- The manifest filename is `designhub.library.json`; its kind is `designhub-project-library`; its identity is a generated stable UUID.

- [x] **Step 1: Write storage contract tests first** for empty-directory initialization, stable ID after reopen, valid-library reopen, unknown non-empty rejection, legacy `designhub.workspace.json` rejection without writes, writer-lock contention, directory replacement invalidating a lease, and cleanup/retry after injected initialization failure.
- [x] **Step 2: Run the focused test file and confirm it fails** because the library initialization/open behavior was unavailable.
- [x] **Step 3: Implement library initialization/opening** by adapting the identity and lock protections in `workspace-store.ts`; create only `.designhub`, `projects`, `shared-assets`, and `trash` in the selected empty root, and publish the library manifest only after required structure is ready.
- [x] **Step 4: Reject every non-empty unrecognized root without mutation**; recognize only a valid `designhub.library.json`, and do not inspect a legacy workspace manifest as a migration candidate.
- [x] **Step 5: Run `pnpm exec vitest run --config vitest.config.ts src/desktop/storage/project-library-store.test.ts`**; 6/6 passed.
- [x] **Step 6: Run `pnpm exec vitest run --config vitest.config.ts tests/integration/workspace-open.test.ts tests/integration/workspace-open-identity.test.ts`**; 12/12 passed, confirming the legacy storage implementation remains unaffected until its consumers move in Task 3.
- [x] **Step 7: Commit** the contract and store as `feat: add project library storage` (`2a04f84`).

### Task 2: Persist one library path and expose trusted lifecycle IPC

**Files:**
- Create: `src/desktop/storage/project-library-settings-store.ts`
- Create: `src/desktop/storage/project-library-settings-store.test.ts`
- Create: `src/desktop/ipc/project-library.ts`
- Create: `src/desktop/ipc/project-library.test.ts`
- Modify: `src/desktop/main.ts`
- Modify: `src/desktop/preload.ts`
- Modify: `src/platform/contracts.ts`
- Modify: `src/platform/runtime.ts`

**Interfaces:**
- `getProjectLibraryStatus()` returns `{ state: 'unselected' }`, `{ state: 'ready'; library: ProjectLibraryDescriptor }`, or `{ state: 'needs-location'; directory: string; reason: 'missing' | 'unavailable' | 'invalid' }`.
- `chooseProjectLibrary()` opens the native directory picker in the main process, then opens a valid existing library or initializes an empty directory; it persists the path only after a successful open.
- The chooser result is `ProjectLibraryDescriptor | null`; cancel returns `null`, and the renderer never supplies an arbitrary root path to a write handler.
- The preference store exposes `loadProjectLibraryDirectory(): string | null` and `saveProjectLibraryDirectory(directory: string): void` and writes atomically under `userData`.

- [x] **Step 1: Write preference-store tests** for absent path, valid round trip, malformed preference rejection, and atomic-write failure preserving the previous value.
- [x] **Step 2: Write IPC tests** proving startup opens only the configured path, a missing configured path returns `needs-location`, the chooser initializes an empty root, an existing library reopens, cancel changes no setting, unknown non-empty paths do not become active, and calls require a trusted main frame.
- [x] **Step 3: Run both focused test files and confirm expected failures** before adding the implementation; both suites initially failed because the new modules did not exist.
- [x] **Step 4: Implement the atomic `userData` preference store** using the existing atomic-file conventions from provider configuration/settings storage.
- [x] **Step 5: Implement main-process status and chooser handlers** and ensure active handles close before replacing them or quitting.
- [x] **Step 6: Add only the two project-library methods to preload/contracts/runtime** and keep the chooser native; do not expose filesystem initialization primitives to renderer code.
- [x] **Step 7: Run `pnpm exec vitest run src/desktop/storage/project-library-settings-store.test.ts src/desktop/ipc/project-library.test.ts`**; 10/10 tests pass. Typecheck, focused lint, and `git diff --check` pass.
- [ ] **Step 8: Commit** the lifecycle bridge as `feat: persist and open selected project library`.

### Task 3: Rebind storage consumers to the active project library

**Files:**
- Modify: `src/desktop/storage/asset-store.ts`, `brand-store.ts`, `designer-store.ts`, `export-history-store.ts`, `project-store.ts`, `revision-store.ts`, `scene-store.ts`, `search-index-store.ts`, `settings-store.ts`, `task-store.ts`, `backup-store.ts`, `storage-smoke.ts` and their tests.
- Modify: `src/desktop/ipc/agent.ts`, `assets.ts`, `backup.ts`, `brands.ts`, `designers.ts`, `export-history.ts`, `export.ts`, `package.ts`, `portfolio.ts`, `projects.ts`, `revisions.ts`, `scenes.ts`, `search.ts`, `settings.ts`, `tasks.ts` and their tests.
- Modify: workspace-bound type declarations under `src/features/workspace/`, project metadata/context under `src/features/projects/`, task context under `src/features/tasks/` and `src/features/agent/`, `src/desktop/artwork-protocol.ts`, and the matching integration tests.
- Reference: `src/desktop/storage/workspace-store.ts` until all production consumers have moved.

**Interfaces:**
- All active storage factories consume `ProjectLibraryHandle` and validate through `getWritableProjectLibraryLease`.
- Project-library descriptor and renderer-to-main IPC context use `libraryId`; project-scoped inputs continue to include `projectId` and, when applicable, `documentId`.
- Existing project metadata/database/package and persisted task record field names remain unchanged; adapters bind their stored `workspaceId` identity value to the active `libraryId` so this change does not introduce a project-format migration.
- `createProjectStore(library)` continues to create projects under `<library>/projects/<project-id>`; task persistence and trash remain library-wide.
- Project manifest, project database, and project-package formats remain unchanged except replacing library identity references where the existing runtime context requires it.

- [x] **Step 1: Add failing contract tests** for project creation in the selected library, opening the same project after library reopen, project isolation, cross-project task listing, one library-wide trash list, and rejection of a mismatched `libraryId` at IPC boundaries.
- [x] **Step 2: Run focused storage and integration tests** and record the expected failures before changing consumer types.
- [x] **Step 3: Rebind project, asset, revision, scene, designer, brand, settings, task, search, export-history, package, backup, and agent stores** from `WorkspaceHandle` to `ProjectLibraryHandle` while preserving their existing on-disk ownership and validation behavior.
- [x] **Step 4: Rename the active renderer-to-main request context and IPC guards** from `workspaceId` to `libraryId`; adapt at the storage boundary where existing project metadata or persisted task APIs still use their stable `workspaceId` field name, always passing the active `libraryId` value.
- [x] **Step 5: Keep task history and trash library-wide** and verify tasks retain their project association while trashed projects from different projects share one list and restore correctly.
- [x] **Step 6: Update backups, package import/export and artwork resolution** to take the active library handle without changing package compatibility or placing credentials in the library.
- [x] **Step 7: Run `pnpm exec vitest run src/desktop/storage tests/integration/project-store.test.ts tests/integration/trash-restore.test.ts tests/integration/backup-migration.test.ts tests/integration/desktop-boundary.test.ts`** and confirm focused storage/security regressions pass.
- [ ] **Step 8: Remove the unused production `workspace-store.ts` and its workspace-specific tests** after all active consumers have moved; retain a focused regression in `project-library-store.test.ts` proving a legacy workspace manifest is rejected without modification. (Deferred: the compatibility storage adapter and historical tests remain outside active renderer/IPC lifecycle paths.)
- [x] **Step 9: Run `pnpm typecheck`** to locate and remove remaining active `WorkspaceHandle` production paths; persisted `workspaceId` field names may remain only as stable on-disk schema fields whose value is the active library identity.
- [ ] **Step 10: Commit** the consumer conversion as `refactor: scope application data to project library`.

### Task 4: Replace welcome onboarding with first-library selection and recovery

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/locales/zh-CN.json`
- Modify: `src/app/locales/en.json`
- Modify: `src/app/styles/window.css`

**Interfaces:**
- `App` uses the bridge methods `getProjectLibraryStatus()` and `chooseProjectLibrary()` from Task 2.
- Welcome has one primary directory-selection action; no workspace name, parent-directory form, create/open split, or recent-workspace list remains.
- Recovery displays the unavailable path and offers explicit re-location or explicit use of a new empty directory; failure/cancel preserves the prior path and visible state.

- [x] **Step 1: Replace workspace tests with failing onboarding tests** for one selection action, cancel/no mutation, empty-directory initialization through the bridge, existing-library reopen, configured-library startup, missing-path recovery, unknown non-empty error, and ignoring a populated `designhub.recent.workspaces` localStorage key.
- [x] **Step 2: Run `pnpm exec vitest run src/app/App.test.tsx`** and confirm those tests fail against the current two-button workspace flow.
- [x] **Step 3: Replace workspace form/recent-state logic in `App.tsx`** with project-library status, select, ready, and recovery states; remove every read/write of `designhub.recent.workspaces`.
- [x] **Step 4: Update Chinese and English strings** for selecting/locating a project directory and actionable errors, then remove obsolete workspace creation copy used only by Welcome.
- [x] **Step 5: Run `pnpm exec vitest run src/app/App.test.tsx`** and verify first start, restore, cancellation, and old-key isolation.
- [ ] **Step 6: Commit** the onboarding flow as `feat: select project library on first launch`.

### Task 5: Remove workspace switching from Studio and window chrome

**Files:**
- Modify: `src/app/studio/Studio.tsx`, `Studio.test.tsx`, `LibraryPages.tsx`, `LibraryPages.test.tsx`.
- Modify: `src/app/shell/WindowBar.tsx`, `WindowBar.test.tsx`, and `src/app/styles/window.css`.
- Modify: `src/app/locales/zh-CN.json`, `src/app/locales/en.json` for remaining visible strings.
- Modify: `tests/e2e/studio.spec.ts`, `tests/e2e/welcome.spec.ts`, and `tests/e2e/test-workspace.ts` to create/select a test project library through the new bridge.

**Interfaces:**
- `Studio` receives `ProjectLibraryDescriptor` and uses `libraryId` for project/task/resource operations.
- `WindowBar` retains app identity, locale/theme controls and native safe areas but has no workspace identity/switch callback.
- Existing project list, project-detail, canvas, task-center and trash screens continue to use the same project navigation and data ownership.

- [x] **Step 1: Add failing Studio/WindowBar tests** asserting no workspace switch button, workspace recent list, workspace name, or workspace dialog is exposed while project creation/import and project navigation remain available.
- [x] **Step 2: Run the focused Studio and WindowBar tests** and confirm the current switcher causes the expected failures.
- [x] **Step 3: Remove the `workspace` dialog and its callback props from `Studio.tsx`**; keep project creation and package import enabled only when the library is writable.
- [x] **Step 4: Remove workspace name/switch controls from `WindowBar.tsx`** while preserving window drag behavior and platform safe areas.
- [x] **Step 5: Update locale copy and layout selectors**; delete styles that only supported recent-workspace choices and workspace switch controls.
- [x] **Step 6: Update E2E setup** so it initializes a temporary project library, and revise assertions to cover the single-library shell, project list, shared task center and shared trash entry.
- [x] **Step 7: Run renderer unit tests** with `pnpm exec vitest run --config vitest.config.ts src/app/Studio.test.tsx src/app/shell/WindowBar.test.tsx src/app/studio/LibraryPages.test.tsx`, then run browser coverage with `pnpm exec playwright test --config playwright.config.ts tests/e2e/welcome.spec.ts tests/e2e/studio.spec.ts`.
- [ ] **Step 8: Commit** the workspace-free shell as `feat: remove workspace switching from studio`.

### Task 6: Prove recovery, shared data and legacy isolation end to end

**Files:**
- Modify: `tests/integration/workspace-open.test.ts`, `workspace-open-identity.test.ts`, `backup-migration.test.ts`, `trash-restore.test.ts`, `project-store.test.ts`, and `tests/e2e/test-workspace.ts`.
- Create: `tests/integration/project-library-startup.test.ts`.
- Modify: `src/desktop/lifecycle.test.ts` and `src/desktop/ipc/workspace.test.ts` or remove the obsolete workspace IPC tests once the old IPC is deleted.

- [x] **Step 1: Add a startup integration test** with an old workspace manifest and a populated legacy localStorage fixture; assert the app reports `unselected` and performs no filesystem read/write against the legacy directory.
- [x] **Step 2: Add recovery integration tests** for a moved library, explicit relinking, unknown non-empty directory refusal, and the user explicitly choosing a different empty library.
- [x] **Step 3: Add cross-project data tests** proving two projects share one task history and one trash/restore flow while each retains separate project metadata and content.
- [x] **Step 4: Run the new integration tests and focused project/trash/backup tests**; fix only failures that violate the approved spec.
- [x] **Step 5: Remove obsolete production `workspace:create`, `workspace:open`, and `workspace:choose-directory` handlers and tests** after all callers use project-library lifecycle IPC.
- [x] **Step 6: Run the legacy-workspace boundary search** and confirm no old startup key, user-visible switcher, or active workspace lifecycle channel remains; retained storage compatibility names and historical tests are documented rather than treated as runtime lifecycle APIs.
- [ ] **Step 7: Commit** the boundary proof as `test: cover project library recovery and isolation`.

### Task 7: Record the new architecture decision and run full verification

**Files:**
- Create: `docs/adr/0026-single-project-library.md`
- Modify: `docs/README.md`
- Modify: `docs/verification/MODULE-REGISTER.md` with the affected M02/M03/M04/M06/M07/M08 regression entry.
- Modify: `docs/verification/M02.md` with project-library validation coverage and any platform gaps.

- [x] **Step 1: Add ADR 0026** recording that one user-selected project library replaces workspace selection, supersedes the user-facing part of ADR 0003, and leaves historical workspace data untouched.
- [x] **Step 2: Link the ADR in `docs/README.md`** and add an accurate module regression entry describing changed storage/IPC/UI contracts, tests run, and platform gaps.
- [x] **Step 3: Run unit tests** with `pnpm test:unit` and confirm the full suite passes.
- [x] **Step 4: Run integration tests** with `pnpm test:integration` and confirm the full suite passes.
- [x] **Step 5: Run E2E tests** with `pnpm test:e2e` and confirm first-start, reopen, recovery, shared task/trash, project and navigation journeys.
- [x] **Step 6: Run `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check`**; resolve all failures before completion.
- [x] **Step 7: Run `pnpm test:native`** and report packaged-executable skips explicitly; do not claim Windows verification unless the Windows packaged build is actually run.
- [ ] **Step 8: Commit** the architecture and verification record as `docs: record single project library decision`.

## Completion Criteria

- First launch asks the user to choose one project-library directory; every later launch opens that library directly.
- Studio and its menus contain no workspace switching or workspace naming behavior.
- A selected library's projects remain separately persisted while task history and trash are shared at library scope.
- A legacy workspace path, manifest, or recent-workspace key cannot cause scanning, migration, opening, mutation, or deletion of that legacy workspace.
- All applicable unit, integration, E2E, lint, typecheck, build, native, and diff checks have recorded outcomes.

## 2026-09-25 closure note

Implementation and verification steps are checked against the current worktree evidence, except the physical removal of the compatibility `workspace-store.ts` path noted above. Commit steps remain unchecked because this execution intentionally preserves the user's uncommitted working tree. The strict legacy-name search is scoped to runtime lifecycle behavior: persisted compatibility fields, backup adapters, and historical storage tests retain `workspace` names by design; no renderer/preload workspace lifecycle API remains.
