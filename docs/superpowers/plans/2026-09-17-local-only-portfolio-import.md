# Local-only Portfolio Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the portfolio designer drawer to 560 pixels, remove remote portfolio inspection end to end, and make locally uploaded candidates selected by default with overflow-safe filenames.

**Architecture:** Narrow the shared inspection contract to local image and ZIP requests, then delete the now-unreachable remote branches from IPC and the desktop source inspector. Keep the renderer's existing inspection lifecycle, but make successful local inspection atomically replace the candidates and selected IDs. Adapt the drawer's existing report and candidate layouts to its new fixed width without introducing a second component path.

**Tech Stack:** React 19, TypeScript 5.9, Electron IPC, Vitest and Testing Library, Playwright, CSS.

---

### Task 1: Remove remote portfolio inspection from contracts and desktop code

**Files:**
- Modify: `src/platform/contracts.ts:19-30`
- Modify: `src/desktop/ipc/portfolio.ts:20-83`
- Modify: `src/desktop/ipc/portfolio.test.ts:10-97`
- Modify: `src/desktop/portfolio-source-inspector.ts:27-398`
- Modify: `src/desktop/portfolio-source-inspector.test.ts`

- [ ] **Step 1: Replace the remote IPC test with local-only validation tests**

Add a test that calls `createPortfolioInspectionHandler` with `{ kind: 'local-images' }`, returns `['/tmp/cover.png']` from the picker, and expects `inspectLocalImages(['/tmp/cover.png'])`. Add assertions that `{ kind: 'remote-page', url: 'https://public.test/work' }`, `{ kind: 'remote-image', url: 'https://public.test/cover.png' }`, and a local request carrying `url` all resolve to `null` without opening the picker.

Use an inspector fixture containing only the final interface:

```ts
const inspector = {
  inspectLocalImages,
  inspectZip: vi.fn(),
  selectedSources: vi.fn(),
  discard: vi.fn(),
  discardAll: vi.fn(),
};
```

- [ ] **Step 2: Run the IPC test and confirm the new interface fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/desktop/ipc/portfolio.test.ts
```

Expected: FAIL because remote requests are still accepted and `PortfolioSourceInspector` still requires remote methods.

- [ ] **Step 3: Narrow the shared contract and IPC handler**

Change the request and origin unions to local-only forms:

```ts
export type PortfolioInspectionRequest =
  | { kind: 'local-images' }
  | { kind: 'local-zip' };

export type PortfolioInspectionCandidate = {
  id: string;
  label: string;
  description: string;
  origin: 'local-image' | 'zip-image';
  previewUrl: string;
};
```

Delete `isRemoteUrl`. Make `isInspectionInput` accept exactly `local-images` or `local-zip` with no `url` property. Simplify the handler to choose files and dispatch directly:

```ts
const paths = await chooseFiles(input.request.kind);
if (!paths?.length) return null;
return input.request.kind === 'local-images'
  ? inspector.inspectLocalImages(paths)
  : inspector.inspectZip(paths[0] as string);
```

- [ ] **Step 4: Delete remote source loading from the inspector**

Remove `DeferredPageInspectionSource`, remote network limits and URL/address validation helpers, HTML metadata parsing, download functions, `inspectRemoteImage`, `inspectRemotePage`, and their returned interface members. Preserve `sourceFromBytes`, local file decoding, ZIP validation, inspection storage, `selectedSources`, `discard`, and `discardAll`.

The public interface must be:

```ts
export type PortfolioSourceInspector = {
  inspectLocalImages: (paths: readonly string[]) => Promise<PortfolioInspection>;
  inspectZip: (path: string) => Promise<PortfolioInspection>;
  selectedSources: (inspectionId: string, ids: readonly string[]) => Promise<PortfolioImageSource[]>;
  discard: (inspectionId: string) => void;
  discardAll: () => void;
};
```

- [ ] **Step 5: Remove remote inspector tests and retain local safeguards**

Delete tests for private-network rejection, redirects, DNS rebinding, page metadata extraction, remote response sizes, and remote image decoding. Keep and run tests for local images, ZIP entry limits, image decoding, selection, and disposal. Update all IPC inspector stubs to omit remote methods.

- [ ] **Step 6: Verify desktop behavior and compile-time consumers**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/desktop/ipc/portfolio.test.ts src/desktop/portfolio-source-inspector.test.ts
pnpm typecheck
```

