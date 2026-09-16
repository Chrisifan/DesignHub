# Portfolio Designer Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn portfolio designer creation into an editable four-step wizard that synthesizes all selected images into one named designer profile before artwork selection and publication.

**Architecture:** Expand the transient portfolio selection bridge so the renderer can submit several inspected batches as one bounded image set while retaining those batches until the wizard closes. Change vision analysis to send that full set in one provider request and require one complete synthesized profile. In the renderer, replace the two-state candidate flow with explicit `import`, `analyse`, `avatar`, and `review` states; the editable analysis draft becomes the sole source for artwork generation and final publication.

**Tech Stack:** React, TypeScript, Vitest, Electron IPC, existing OpenAI-compatible vision adapter, existing CSS design tokens.

---

### Task 1: Submit One Synthesized Profile From All Selected Images

**Files:**
- Modify: `src/features/providers/adapter.ts:14-22,340-343`
- Modify: `src/features/providers/adapter.test.ts:45-60,100-113`
- Modify: `src/features/providers/conformance.ts:52-58`
- Modify: `src/features/agent/analyze-portfolio.ts:1-200`
- Modify: `src/features/agent/analyze-portfolio.test.ts:1-90`
- Modify: `src/features/agent/task-service.test.ts:461-500`

- [ ] **Step 1: Write failing tests for a single multi-image synthesis request**

  Add a provider adapter test that calls:

  ```ts
  await adapter.analyzeVision({
    prompt: 'Synthesise the selected portfolio.',
    images: [
      { url: 'https://img.test/cover.png' },
      { base64: 'cG5n', mimeType: 'image/png' },
    ],
  });
  ```

  Assert the outbound chat content has one text part and two `image_url` parts. In `analyze-portfolio.test.ts`, pass two sources and assert `analyzeVision` receives one request with both images, a prompt containing `original designer name`, and returns exactly one complete candidate. Update the task-service test to expect one vision call and both source IDs in the completed task.

- [ ] **Step 2: Run focused tests and verify they fail for missing multi-image support**

  Run:

  ```bash
  pnpm exec vitest run src/features/providers/adapter.test.ts src/features/agent/analyze-portfolio.test.ts src/features/agent/task-service.test.ts
  ```

  Expected: FAIL because `VisionRequest` only accepts `image`, and analysis invokes the provider once per source.

- [ ] **Step 3: Replace the single-image vision request contract**

  In `adapter.ts`, define:

  ```ts
  export type VisionImage = { url: string } | { base64: string; mimeType?: string };
  export type VisionRequest = { prompt: string; images: VisionImage[] };
  ```

  Update `analyzeVision` to map each `images` entry to an `image_url` part and reject an empty image list before calling `chatFor`. Update conformance and all direct `analyzeVision` callers to use `images: [...]`.

- [ ] **Step 4: Synthesize one profile in `analyzePortfolio`**

  Keep source validation and the eight-source limit. Replace the per-source loop with one request:

  ```ts
  const response = await analyzeVisionWithRetry(input.adapter, {
    prompt: portfolioSynthesisPrompt(input.sources),
    images: input.sources.map((source) => source.image),
  }, input.signal);
  const candidates = candidatesFromResponse(response.text, 0);
  if (candidates.length !== 1) throw new Error('VISION_ANALYSIS_INVALID_RESPONSE');
  ```

  `portfolioSynthesisPrompt` must list selected source descriptions, require one complete candidate, require an original style-derived `name`, prohibit placeholders such as `Portfolio candidate`, and retain the current no-provenance instruction. Preserve the current strict complete-candidate validation and transient retry behavior.

- [ ] **Step 5: Run focused tests and verify they pass**

  Run:

  ```bash
  pnpm exec vitest run src/features/providers/adapter.test.ts src/features/agent/analyze-portfolio.test.ts src/features/agent/task-service.test.ts
  ```

  Expected: PASS, including the malformed-profile regression and existing source-data redaction test.

