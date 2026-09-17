# Portfolio Wizard Upload And Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a 520-pixel portfolio wizard with one click/drop/paste uploader, retained import and analysis state, sequential back navigation, and one automatically selected, regenerable Avatar.

**Architecture:** Replace the two picker request kinds with a small discriminated union for native selection and bounded renderer-supplied files. Route both through shared source-inspector validation, keep one temporary inspection alive until replacement or drawer close, and represent generated artwork as one optional value instead of a candidate array. Extract the upload interaction into a focused renderer component while keeping wizard orchestration in `DesignerLibrary`.

**Tech Stack:** React 19, TypeScript, Electron IPC, Vitest and Testing Library, Playwright, CSS.

---

## File Map

- Modify `src/platform/contracts.ts`: define the unified picker/upload request and byte-file record.
- Modify `src/desktop/portfolio-source-inspector.ts`: classify native and uploaded batches and inspect both through shared image/ZIP safeguards.
- Modify `src/desktop/portfolio-source-inspector.test.ts`: cover unified images, ZIPs, mixing, counts, and uploaded bytes.
- Modify `src/desktop/ipc/portfolio.ts`: validate bounded renderer uploads and route picker/upload requests.
- Modify `src/desktop/ipc/portfolio.test.ts`: cover trusted unified requests and malformed byte payloads.
- Modify `src/desktop/main.ts`: open one combined portfolio file picker.
- Create `src/app/studio/PortfolioUploader.tsx`: own click, drag, paste, keyboard, and renderer-side batch validation.
- Create `src/app/studio/PortfolioUploader.test.tsx`: test uploader events and non-destructive validation failures.
- Modify `src/app/studio/DesignerLibrary.tsx`: preserve one inspection, implement sequential navigation, and model one Avatar.
- Modify `src/app/studio/DesignerLibrary.test.tsx`: update picker expectations and add state/navigation/Avatar regression coverage.
- Modify `src/app/studio/library.css`: narrow the drawer and style the uploader and single Avatar.
- Modify `tests/e2e/designer-drawer.spec.ts`: verify the complete workflow, width, state retention, and regeneration at desktop and narrow viewports.

### Task 1: Unify Local Portfolio Inspection

**Files:**
- Modify: `src/platform/contracts.ts:19-34`
- Modify: `src/desktop/portfolio-source-inspector.ts:10-181`
- Test: `src/desktop/portfolio-source-inspector.test.ts`

- [ ] **Step 1: Write failing inspector tests**

Add tests that describe the two supported entry paths and the shared batch rules:

```ts
it('inspects a unified native image batch', async () => {
  const inspector = createPortfolioSourceInspector({ readFile: async () => png });
  const inspection = await inspector.inspectLocalFiles(['/chosen/cover.png', '/chosen/detail.png']);
  expect(inspection.candidates.map(({ label }) => label)).toEqual(['cover.png', 'detail.png']);
});

it('inspects uploaded image bytes without accepting renderer paths', async () => {
  const inspector = createPortfolioSourceInspector();
  const inspection = await inspector.inspectUploadedFiles([
    { name: 'pasted.png', mimeType: 'image/png', bytes: png },
  ]);
  expect(inspection.candidates).toMatchObject([{ label: 'pasted.png', origin: 'local-image' }]);
});

it('rejects mixed ZIP and image uploads as one batch', async () => {
  const inspector = createPortfolioSourceInspector();
  await expect(inspector.inspectUploadedFiles([
    { name: 'references.zip', mimeType: 'application/zip', bytes: zipSync({ 'cover.png': png }) },
    { name: 'detail.png', mimeType: 'image/png', bytes: png },
  ])).rejects.toThrow('PORTFOLIO_SOURCE_MIXED');
});

it('counts extracted ZIP images against the eight-source limit', async () => {
  const inspector = createPortfolioSourceInspector();
  await expect(inspector.inspectUploadedFiles([{
    name: 'references.zip',
    mimeType: 'application/zip',
    bytes: zipSync(Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`sheet-${index}.png`, png]))),
  }])).rejects.toThrow('PORTFOLIO_SOURCE_LIMIT');
});
```

