# Project Cover Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users choose a local cover image while creating a project, persist it as a managed project asset, and use the supplied built-in image whenever no usable custom cover exists.

**Architecture:** Add an optional `coverAssetId` to project metadata and keep pre-creation image bytes only in the renderer draft. The new-project form owns file validation and preview selection; the Studio creation workflow creates the project, imports the selected cover through the existing asset API, and then records the asset ID. A focused project-cover image component reads managed cover bytes and falls back to a bundled static PNG.

**Tech Stack:** React 19, TypeScript, Electron IPC, existing project/asset stores, Vitest, Testing Library, Playwright, CSS.

---

Implementation stays on `main` as requested. The existing dirty working tree contains earlier canvas and multimodal changes; every commit below must stage only the named files or exact hunks.

## File Structure

- Create `public/project-default-cover.png`: exact user-supplied fallback artwork.
- Create `src/app/studio/project-cover.ts`: cover constants, types, file validation, and byte reading.
- Create `src/app/studio/project-cover.test.ts`: validation and file-reading tests.
- Create `src/app/studio/ProjectCoverPicker.tsx`: accessible new-project cover selector and preview.
- Create `src/app/studio/ProjectCoverPicker.test.tsx`: picker interaction and error tests.
- Create `src/app/studio/ProjectCoverImage.tsx`: managed-asset reader with default fallback.
- Create `src/app/studio/ProjectCoverImage.test.tsx`: loading, cleanup, and fallback tests.
- Modify `src/features/projects/metadata.ts`: persist optional `coverAssetId`.
- Modify `src/features/projects/metadata.test.ts`: metadata compatibility and immutability coverage.
- Modify `src/features/workspace/project-store.ts`: expose cover metadata across store contracts.
- Modify `src/desktop/storage/project-store.ts`: retain cover attribution during create, duplicate, import, and update.
- Modify `src/desktop/ipc/projects.ts`: allow `coverAssetId` metadata patches.
- Modify `src/desktop/storage/project-store.test.ts`: storage round-trip and duplicate coverage.
- Modify `tests/integration/project-store.test.ts`: restart and package round-trip coverage.
- Modify `src/app/studio/types.ts`: add draft selection and project cover fields.
- Modify `src/app/studio/NewDesignPage.tsx`: render the cover picker before the project name.
- Modify `src/app/studio/NewDesignPage.test.tsx`: form integration coverage.
- Modify `src/app/studio/Studio.tsx`: import and persist selected covers and render card covers.
- Modify `src/app/Studio.test.tsx`: creation orchestration, draft lifecycle, and card behavior.
- Modify `src/app/studio/LibraryPages.tsx`: hide internal project-cover assets.
- Modify `src/app/studio/LibraryPages.test.tsx`: internal asset filtering coverage.
- Modify `src/app/studio/persona.css`: new-project picker styling.
- Modify `src/app/styles/studio.css`: project-card cover image styling.
- Modify `tests/e2e/studio.spec.ts`: complete cover selection flow.

### Task 1: Add the Default Asset and Cover File Contract

**Files:**
- Create: `public/project-default-cover.png`
- Create: `src/app/studio/project-cover.ts`
- Create: `src/app/studio/project-cover.test.ts`
- Modify: `src/app/studio/types.ts`

- [ ] **Step 1: Write the failing cover contract tests**

Create tests that specify the accepted types, 20 MB limit, empty-file rejection, byte preservation, and stable fallback URL:

```ts
import { expect, it } from 'vitest';

import {
  defaultProjectCoverUrl,
  maxProjectCoverBytes,
  readProjectCoverFile,
  validateProjectCoverFile,
} from './project-cover';

it('accepts supported raster covers and preserves their bytes', async () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'cover.webp', { type: 'image/webp' });
  expect(validateProjectCoverFile(file)).toBeNull();
  await expect(readProjectCoverFile(file)).resolves.toEqual({
    name: 'cover.webp',
    mimeType: 'image/webp',
    bytes: new Uint8Array([1, 2, 3]),
  });
});

it('rejects empty, unsupported, and oversized covers', () => {
  expect(validateProjectCoverFile(new File([], 'empty.png', { type: 'image/png' }))).toBe('EMPTY_FILE');
  expect(validateProjectCoverFile(new File(['svg'], 'cover.svg', { type: 'image/svg+xml' }))).toBe('UNSUPPORTED_TYPE');
  const oversized = new File([new Uint8Array(maxProjectCoverBytes + 1)], 'large.png', { type: 'image/png' });
  expect(validateProjectCoverFile(oversized)).toBe('FILE_TOO_LARGE');
});

it('uses the bundled project cover as the stable fallback', () => {
  expect(defaultProjectCoverUrl).toBe('/project-default-cover.png');
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
pnpm exec vitest run src/app/studio/project-cover.test.ts
```