- [ ] **Step 6: Commit the scoped changes**

  ```bash
  git add src/features/providers/adapter.ts src/features/providers/adapter.test.ts src/features/providers/conformance.ts src/features/agent/analyze-portfolio.ts src/features/agent/analyze-portfolio.test.ts src/features/agent/task-service.test.ts
  git commit -m "feat: synthesize portfolio designer profiles"
  ```

### Task 2: Aggregate and Retain Inspected Source Batches

**Files:**
- Modify: `src/platform/contracts.ts:37-45,114-116`
- Modify: `src/platform/runtime.ts:42-46`
- Modify: `src/desktop/ipc/portfolio.ts:17-92`
- Modify: `src/desktop/ipc/portfolio.test.ts:28-83`
- Modify: `src/desktop/preload.ts:62-68`
- Modify: `src/desktop/preload.test.ts` if the bridge shape is asserted there

- [ ] **Step 1: Write failing IPC tests for multiple inspection batches**

  In `portfolio.test.ts`, submit:

  ```ts
  {
    workspaceId: 'workspace-1',
    source: { kind: 'designer-draft', id: 'draft-1' },
    connectionId: 'provider-1',
    selections: [
      { inspectionId: 'inspection-1', sourceIds: ['cover'] },
      { inspectionId: 'inspection-2', sourceIds: ['detail'] },
    ],
    rightsConfirmed: true,
  }
  ```

  Assert `selectedSources` is called for both sessions, `submit` receives the flattened two-source array in selection order, and neither session is discarded after a successful submission. Add rejection coverage for more than eight aggregate sources and duplicate inspection IDs.

- [ ] **Step 2: Run the IPC test and verify it fails on the old single selection shape**

  Run:

  ```bash
  pnpm exec vitest run src/desktop/ipc/portfolio.test.ts
  ```

  Expected: FAIL because the bridge only accepts `inspectionId` and `sourceIds`.

- [ ] **Step 3: Introduce the aggregate selection contract**

  Replace `PortfolioSelectionInput.inspectionId/sourceIds` with:

  ```ts
  selections: Array<{ inspectionId: string; sourceIds: string[] }>;
  ```

  Update `DesktopApi`, unavailable runtime, and preload typing. In `isSelectionInput`, validate a non-empty selection list, unique valid inspection IDs, non-empty unique IDs per batch, and no more than eight selected IDs in total.

- [ ] **Step 4: Resolve all batches before accepting the task**

  In `createPortfolioSelectionHandler`, load each batch with `Promise.all`, flatten the sources, validate the aggregate limit and unique source IDs, then submit the aggregate `PortfolioAnalysisInput`. Do not call `inspector.discard` after successful submission: the renderer needs the retained in-memory inspection sessions for a later full reanalysis. Keep `createPortfolioDiscardHandler` as the explicit cleanup path and preserve sessions if source resolution or task acceptance throws.

- [ ] **Step 5: Run IPC and source-inspector tests**

  Run:

  ```bash
  pnpm exec vitest run src/desktop/ipc/portfolio.test.ts src/desktop/portfolio-source-inspector.test.ts
  ```

  Expected: PASS, confirming transient source data remains renderer-inaccessible and is released only through explicit discard.

- [ ] **Step 6: Commit the scoped changes**

  ```bash
  git add src/platform/contracts.ts src/platform/runtime.ts src/desktop/ipc/portfolio.ts src/desktop/ipc/portfolio.test.ts src/desktop/preload.ts src/desktop/preload.test.ts
  git commit -m "feat: aggregate portfolio source selections"
  ```

### Task 3: Add a Four-State Creation Session and Editable Analysis Draft

**Files:**
- Modify: `src/app/studio/DesignerLibrary.tsx:33-90,138-155,360-733,850-1240`
- Modify: `src/app/studio/DesignerLibrary.test.tsx:248-606`
- Modify: `src/app/studio/library.css:364-590`