Update existing tests to call `inspectLocalFiles` instead of `inspectLocalImages`/`inspectZip` where appropriate.

- [ ] **Step 2: Run the tests and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/desktop/portfolio-source-inspector.test.ts
```

Expected: FAIL because `inspectLocalFiles` and `inspectUploadedFiles` do not exist.

- [ ] **Step 3: Define the unified request contract**

Replace the current request union in `src/platform/contracts.ts` with:

```ts
export type PortfolioUploadFile = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type PortfolioInspectionRequest =
  | { kind: 'local-files' }
  | { kind: 'uploaded-files'; files: PortfolioUploadFile[] };
```

Keep `PortfolioInspectionCandidate.origin` as `local-image | zip-image`.

- [ ] **Step 4: Implement shared image and ZIP inspection**

Change `PortfolioSourceInspector` to expose:

```ts
export type PortfolioSourceInspector = {
  inspectLocalFiles: (paths: readonly string[]) => Promise<PortfolioInspection>;
  inspectUploadedFiles: (files: readonly PortfolioUploadFile[]) => Promise<PortfolioInspection>;
  selectedSources: (inspectionId: string, sourceIds: readonly string[]) => Promise<PortfolioImageSource[]>;
  discard: (inspectionId: string) => void;
  discardAll: () => void;
};
```

Refactor the existing logic into shared internal functions with these rules:

```ts
const isZipName = (name: string): boolean => name.toLowerCase().endsWith('.zip');