Expected: FAIL because `project-cover.ts` does not exist.

- [ ] **Step 3: Add the exact default PNG**

Copy the user-provided file without recompression:

```bash
cp /var/folders/yr/bqszq38n05b4y6g9m44krsgw0000gn/T/codex-clipboard-51bbecfe-49e4-466d-9a2f-d55f2c68fef3.png public/project-default-cover.png
shasum -a 256 public/project-default-cover.png
```

Expected hash:

```text
23590ffb9995775d8e3eb6cfb6a22f0beeb95b7bf0561fe2829e4aafd5bb3cf8
```

- [ ] **Step 4: Implement the minimal cover contract**

Add the following public API in `project-cover.ts`:

```ts
export const defaultProjectCoverUrl = '/project-default-cover.png';
export const maxProjectCoverBytes = 20 * 1024 * 1024;
export const supportedProjectCoverMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type ProjectCoverFile = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type ProjectCoverValidationError = 'EMPTY_FILE' | 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE';

export const validateProjectCoverFile = (file: File): ProjectCoverValidationError | null => {
  if (file.size === 0) return 'EMPTY_FILE';
  if (!supportedProjectCoverMimeTypes.includes(file.type as typeof supportedProjectCoverMimeTypes[number])) return 'UNSUPPORTED_TYPE';
  if (file.size > maxProjectCoverBytes) return 'FILE_TOO_LARGE';
  return null;
};

export const readProjectCoverFile = async (file: File): Promise<ProjectCoverFile> => ({
  name: file.name,
  mimeType: file.type,
  bytes: new Uint8Array(await file.arrayBuffer()),
});
```

Add the reusable draft type:

```ts
export type ProjectCoverDraft = ProjectCoverFile & { previewUrl: string };
```

Then add `cover?: ProjectCoverDraft` to the existing `NewDesignDraft` declaration and add `coverAssetId?: string` plus `coverPreviewUrl?: string` to the existing `Project` declaration. Do not add the preview URL to persistent metadata.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
pnpm exec vitest run src/app/studio/project-cover.test.ts
```

Expected: PASS.

Commit only the four Task 1 files:

```bash
git add public/project-default-cover.png src/app/studio/project-cover.ts src/app/studio/project-cover.test.ts src/app/studio/types.ts
git commit -m "feat: add project cover file contract"
```

### Task 2: Persist Cover Asset Attribution in Project Metadata

**Files:**
- Modify: `src/features/projects/metadata.ts`
- Modify: `src/features/projects/metadata.test.ts`
- Modify: `src/features/workspace/project-store.ts`
- Modify: `src/desktop/storage/project-store.ts`
- Modify: `src/desktop/ipc/projects.ts`
- Modify: `src/desktop/storage/project-store.test.ts`
- Modify: `tests/integration/project-store.test.ts`

- [ ] **Step 1: Write failing metadata and storage tests**

Add metadata tests proving creation and update preserve a cover ID while a legacy project omits it:

```ts
it('preserves an optional managed cover asset id', () => {
  const created = createProjectMetadata({
    projectId: 'project-1',
    workspaceId: 'workspace-1',
    name: '项目',
    coverAssetId: 'asset-0123456789abcdef',
  });
  expect(created.coverAssetId).toBe('asset-0123456789abcdef');
  expect(createProjectMetadata({ projectId: 'project-2', workspaceId: 'workspace-1', name: '旧项目' })).not.toHaveProperty('coverAssetId');
  expect(updateProjectMetadata(created, { coverAssetId: 'asset-fedcba9876543210' }).coverAssetId).toBe('asset-fedcba9876543210');
});
```

Extend the duplicate test so the source metadata contains `coverAssetId`, then assert the duplicate keeps the same ID and copied managed bytes. Add a restart integration test that imports an asset, writes `coverAssetId`, closes and reopens the workspace, and reads the same bytes through `createAssetStore(reopened)`.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```bash
pnpm exec vitest run src/features/projects/metadata.test.ts src/desktop/storage/project-store.test.ts tests/integration/project-store.test.ts
```

Expected: FAIL because project metadata and duplicate/import creation inputs do not carry `coverAssetId`.

- [ ] **Step 3: Implement optional metadata propagation**

Add `coverAssetId?: string` to `ProjectMetadata`, `ProjectMetadataInput`, `ActiveProject`, and `CreateProjectContainerInput`. Add it to the `ProjectMetadataPatch` pick list. Preserve it in `createProjectMetadata` and `updateProjectMetadata`:

```ts
...(input.coverAssetId === undefined ? {} : { coverAssetId: input.coverAssetId }),
```

```ts
...(patch.coverAssetId === undefined ? {} : { coverAssetId: patch.coverAssetId }),
```

Pass `coverAssetId` through `initializeProject`, `duplicateProject`, and imported package creation. Add `'coverAssetId'` to the allowed metadata patch keys in `src/desktop/ipc/projects.ts`.

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
pnpm exec vitest run src/features/projects/metadata.test.ts src/desktop/storage/project-store.test.ts tests/integration/project-store.test.ts src/desktop/ipc/projects.test.ts
```