- [ ] **Step 1: Write failing renderer tests for second-step editing and aggregate reanalysis**

  Add tests that:

  ```ts
  // completed analysis stays at step 2 and exposes an editable model-generated name
  expect(screen.getByRole('heading', { name: '红白庆典电商促销视觉' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '设计师名称' }), {
    target: { value: '庆典货架编辑部' },
  });
  expect(screen.getByDisplayValue('庆典货架编辑部')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '发布预览' })).not.toBeInTheDocument();
  ```

  Add a reanalysis test that starts with a manual edit, inspects a second batch, invokes reanalysis, and asserts the second call uses both inspection batches and replaces the edited name with the new completed profile. Add a failure variant asserting the original edit remains visible when the reanalysis task fails.

- [ ] **Step 2: Run the DesignerLibrary test and verify it fails**

  Run:

  ```bash
  pnpm exec vitest run src/app/studio/DesignerLibrary.test.tsx
  ```

  Expected: FAIL because completion currently transitions directly to review and no editable analysis draft or aggregate batch state exists.

- [ ] **Step 3: Model the wizard session explicitly**

  Replace `candidatePhase` with:

  ```ts
  type PortfolioWizardPhase = 'import' | 'analyse' | 'avatar' | 'review';
  type PortfolioSelectionBatch = { inspectionId: string; sourceIds: string[] };
  ```

  Store `wizardPhase`, `analysisDraft`, `analysisProfile`, `selectionBatches`, current `portfolioInspection`, and its current selected IDs. Keep these states in memory only; do not route `analysisDraft` through `newDraft`, `activeDraft`, or persisted `DesignerDraftState`, which remain exclusively for editing existing saved designers. `openCreate` resets the wizard session; close discards every unique inspection ID from `selectionBatches` plus the current inspection before clearing the editor.

- [ ] **Step 4: Convert complete analysis output into the editable draft**

  Add a `profileFromDraft(draft, base)` helper that converts all editable `DesignerDraft` fields back to a complete `PersonaProfile`, preserving the base profile ID, artwork alt text, and empty artwork fields. When an analysis task completes, parse its one profile, set `analysisProfile`, set `analysisDraft` from `profileToDraft`, clear task/error state, and set `wizardPhase('analyse')`. Do not add it to `profiles`.

- [ ] **Step 5: Preserve all prior selected sources for reanalysis**

  Split source submission into `submitPortfolioAnalysis(selectionBatches)`. The initial submit adds the current batch then sends it. In analyse state, the secondary `追加作品集` action returns to an import panel without discarding accumulated batches; a successful submit sends prior batches plus the new batch. On a successful replacement, overwrite `analysisProfile` and `analysisDraft` together. On an analysis failure, retain the current draft and restore the analyse state with the error message.

- [ ] **Step 6: Render the editable feature-deconstruction step**

  Replace the current post-analysis `CandidateReview` branch with `PortfolioAnalysisEditor`. It must render labelled controls for `设计师名称`, `署名`, `风格说明`, `创作原则`, `标签`, `色板`, `排版`, `构图`, `材质`, and `禁用规则`, all wired to `analysisDraft`. Render current color values as swatches next to the comma-delimited palette input. Its fixed footer contains `返回导入`, secondary `追加作品集`, secondary `重新解析`, and primary `下一步：生成形象`; it has no publish action.

- [ ] **Step 7: Add scoped styling without changing global drawer behavior**

  Add `.portfolio-analysis-editor` styles in `library.css`: use a responsive two-column grid on wide drawers, one column below 720px, 8px-or-less corner radii, fixed-height color swatches, and a full-width negative-rules field. Reuse existing surface, border, primary, error, and mono tokens; do not add a new palette or alter `.ui-drawer` sizing rules.

- [ ] **Step 8: Run the renderer tests and verify they pass**

  Run:

  ```bash
  pnpm exec vitest run src/app/studio/DesignerLibrary.test.tsx
  ```

  Expected: PASS, including existing initial inspection, polling, managed-artwork, and failure recovery tests updated for the second-step state.