const assertBatchShape = (names: readonly string[]): 'images' | 'zip' => {
  if (names.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
  const zipCount = names.filter(isZipName).length;
  if (zipCount > 1) throw new Error('PORTFOLIO_ARCHIVE_LIMIT');
  if (zipCount === 1 && names.length !== 1) throw new Error('PORTFOLIO_SOURCE_MIXED');
  if (zipCount === 0 && names.length > maxPortfolioSources) throw new Error('PORTFOLIO_SOURCE_LIMIT');
  return zipCount === 1 ? 'zip' : 'images';
};
```

`inspectLocalFiles` reads native paths only after classification. `inspectUploadedFiles` consumes only the supplied `name`, `mimeType`, and `bytes`, verifies declared image MIME against the extension, applies existing per-file/archive size limits, and then calls the same image or archive implementation. Keep signature checks, normalization, ZIP path checks, entry limits, and temporary session storage unchanged.

- [ ] **Step 5: Run inspector tests and confirm GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/desktop/portfolio-source-inspector.test.ts
```

Expected: all inspector tests pass.

- [ ] **Step 6: Commit the inspection contract**

```bash
git add src/platform/contracts.ts src/desktop/portfolio-source-inspector.ts src/desktop/portfolio-source-inspector.test.ts
git commit -m "refactor: unify local portfolio inspection"
```

### Task 2: Secure The Unified IPC Boundary

**Files:**
- Modify: `src/desktop/ipc/portfolio.ts:1-74`
- Modify: `src/desktop/ipc/portfolio.test.ts`
- Modify: `src/desktop/main.ts:450-461`

- [ ] **Step 1: Write failing IPC tests**

Replace the two-kind picker test and add uploaded-byte validation:

```ts
it('routes the unified native picker and trusted uploaded bytes', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const chooseFiles = vi.fn(async () => ['/tmp/cover.png']);
  const inspectLocalFiles = vi.fn(async () => ({ id: 'inspection-native', candidates: [] }));
  const inspectUploadedFiles = vi.fn(async () => ({ id: 'inspection-upload', candidates: [] }));
  const inspect = createPortfolioInspectionHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => ({ workspace: { workspaceId: 'workspace-1' } }) as never,
    chooseFiles,
    { inspectLocalFiles, inspectUploadedFiles, selectedSources: vi.fn(), discard: vi.fn(), discardAll: vi.fn() },
  );

  await expect(inspect(fixture.event, {
    workspaceId: 'workspace-1', request: { kind: 'local-files' },
  })).resolves.toMatchObject({ id: 'inspection-native' });
  await expect(inspect(fixture.event, {
    workspaceId: 'workspace-1',
    request: { kind: 'uploaded-files', files: [{ name: 'pasted.png', mimeType: 'image/png', bytes: png }] },
  })).resolves.toMatchObject({ id: 'inspection-upload' });
  expect(chooseFiles).toHaveBeenCalledTimes(1);
  expect(inspectUploadedFiles).toHaveBeenCalledWith([{ name: 'pasted.png', mimeType: 'image/png', bytes: png }]);
});

it('rejects malformed or oversized renderer file payloads', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const inspectUploadedFiles = vi.fn();
  const inspect = createPortfolioInspectionHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => ({ workspace: { workspaceId: 'workspace-1' } }) as never,
    vi.fn(),
    { inspectLocalFiles: vi.fn(), inspectUploadedFiles, selectedSources: vi.fn(), discard: vi.fn(), discardAll: vi.fn() },
  );
  const image = (name: string, bytes: Uint8Array | undefined = png) => ({ name, mimeType: 'image/png', ...(bytes ? { bytes } : {}) });
  const invalidRequests = [
    { kind: 'uploaded-files', files: [{ name: 'missing.png', mimeType: 'image/png' }] },
    { kind: 'uploaded-files', files: Array.from({ length: 9 }, (_, index) => image(`sheet-${index}.png`)) },
    { kind: 'uploaded-files', files: [image('../outside.png')] },
    { kind: 'uploaded-files', files: [image('large.png', new Uint8Array(8 * 1024 * 1024 + 1))] },
  ];
  for (const request of invalidRequests) {
    await expect(inspect(fixture.event, { workspaceId: 'workspace-1', request })).resolves.toBeNull();
  }
  expect(inspectUploadedFiles).not.toHaveBeenCalled();
});
```

Use the existing one-pixel `png` byte fixture in this test file and update all inspector stubs to the new method names.

- [ ] **Step 2: Run the IPC tests and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/desktop/ipc/portfolio.test.ts
```

Expected: FAIL because the handler still recognizes `local-images`/`local-zip` and the inspector stub shape changed.

- [ ] **Step 3: Validate and route the new union**

Make `FileChooser` parameterless and validate renderer files before invoking the inspector. The guard must require a basename-only filename, a bounded MIME string, `Uint8Array` bytes, and the same coarse count/size constraints used by the inspector:

```ts
type FileChooser = () => Promise<string[] | null>;

const isUploadFile = (value: unknown): value is PortfolioUploadFile => {
  if (!value || typeof value !== 'object') return false;
  const file = value as Record<string, unknown>;
  return isNonEmpty(file.name, 512)
    && !/[\\/\u0000-\u001F]/u.test(file.name as string)
    && typeof file.mimeType === 'string'
    && file.mimeType.length <= 128
    && file.bytes instanceof Uint8Array;
};
```

For `{ kind: 'local-files' }`, call the chooser and `inspector.inspectLocalFiles(paths)`. For `{ kind: 'uploaded-files' }`, never call the chooser and pass the validated records to `inspector.inspectUploadedFiles(files)`. Continue rejecting remote kinds, extra URL fields, untrusted senders, mismatched workspaces, and read-only selection submission.

- [ ] **Step 4: Use one combined native picker**

Update the main-process dialog to use `['openFile', 'multiSelections']` and one filter:

```ts
filters: [{
  name: 'Portfolio images or ZIP',
  extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'zip'],
}],
```

The inspector, not the picker, remains authoritative for mixed or over-limit selections.

- [ ] **Step 5: Run IPC and inspector tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/desktop/ipc/portfolio.test.ts src/desktop/portfolio-source-inspector.test.ts
```

Expected: both files pass.

- [ ] **Step 6: Commit the bridge changes**

```bash
git add src/desktop/ipc/portfolio.ts src/desktop/ipc/portfolio.test.ts src/desktop/main.ts
git commit -m "feat: accept pasted portfolio files securely"
```

### Task 3: Build The Upload Component And Preserve Import State

**Files:**
- Create: `src/app/studio/PortfolioUploader.tsx`
- Create: `src/app/studio/PortfolioUploader.test.tsx`
- Modify: `src/app/studio/DesignerLibrary.tsx:220-505,820-975,1216-1276`
- Modify: `src/app/studio/DesignerLibrary.test.tsx:43-265`