Expected: PASS.

Commit only Task 2 files:

```bash
git add src/features/projects/metadata.ts src/features/projects/metadata.test.ts src/features/workspace/project-store.ts src/desktop/storage/project-store.ts src/desktop/ipc/projects.ts src/desktop/storage/project-store.test.ts tests/integration/project-store.test.ts
git commit -m "feat: persist project cover attribution"
```

### Task 3: Build the New-Project Cover Picker

**Files:**
- Create: `src/app/studio/ProjectCoverPicker.tsx`
- Create: `src/app/studio/ProjectCoverPicker.test.tsx`
- Modify: `src/app/studio/NewDesignPage.tsx`
- Modify: `src/app/studio/NewDesignPage.test.tsx`
- Modify: `src/app/studio/persona.css`

- [ ] **Step 1: Write failing picker tests**

Test the default image, successful selection, replacement cleanup, validation, and restore behavior. Mock the URL lifecycle explicitly:

```ts
const createObjectURL = vi.fn(() => 'blob:cover-1');
const revokeObjectURL = vi.fn();
vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

it('starts with the default cover and accepts a valid replacement', async () => {
  const onChange = vi.fn();
  render(<ProjectCoverPicker locale="zh-CN" value={undefined} onChange={onChange} />);
  expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', '/project-default-cover.png');
  fireEvent.change(screen.getByLabelText('选择项目封面'), {
    target: { files: [new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    name: 'cover.png',
    mimeType: 'image/png',
    previewUrl: 'blob:cover-1',
  })));
});

it('rejects an unsupported image without replacing the current cover', async () => {
  const onChange = vi.fn();
  render(<ProjectCoverPicker locale="zh-CN" value={undefined} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('选择项目封面'), {
    target: { files: [new File(['svg'], 'cover.svg', { type: 'image/svg+xml' })] },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('PNG、JPEG 或 WebP');
  expect(onChange).not.toHaveBeenCalled();
});
```

Add a form-level assertion that the cover region appears before the project-name field and that creation buttons remain outside the form content.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectCoverPicker.test.tsx src/app/studio/NewDesignPage.test.tsx
```

Expected: FAIL because `ProjectCoverPicker` and the cover field are absent.

- [ ] **Step 3: Implement the picker and form integration**

Implement an accessible component with this interface:

```ts
type ProjectCoverPickerProps = {
  locale: Locale;
  value?: ProjectCoverDraft;
  onChange: (value: ProjectCoverDraft | undefined) => void;
};
```

The hidden file input must use:

```tsx
<input
  ref={inputRef}
  className="sr-only"
  type="file"
  accept="image/png,image/jpeg,image/webp"
  aria-label={t(locale, '选择项目封面', 'Choose project cover')}
  onChange={handleFileChange}
/>
```

Validate before reading bytes. On a valid selection, create a new Object URL, revoke the previous selection URL only after the new file is ready, and call `onChange`. “恢复默认” revokes the selected URL and calls `onChange(undefined)`. Do not revoke on component unmount because closing the drawer must retain the draft.

Render `ProjectCoverPicker` as the first form field in `NewProjectForm` and update the draft with `{ ...draft, cover }`.

Style a restrained 16:9 preview with a fine border, quiet overlay actions, `object-fit: cover`, and no horizontal overflow at narrow widths. Keep the existing project-name input as the drawer's initial focus target.

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectCoverPicker.test.tsx src/app/studio/NewDesignPage.test.tsx
```

Expected: PASS.

Commit only Task 3 files:

```bash
git add src/app/studio/ProjectCoverPicker.tsx src/app/studio/ProjectCoverPicker.test.tsx src/app/studio/NewDesignPage.tsx src/app/studio/NewDesignPage.test.tsx src/app/studio/persona.css
git commit -m "feat: add project cover picker"
```