- [ ] **Step 9: Commit the scoped changes**

  ```bash
  git add src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/library.css
  git commit -m "feat: add editable portfolio analysis step"
  ```

### Task 4: Gate Artwork Choice and Publication Behind Steps Three and Four

**Files:**
- Modify: `src/app/studio/DesignerLibrary.tsx:85-101,558-733,950-1240`
- Modify: `src/app/studio/DesignerLibrary.test.tsx:340-445`
- Modify: `src/app/studio/library.css:400-590`

- [ ] **Step 1: Write failing tests for artwork option selection and publish gating**

  Mock `submitDesignerArtworkGeneration` with three asset IDs. Assert clicking `下一步：生成形象` moves to step 3 and submits `count: 3` with a prompt containing the edited design name. Assert the step 3 `下一步：预览发布` action remains disabled until an artwork option is selected. After selection, assert it moves to step 4, where `发布预览` becomes visible and is the only action that persists a `published` profile.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run:

  ```bash
  pnpm exec vitest run src/app/studio/DesignerLibrary.test.tsx -t "artwork"
  ```

  Expected: FAIL because current generation and publishing actions share the post-analysis footer.

- [ ] **Step 3: Represent generated artwork as local choices**

  Add:

  ```ts
  type ArtworkOption = { assetId: string; artworkUrl: string };
  ```

  Replace `adoptArtworkTask` with a helper that reads every `task.result.assetIds`, returns available options using `designhub-artwork://<assetId>`, and does not mutate the analysis profile. Request generation from `profileFromDraft(analysisDraft, analysisProfile)` with `count: 3`. Keep existing polling, but set the collected options and transition to `avatar` only after at least one readable asset arrives.

- [ ] **Step 4: Render step three and step four separately**

  Render `ArtworkSelection` during `avatar`: a stable responsive option grid with selectable artwork previews, explicit selected state, retry control, back-to-analysis control, and a disabled next button until `selectedArtworkAssetId` is set. Render `PortfolioFinalPreview` during `review`: build the selected final profile from the analysis draft and selected option, show its name, summary, Style DNA and artwork, allow going back to image choice, and expose `发布预览` only in the fixed review footer.

- [ ] **Step 5: Publish only the selected final profile**

  Update `publishPreview` to require `wizardPhase === 'review'`, `analysisProfile`, and `selectedArtworkAssetId`; build the published `PersonaProfile` from the editable draft plus selected artwork. Retain current workspace persistence, default selection, and notification behavior. Never persist temporary artwork options or analysis drafts.

- [ ] **Step 6: Run focused tests and verify they pass**

  Run:

  ```bash
  pnpm exec vitest run src/app/studio/DesignerLibrary.test.tsx
  ```

  Expected: PASS, proving no profile is saved before step four and managed asset URLs, retry handling, and final publication remain correct.

- [ ] **Step 7: Commit the scoped changes**

  ```bash
  git add src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/library.css
  git commit -m "feat: gate designer publishing behind artwork choice"
  ```

### Task 5: Run End-to-End Verification

**Files:**
- Modify only if assertions require it: `tests/e2e/designer-drawer.spec.ts`

- [ ] **Step 1: Add or update the drawer flow E2E assertion**

  Cover the visible phase order: imported source, editable feature analysis, avatar selection, final preview, then publish. Assert the final publish action is absent in steps 2 and 3.

- [ ] **Step 2: Run targeted browser verification**

  Run:

  ```bash
  pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
  ```

  Expected: PASS with no overlapping drawer footer/content and no text overflow at desktop and mobile viewports.

- [ ] **Step 3: Run the full verification gate**

  Run:

  ```bash
  pnpm test:unit
  pnpm typecheck
  pnpm lint
  git diff --check
  ```

  Expected: all commands exit 0. Record any unavailable E2E prerequisite rather than claiming it passed.

- [ ] **Step 4: Commit any E2E-only test adjustment**

  ```bash
  git add tests/e2e/designer-drawer.spec.ts
  git commit -m "test: cover portfolio designer wizard"
  ```