- [ ] **Step 1: Write failing uploader interaction tests**

Create focused tests for click, paste/drop, and whole-batch rejection:

```tsx
it('opens the unified native picker when clicked', () => {
  const onInspect = vi.fn();
  render(<PortfolioUploader locale="en" busy={false} onInspect={onInspect} onError={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Upload portfolio files' }));
  expect(onInspect).toHaveBeenCalledWith({ kind: 'local-files' });
});

it('reads pasted files into an uploaded-files request', async () => {
  const onInspect = vi.fn();
  const file = {
    name: 'pasted.png', type: 'image/png', size: 4,
    arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
  } as File;
  render(<PortfolioUploader locale="en" busy={false} onInspect={onInspect} onError={vi.fn()} />);
  fireEvent.paste(screen.getByRole('button', { name: 'Upload portfolio files' }), { clipboardData: { files: [file] } });
  await waitFor(() => expect(onInspect).toHaveBeenCalledWith({
    kind: 'uploaded-files',
    files: [{ name: 'pasted.png', mimeType: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]) }],
  }));
});

it('rejects nine dropped images without replacing the current upload', async () => {
  const onInspect = vi.fn();
  const onError = vi.fn();
  render(<PortfolioUploader locale="en" busy={false} onInspect={onInspect} onError={onError} />);
  fireEvent.drop(screen.getByRole('button', { name: 'Upload portfolio files' }), {
    dataTransfer: { files: Array.from({ length: 9 }, (_, index) => imageFile(`sheet-${index}.png`)) },
  });
  await waitFor(() => expect(onError).toHaveBeenCalledWith('Upload at most 8 images.'));
  expect(onInspect).not.toHaveBeenCalled();
});
```

Add named tests `rejects a mixed image and ZIP batch`, `rejects multiple ZIP archives`, `rejects unsupported file extensions`, and `rejects files over their byte limit`; each passes a concrete `File` double to `validatePortfolioUpload` and asserts its exact localized error key without calling `onInspect`.

- [ ] **Step 2: Write failing retained-state tests in `DesignerLibrary.test.tsx`**

Update existing button queries to the unified accessible name, expect `{ kind: 'local-files' }`, and add:

```tsx
it('keeps files, rights, and source selection when returning from analysis', async () => {
  const candidate = { ...personaProfiles[0]!, id: 'retained-analysis' };
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: 'inspection-retained',
      candidates: [
        { id: 'cover', label: 'Cover', description: 'Cover', origin: 'local-image' as const, previewUrl: '' },
        { id: 'detail', label: 'Detail', description: 'Detail', origin: 'local-image' as const, previewUrl: '' },
      ],
    })),
    submitPortfolioSelection: vi.fn(async () => ({
      id: 'task-retained', requestId: 'request-retained', state: 'completed' as const,
      cancelRequested: false, attempt: 1, result: { text: JSON.stringify({ candidates: [candidate] }) },
    })),
  };
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-retained" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create from portfolio' }));
  fireEvent.click(screen.getByRole('button', { name: 'Upload portfolio files' }));
  await screen.findByText('Cover');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Detail' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Start analysis' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Back to import' }));
  expect(screen.getByRole('checkbox', { name: 'Cover' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Detail' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: /I confirm/ })).toBeChecked();
});
```