### Task 4: Render Managed and Default Covers on Project Cards

**Files:**
- Create: `src/app/studio/ProjectCoverImage.tsx`
- Create: `src/app/studio/ProjectCoverImage.test.tsx`
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/styles/studio.css`
- Modify: `src/app/Studio.test.tsx`

- [ ] **Step 1: Write failing managed-cover tests**

Cover three states: no asset ID uses default without an IPC call, a managed cover reads bytes and releases its Object URL, and read/image failure returns to default.

```ts
it('reads a managed project cover and releases its object URL', async () => {
  const readAsset = vi.fn(async () => new Uint8Array([1, 2, 3]));
  window.designhub = { chooseWorkspaceDirectory: async () => null, readAsset };
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:managed-cover'), revokeObjectURL });
  const { unmount } = render(<ProjectCoverImage workspaceId="workspace-1" projectId="project-1" coverAssetId="asset-0123456789abcdef" alt="春间市集项目封面" />);
  await waitFor(() => expect(screen.getByRole('img', { name: '春间市集项目封面' })).toHaveAttribute('src', 'blob:managed-cover'));
  unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:managed-cover');
});
```

Update the existing project-card test to expect a labelled cover image and add a project with no `coverAssetId` that renders `/project-default-cover.png`.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectCoverImage.test.tsx src/app/Studio.test.tsx
```

Expected: FAIL because project cards still render `ArtworkPreview`.

- [ ] **Step 3: Implement the managed cover reader and card integration**

Use the existing desktop API and an effect scoped by workspace, project, and asset IDs:

```tsx
useEffect(() => {
  if (previewUrl || !workspaceId || !coverAssetId) {
    setSource(previewUrl ?? defaultProjectCoverUrl);
    return undefined;
  }
  let cancelled = false;
  let objectUrl: string | undefined;
  void getDesktopApi().readAsset?.({ workspaceId, projectId, assetId: coverAssetId })
    .then((bytes) => {
      if (cancelled || !bytes) return;
      objectUrl = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer]));
      setSource(objectUrl);
    })
    .catch(() => setSource(defaultProjectCoverUrl));
  return () => {
    cancelled = true;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}, [coverAssetId, previewUrl, projectId, workspaceId]);
```

Guard `onError` so the fallback URL does not loop. Map `entry.coverAssetId` in `toStudioProject`. Replace `ArtworkPreview` inside `.project-cover` with `ProjectCoverImage`, passing a localized alt such as `春间市集项目封面`.

Update CSS so `.project-cover__image` fills the card cover, uses centered cover fitting, and keeps the existing hover scale without changing card dimensions.

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectCoverImage.test.tsx src/app/Studio.test.tsx
```

Expected: PASS.

Commit only Task 4 files and the exact `Studio.tsx` cover-rendering hunks:

```bash
git add src/app/studio/ProjectCoverImage.tsx src/app/studio/ProjectCoverImage.test.tsx src/app/styles/studio.css src/app/Studio.test.tsx
git add -p src/app/studio/Studio.tsx
git commit -m "feat: render project cover images"
```

### Task 5: Import the Selected Cover During Project Creation

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/Studio.test.tsx`
- Modify: `src/app/studio/LibraryPages.tsx`
- Modify: `src/app/studio/LibraryPages.test.tsx`

- [ ] **Step 1: Write failing creation and filtering tests**

In `Studio.test.tsx`, configure writable workspace API spies and select a valid cover. Assert the calls occur in order and use only an asset ID in metadata:

```ts
expect(createProjectContainer).toHaveBeenCalledBefore(importAssets);
expect(importAssets).toHaveBeenCalledWith({
  workspaceId: 'workspace-1',
  projectId: 'project-created',
  items: [{
    name: 'cover.png',
    mimeType: 'image/png',
    data: expect.any(Uint8Array),
    metadata: { purpose: 'project-cover' },
  }],
});
expect(updateProjectMetadata).toHaveBeenCalledWith({
  workspaceId: 'workspace-1',
  projectId: 'project-created',
  patch: { coverAssetId: 'asset-0123456789abcdef' },
});
```

Add separate tests proving cancellation retains the selected preview, successful creation revokes and resets it, and an import failure still opens the created project with the default cover and a warning.