Expected: both test files PASS and TypeScript reports no remote-kind or remote-origin consumers outside renderer tests that Task 2 intentionally updates.

- [ ] **Step 7: Commit the desktop removal**

```bash
git add src/platform/contracts.ts src/desktop/ipc/portfolio.ts src/desktop/ipc/portfolio.test.ts src/desktop/portfolio-source-inspector.ts src/desktop/portfolio-source-inspector.test.ts
git commit -m "refactor: remove remote portfolio inspection"
```

### Task 2: Make the portfolio import UI local-only and select uploads by default

**Files:**
- Modify: `src/app/studio/DesignerLibrary.tsx:220-505, 830-930, 1230-1290`
- Modify: `src/app/studio/DesignerLibrary.test.tsx`
- Modify: `tests/e2e/test-workspace.ts:46`

- [ ] **Step 1: Update renderer tests to describe local-only import**

Replace remote-origin fixtures with `local-image` or `zip-image` and drive inspection through `Choose images` or `Choose ZIP`. Add assertions immediately after inspection:

```ts
expect(screen.queryByRole('textbox', { name: 'Portfolio URL' })).not.toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Inspect page' })).not.toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Inspect image' })).not.toBeInTheDocument();
expect(screen.getByRole('checkbox', { name: longFilename })).toBeChecked();
expect(screen.getByText(longFilename)).toHaveAttribute('title', longFilename);
```

Retain one submission test that deselects one of two automatically selected candidates and expects only the remaining candidate ID in `submitPortfolioSelection`. Add a cancellation regression: after an initial inspection, make the next call return `null`, click the other local source action, and assert the original checked candidate remains visible.

- [ ] **Step 2: Run the focused renderer tests and confirm failures**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: FAIL because the URL controls still render, candidates start unchecked, cancelled inspection is treated as an error, and the filename has no title.

- [ ] **Step 3: Remove URL state and remote renderer branches**

Delete `portfolioUrl`, its setter, `onPortfolioUrlChange`, related props, the `Field`/textarea, and both remote buttons. Keep only:

```tsx
<Button type="button" variant="secondary" onClick={() => onInspectPortfolioSources({ kind: "local-images" })}>
  {t(locale, "选择图片", "Choose images")}
</Button>
<Button type="button" variant="secondary" onClick={() => onInspectPortfolioSources({ kind: "local-zip" })}>
  {t(locale, "选择 ZIP", "Choose ZIP")}
</Button>
```

Remove the unused `Field` import only if no other part of `DesignerLibrary.tsx` uses it.

- [ ] **Step 4: Preserve cancellation and select successful inspection candidates**

Change the inspection result handling to treat `null` as picker cancellation and to select all successful candidates:

```ts
const next = await getDesktopApi().inspectPortfolioSources?.({ workspaceId, request });
if (!next) return;
if (portfolioInspection) {
  void getDesktopApi().discardPortfolioInspection?.({ workspaceId, inspectionId: portfolioInspection.id });
}
setPortfolioInspection(next);
setSelectedPortfolioSourceIds(next.candidates.map((candidate) => candidate.id));
```

Keep actual thrown failures in the catch path, but make the message local-only:

```ts
t(locale, "作品集文件无法检查，请选择有效图片或 ZIP 文件。", "Portfolio files could not be inspected. Choose valid images or a ZIP file.")
```

- [ ] **Step 5: Mark filename text for truncation and full-name discovery**

Render the label as:

```tsx
<span className="designer-portfolio-candidate__name" title={candidate.label}>
  {candidate.label}
</span>
```

Update `tests/e2e/test-workspace.ts` to return `origin: 'local-image'` so browser fixtures satisfy the narrowed contract.

- [ ] **Step 6: Run renderer tests and typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
pnpm typecheck
```

Expected: PASS with all portfolio candidates initially checked and no remote source strings left in renderer code or fixtures.

- [ ] **Step 7: Commit the local-only interaction**

```bash
git add src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx tests/e2e/test-workspace.ts
git commit -m "feat: default local portfolio files to selected"
```

### Task 3: Reduce drawer width and verify narrow layouts

**Files:**
- Modify: `src/app/studio/library.css:364-490, 520-930`
- Modify: `tests/e2e/designer-drawer.spec.ts`

- [ ] **Step 1: Update the browser test for local import and 560-pixel width**

Set `expectedWidth` to:

```ts
const expectedWidth = Math.min(560, viewport.width * 0.92, hostBox!.width);
```

Remove URL/page assertions and inspect by clicking `选择图片`. Assert the candidate checkbox is already checked. Use a deliberately long fixture filename and verify the rendered name has `scrollWidth > clientWidth`, stays inside its candidate row, and carries the full value in `title`.

After entering analysis, assert `.portfolio-analysis-report__grid` has one computed grid column. Retain the current stable-width, no-document-overflow, step-3 transition, loading animation, and screenshot assertions.

- [ ] **Step 2: Run the focused browser test and confirm layout failures**

Start or reuse the preview server:

```bash
pnpm exec vite --host 127.0.0.1 --port 4173
```

Then run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: FAIL because the drawer is still 840 pixels, desktop analysis still has three columns, and filenames do not truncate.

- [ ] **Step 3: Apply the compact drawer and filename styles**

Use the exact drawer width and overflow rules:

```css
.ui-drawer.ui-drawer--portfolio {
  inline-size: min(560px, 92vw);
}

.designer-portfolio-candidates,
.portfolio-analysis-report__grid,
.portfolio-analysis-report__identity,
.portfolio-analysis-values {
  grid-template-columns: minmax(0, 1fr);
}

.designer-portfolio-candidate__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Keep the two local source buttons in a two-column action grid. Adapt the analysis and artwork skeleton grids to one or two compact tracks only where their current three-column layout clips at 560 pixels. Do not change global drawer widths.

- [ ] **Step 4: Run the focused browser test**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: both 1280x800 and 720x720 cases PASS with stable width, no horizontal overflow, filename ellipsis, and visible artwork-generation loading state.

- [ ] **Step 5: Run the full verification suite**

Run:

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
git diff --check
rg -n "remote-page|remote-image|page-image|inspectRemotePage|inspectRemoteImage|portfolioUrl" src tests
```

Expected: tests, typecheck, lint, build, and diff check PASS; the final search returns no matches.

- [ ] **Step 6: Commit the compact drawer and browser coverage**

```bash
git add src/app/studio/library.css tests/e2e/designer-drawer.spec.ts
git commit -m "fix: compact the portfolio designer drawer"
```

### Task 4: Final review and cleanup

**Files:**
- Review: all files changed by Tasks 1-3

- [ ] **Step 1: Inspect the final change set**

Run:

```bash
git status --short
git diff HEAD~3 --stat
git log -4 --oneline
```

Expected: the work is represented by three implementation commits after the plan commit, with no unrelated files.

- [ ] **Step 2: Check the implemented UI at both tested viewports**

Review the Playwright screenshots for import, analysis, and artwork loading. Confirm the drawer is compact, candidate controls do not overlap, filenames truncate, the report reads in one column, and the footer remains reachable.

- [ ] **Step 3: Record verification evidence**

Summarize the exact passing unit-test count, focused Playwright count, typecheck/lint/build result, commit hashes, and preview URL in the completion response. Do not claim completion if any required command is failing.