- [ ] **Step 3: Run renderer tests and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/PortfolioUploader.test.tsx src/app/studio/DesignerLibrary.test.tsx
```

Expected: FAIL because the uploader does not exist, old buttons remain, and analysis clears inspection state.

- [ ] **Step 4: Implement `PortfolioUploader`**

Build a single `<button type="button">` drop target using the existing `Icon` component:

```tsx
export const PortfolioUploader = ({ locale, busy, onInspect, onError }: Props) => {
  const [dragging, setDragging] = useState(false);
  const inspectFiles = async (files: readonly File[]) => {
    try {
      const error = validatePortfolioUpload(files);
      if (error) { onError(t(locale, error.zh, error.en)); return; }
      await onInspect({
        kind: 'uploaded-files',
        files: await Promise.all(files.map(async (file) => ({
          name: file.name,
          mimeType: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        }))),
      });
    } catch {
      onError(t(locale, '无法读取所选文件。', 'The selected files could not be read.'));
    }
  };

  return <button
    type="button"
    className={`portfolio-uploader${dragging ? ' is-dragging' : ''}`}
    aria-label={t(locale, '上传作品集文件', 'Upload portfolio files')}
    disabled={busy}
    onClick={() => { void onInspect({ kind: 'local-files' }); }}
    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => { event.preventDefault(); setDragging(false); void inspectFiles([...event.dataTransfer.files]); }}
    onPaste={(event) => { if (event.clipboardData.files.length) { event.preventDefault(); void inspectFiles([...event.clipboardData.files]); } }}
  >
    <Icon name="upload" size={20} />
    <strong>{t(locale, '点击、拖入或粘贴文件', 'Click, drop, or paste files')}</strong>
    <small>{t(locale, '最多 8 张图片，或 1 个 ZIP', 'Up to 8 images, or 1 ZIP')}</small>
  </button>;
};
```

Keep validation exported for direct tests. Accept PNG/JPEG/WebP/GIF or one ZIP, reject mixed ZIP/images and multiple ZIPs, enforce 8 MiB per image and 24 MiB per ZIP before reading bytes, and catch `arrayBuffer()` failures with a localized read error.

- [ ] **Step 5: Keep one inspection alive through analysis**

In `DesignerLibrary`:

- remove `PortfolioSelectionBatch` and `selectionBatches`;
- require the current `portfolioInspection` plus at least one selected ID;
- submit exactly one `selections` entry;
- stop clearing `portfolioInspection` and `selectedPortfolioSourceIds` after task acceptance;
- calculate `selectionCount` from `selectedPortfolioSourceIds.length`;
- let source toggling add/remove IDs within the current inspection;
- on successful replacement, discard the prior inspection only after the new one exists;
- make `inspectPortfolioSources` return `Promise<void>` and expose an error setter to `PortfolioUploader`;
- replace `.portfolio-source-actions` with `<PortfolioUploader>` while retaining the candidate list and rights checkbox.

Use one cleanup callback:

```ts
const discardPortfolioInspection = useCallback(() => {
  if (workspaceId && portfolioInspection) {
    void getDesktopApi().discardPortfolioInspection?.({ workspaceId, inspectionId: portfolioInspection.id });
  }
  setPortfolioInspection(null);
  setSelectedPortfolioSourceIds([]);
}, [portfolioInspection, workspaceId]);
```

- [ ] **Step 6: Run renderer tests and confirm GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/PortfolioUploader.test.tsx src/app/studio/DesignerLibrary.test.tsx
```

Expected: uploader and retained-import tests pass after updating old picker expectations.

- [ ] **Step 7: Commit the uploader and retained state**

```bash
git add src/app/studio/PortfolioUploader.tsx src/app/studio/PortfolioUploader.test.tsx src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx
git commit -m "feat: add retained portfolio file uploader"
```

### Task 4: Enforce Sequential Navigation And One Avatar

**Files:**
- Modify: `src/app/studio/DesignerLibrary.tsx:220-232,420-690,820-975,1216-1300`
- Modify: `src/app/studio/DesignerLibrary.test.tsx:267-735`

- [ ] **Step 1: Write failing navigation and Avatar tests**

Extend the completed workflow fixture so image generation completes with one asset and assert:

```tsx
await waitFor(() => expect(submitDesignerArtworkGeneration).toHaveBeenCalledWith(
  expect.objectContaining({ count: 1 }),
));
expect(screen.getByRole('img', { name: 'Generated designer Avatar' })).toBeInTheDocument();
expect(screen.queryByRole('group', { name: 'Artwork options' })).not.toBeInTheDocument();

fireEvent.click(screen.getByRole('button', { name: 'Back to analysis' }));
expect(screen.getByRole('region', { name: /visual DNA analysis/ })).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Next: generate artwork' }));
expect(screen.getByRole('img', { name: 'Generated designer Avatar' })).toBeInTheDocument();
expect(submitDesignerArtworkGeneration).toHaveBeenCalledTimes(1);

fireEvent.click(screen.getByRole('button', { name: 'Next: preview and publish' }));
fireEvent.click(screen.getByRole('button', { name: 'Back to Avatar' }));
expect(screen.getByRole('img', { name: 'Generated designer Avatar' })).toBeInTheDocument();
```