In `LibraryPages.test.tsx`, return ordinary, `conversation-reference`, and `project-cover` assets and assert only the ordinary asset is visible.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/LibraryPages.test.tsx
```

Expected: FAIL because creation does not import covers and the asset library exposes project-cover assets.

- [ ] **Step 3: Implement ordered creation with graceful fallback**

After `createProjectContainer` succeeds, run a narrow helper:

```ts
const persistProjectCover = async (projectId: string): Promise<string | undefined> => {
  if (!draft.cover || !workspace) return undefined;
  const results = await getDesktopApi().importAssets?.({
    workspaceId: workspace.workspaceId,
    projectId,
    items: [{
      name: draft.cover.name,
      mimeType: draft.cover.mimeType,
      data: draft.cover.bytes,
      metadata: { purpose: 'project-cover' },
    }],
  });
  const imported = results?.find((result) => result.status === 'success');
  if (!imported) throw new Error('PROJECT_COVER_IMPORT_FAILED');
  const metadata = await getDesktopApi().updateProjectMetadata?.({
    workspaceId: workspace.workspaceId,
    projectId,
    patch: { coverAssetId: imported.asset.id },
  });
  if (!metadata?.coverAssetId) throw new Error('PROJECT_COVER_UPDATE_FAILED');
  return metadata.coverAssetId;
};
```

Catch only the cover persistence failure after the project exists. Set the created `Project.coverAssetId` only on success. Always navigate to the new project. Use the warning notification on cover failure; otherwise retain the existing success notification.

Before clearing a successfully created draft, revoke `draft.cover.previewUrl`. For preview-only projects transfer the URL into `Project.coverPreviewUrl` and do not revoke it until Studio unmounts. Preserve the current draft on container-creation failure.

Change the asset filter to:

```ts
const hiddenPurposes = new Set(['conversation-reference', 'project-cover']);
result.filter((asset) => !hiddenPurposes.has(String(asset.metadata?.purpose ?? '')))
```

- [ ] **Step 4: Run focused tests and commit**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/LibraryPages.test.tsx
```

Expected: PASS.

Commit only Task 5 hunks:

```bash
git add -p src/app/studio/Studio.tsx src/app/Studio.test.tsx src/app/studio/LibraryPages.tsx src/app/studio/LibraryPages.test.tsx
git commit -m "feat: persist covers when creating projects"
```

### Task 6: Exercise the Complete Browser Flow and Verify

**Files:**
- Modify: `tests/e2e/studio.spec.ts`

- [ ] **Step 1: Add the failing E2E flow**

Extend the new-project drawer test to assert the default image, load a tiny PNG through the hidden input, verify the preview, close and reopen the drawer, restore the default, select the image again, create the project, and verify the project card displays the custom cover. Keep the existing standard and narrow viewport overflow checks.

Use Playwright's file payload so the test does not depend on a developer-machine path:

```ts
await drawer.getByLabel('选择项目封面').setInputFiles({
  name: 'project-cover.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw2X7wAAAABJRU5ErkJggg==', 'base64'),
});
await expect(drawer.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', /^blob:/u);
```

- [ ] **Step 2: Build and run E2E to verify RED**

Run:

```bash
pnpm build
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "new project uses a focused drawer|new-project drawer restores focus"
```

Expected before the final E2E implementation: FAIL on the missing cover controls or project-card image.

- [ ] **Step 3: Complete E2E host mocks and rerun**

Extend the test workspace's mocked `importAssets`, `updateProjectMetadata`, and `readAsset` methods so the managed cover ID and bytes survive the test's simulated project list refresh. Do not special-case the UI component.

Run:

```bash
pnpm build
pnpm exec playwright test tests/e2e/studio.spec.ts --grep "new project uses a focused drawer|new-project drawer restores focus"
```

Expected: PASS.

- [ ] **Step 4: Run complete verification**

Run:

```bash
pnpm exec vitest run src/app/studio/project-cover.test.ts src/app/studio/ProjectCoverPicker.test.tsx src/app/studio/ProjectCoverImage.test.tsx src/features/projects/metadata.test.ts src/desktop/storage/project-store.test.ts src/desktop/ipc/projects.test.ts src/app/studio/NewDesignPage.test.tsx src/app/Studio.test.tsx src/app/studio/LibraryPages.test.tsx tests/integration/project-store.test.ts
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit 0. Existing Vite chunk-size warnings are non-blocking; no new TypeScript, lint, or test warnings are accepted.

- [ ] **Step 5: Visually inspect both drawer sizes**

Open the E2E screenshots and confirm:

- the default cover is visually crisp and centered;
- picker actions remain legible over both light and dark image regions;
- the form retains its hierarchy and fixed footer;
- standard and 1024×720 windows have no horizontal overflow;
- project cards use the same centered crop behavior.

- [ ] **Step 6: Commit E2E coverage**

```bash
git add tests/e2e/studio.spec.ts
git commit -m "test: cover project cover creation flow"
```