Add a regeneration test whose first request returns `artwork-1` and second returns `artwork-2`. Assert the first image remains selected after a rejected regeneration and is replaced only after a successful retry.

Update the long-poll test to expect one loading placeholder, `count: 1`, and the generated Avatar image instead of clicking "Artwork 1".

- [ ] **Step 2: Run the focused renderer tests and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: FAIL on `count: 1`, sequential back behavior, automatic selection, and regeneration.

- [ ] **Step 3: Replace candidate artwork state with one optional Avatar**

Replace:

```ts
const [artworkOptions, setArtworkOptions] = useState<ArtworkOption[]>([]);
const [selectedArtworkAssetId, setSelectedArtworkAssetId] = useState<string>();
```

with:

```ts
const [artwork, setArtwork] = useState<ArtworkOption>();
```

Rename `readArtworkOptions` to `readArtwork`. It reads only the first returned asset ID, calls `readDesignerArtwork` once, and assigns the new `ArtworkOption` only after the read succeeds. Publishing uses `artwork.assetId` and `artwork.artworkUrl` directly.

Do not clear `artwork` when generation starts or fails. Clear it when a newly completed portfolio analysis is accepted, because that visual DNA supersedes the old Avatar.

- [ ] **Step 4: Generate and regenerate exactly one image**

Send `count: 1`. Keep the phase on `avatar` while submitting and polling. A successful result replaces `artwork`; failure leaves the prior value intact and exposes the existing error.

Use a continuation that avoids unnecessary regeneration after navigating back:

```ts
const continueToAvatar = () => {
  if (artwork) {
    setCreationError('');
    setWizardPhase('avatar');
    return;
  }
  void requestCandidateArtwork();
};
```

- [ ] **Step 5: Give each back action its correct phase**

Pass distinct callbacks into `DesignerEditorModal`:

```tsx
onBackToImport={() => setWizardPhase('import')}
onBackToAnalysis={() => setWizardPhase('analyse')}
onBackToAvatar={() => setWizardPhase('avatar')}
```

The Avatar footer contains Back to analysis, Regenerate with the existing `rotate-ccw` icon, and Next. Disable all generation-dependent actions while busy. Change the existing Reanalyse button to the same `rotate-ccw` icon because `public/icons/refresh-cw.svg` does not exist. The review footer contains Back to Avatar and Publish. Render one `.portfolio-avatar-preview` with a single meaningful image instead of `.persona-candidate-grid`.

Change loading copy to "正在根据视觉 DNA 生成设计师形象。" / "Generating a designer Avatar from the visual DNA." and render one skeleton item.

- [ ] **Step 6: Run renderer tests and confirm GREEN**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: all designer-library tests pass.

- [ ] **Step 7: Commit navigation and Avatar behavior**

```bash
git add src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx
git commit -m "fix: preserve portfolio wizard progress"
```

### Task 5: Finish The Visual Layout And Browser Workflow

**Files:**
- Modify: `src/app/studio/library.css:372-500,840-930`
- Modify: `tests/e2e/designer-drawer.spec.ts`

- [ ] **Step 1: Update browser assertions before CSS and workflow changes**

Change the expected desktop maximum from 560 to 520 and make the mock API record unified upload and artwork calls. Extend the flow to assert:

```ts
const expectedWidth = Math.min(520, viewport.width * 0.92, hostBox!.width);
const uploader = drawer.getByRole('button', { name: '上传作品集文件' });
await expect(uploader).toBeVisible();
await expect(drawer.getByRole('button', { name: '选择图片' })).toHaveCount(0);
await expect(drawer.getByRole('button', { name: '选择 ZIP' })).toHaveCount(0);

await uploader.click();
await expect(page.getByRole('checkbox', { name: longFilename })).toBeChecked();
await page.getByRole('checkbox', { name: '我确认拥有分析这些来源的权利' }).check();
await page.getByRole('button', { name: '开始分析' }).click();
await expect(drawer.getByRole('region', { name: '纸间秩序的视觉 DNA 分析' })).toBeVisible();
await drawer.getByRole('button', { name: '返回导入' }).click();
await expect(page.getByRole('checkbox', { name: longFilename })).toBeChecked();
await expect(page.getByRole('checkbox', { name: '我确认拥有分析这些来源的权利' })).toBeChecked();
await page.getByRole('button', { name: '开始分析' }).click();
await drawer.getByRole('button', { name: '下一步：生成形象' }).click();
await expect(drawer.getByRole('img', { name: '生成的设计师 Avatar' })).toBeVisible();
await drawer.getByRole('button', { name: '返回分析' }).click();
await drawer.getByRole('button', { name: '下一步：生成形象' }).click();
await expect.poll(() => page.evaluate(() => (window as typeof window & { artworkRequests: number }).artworkRequests)).toBe(1);
await drawer.getByRole('button', { name: '下一步：预览发布' }).click();
await drawer.getByRole('button', { name: '返回形象' }).click();
await drawer.getByRole('button', { name: '重新生成' }).click();
await expect(drawer.getByRole('img', { name: '生成的设计师 Avatar' })).toHaveAttribute('src', 'designhub-artwork://artwork-e2e-2');
```

Keep the existing filename truncation, progress colour/ratio, stable-width, scroll reset, no-overflow, and screenshot assertions.

- [ ] **Step 2: Build and run the E2E test to confirm RED**

Run:

```bash
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: FAIL on the 520-pixel width and new uploader/Avatar behavior.

- [ ] **Step 3: Implement restrained uploader and Avatar styling**

Set:

```css
.ui-drawer.ui-drawer--portfolio {
  inline-size: min(520px, 92vw);
}
```

Replace `.portfolio-source-actions` with `.portfolio-uploader`: full available width, stable minimum height around 104 pixels, dashed subtle border, transparent/low surface background, centered upload icon and concise two-line copy, `cursor: pointer`, cyan focus-visible outline, and a restrained primary-tinted `.is-dragging` state. Do not introduce a nested card or oversized rounded treatment.

Add `.portfolio-avatar-preview` as a centered unframed figure with one square image constrained by `width: min(100%, 320px)`, `aspect-ratio: 1`, `object-fit: cover`, a 6-pixel radius, and the existing subtle border. Change `.portfolio-artwork-skeleton` to one centered square track with the same size constraint.

At narrow widths keep the 92vw drawer, two-row step indicator, stable footer wrapping, filename ellipsis, and no horizontal overflow.

- [ ] **Step 4: Rebuild, run E2E, and inspect screenshots**

Run:

```bash
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: both 1280x800 and 720x720 cases pass. Inspect generated import, analysis, Avatar, regeneration/loading, and review screenshots for clipping, overlap, accidental resizing, and visual hierarchy.

- [ ] **Step 5: Commit the finished UI**

```bash
git add src/app/studio/library.css tests/e2e/designer-drawer.spec.ts
git commit -m "style: refine portfolio designer workflow"
```

### Task 6: Full Verification

**Files:**
- Verify only; modify implementation or tests only if a command exposes a regression.

- [ ] **Step 1: Run all unit tests**

```bash
pnpm test:unit
```

Expected: all unit tests pass.

- [ ] **Step 2: Run typecheck and lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: both commands exit successfully with no errors or warnings.

- [ ] **Step 3: Run the production build and focused browser suite**

```bash
pnpm build
pnpm exec playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: all three Vite builds and both viewport cases pass.

- [ ] **Step 4: Check the final diff and repository state**

```bash
git diff --check
git status --short --branch
git log -6 --oneline
```

Expected: no whitespace errors and no uncommitted implementation files. The existing unrelated stale `.empty-state` assertion in `tests/integration/layout-contract.test.ts` remains outside this plan unless separately authorized.
