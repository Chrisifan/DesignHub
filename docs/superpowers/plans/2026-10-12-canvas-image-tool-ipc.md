# Canvas Image Tool IPC Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make canvas image-tool submissions cross Electron IPC using managed asset IDs and create real tasks without misreporting an IPC rejection as a model connection failure.

**Architecture:** The renderer sends only structured-clone-safe metadata plus `sourceAssetId`. The main-process task service resolves that asset through its existing `loadSourceImage` dependency and supplies a real `Blob` to provider and local-tool adapters. IPC, service, and renderer tests each cover their own boundary.

**Tech Stack:** TypeScript, React, Electron IPC, Vitest, Testing Library

---

### Task 1: Make the image-edit IPC contract asset-based

**Files:**
- Modify: `src/features/agent/task-service.ts`
- Modify: `src/desktop/ipc/agent.ts`
- Modify: `src/platform/contracts.ts`
- Test: `src/desktop/ipc/agent.test.ts`

- [ ] **Step 1: Write the failing IPC regression test**

Replace the same-process `Blob` expectation with a structured-clone-safe source asset payload and assert that payloads without a source asset are rejected:

```ts
it('accepts image edits by managed source asset without renderer blobs', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1', openMode: 'writable' } };
  const submit = createImageEditHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.sourceAssetId).toBe('asset-1');
    expect(input).not.toHaveProperty('image');
    return task;
  });

  await expect(submit(fixture.event, {
    libraryId: 'workspace-1',
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    sourceAssetId: 'asset-1',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
  })).resolves.toEqual(task);
  await expect(submit(fixture.event, {
    libraryId: 'workspace-1',
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
  })).resolves.toBeNull();
});
```

- [ ] **Step 2: Run the IPC test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/desktop/ipc/agent.test.ts
```

Expected: FAIL because `isImageEditInput` still requires a `Blob`.

- [ ] **Step 3: Define and validate the serializable bridge input**

Export an input type for submissions that may omit the resolved image:

```ts
export type ImageEditSubmissionInput = Omit<ImageEditInput, 'image' | 'mask'> & {
  image?: Blob;
  mask?: Blob;
};
```

Use `ImageEditSubmissionInput` in `AgentTaskService.submitImageEdit`. Define `ImageEditBridgeInput` as the submission type plus `libraryId`, excluding renderer `Blob` fields:

```ts
export type ImageEditBridgeInput = Omit<ImageEditSubmissionInput, 'image' | 'mask'> & {
  libraryId: string;
  sourceAssetId: string;
};
```

Update `isImageEditInput` to require `sourceAssetId`, remove `isBlobLike` checks, preserve tool/region/scene validation, and require a writable active workspace in `createImageEditHandler`. Update `DesktopApi.submitImageEdit` to accept the same serializable shape.

- [ ] **Step 4: Run the IPC test and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/desktop/ipc/agent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit only Task 1 files**

```bash
git add src/features/agent/task-service.ts src/desktop/ipc/agent.ts src/platform/contracts.ts src/desktop/ipc/agent.test.ts
git commit -m "fix: make image edit IPC asset based"
```

### Task 2: Resolve the managed image before task creation

**Files:**
- Create: `src/features/agent/task-service-image-edit.test.ts`
- Modify: `src/features/agent/task-service.ts`

- [ ] **Step 1: Write failing task-service tests**

Create a focused test with a real task runtime and adapter spy:

```ts
it('loads a managed source image before executing an image edit', async () => {
  const source = new Blob(['source'], { type: 'image/png' });
  const editImage = vi.fn(async () => ({ images: [{ base64: 'cmVzdWx0', mimeType: 'image/png' }], cost: null }));
  const loadSourceImage = vi.fn(async () => source);
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }), editImage }),
    loadSourceImage,
    persistGeneratedImages: async () => ['asset-result'],
  });

  await service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    sourceAssetId: 'asset-source',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
  });
  await service.flush();

  expect(loadSourceImage).toHaveBeenCalledWith({ projectId: 'project-1', assetId: 'asset-source' });
  expect(editImage).toHaveBeenCalledWith(expect.objectContaining({ image: source }), expect.any(AbortSignal));
});

it('rejects submission when the managed source image is unavailable', async () => {
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }) }),
    loadSourceImage: async () => null,
  });

  await expect(service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    sourceAssetId: 'asset-missing',
  })).rejects.toThrow('SOURCE_ASSET_MISSING');
});
```

- [ ] **Step 2: Run the service test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/features/agent/task-service-image-edit.test.ts
```

Expected: FAIL because `submitImageEdit` does not resolve a missing `image`.

- [ ] **Step 3: Resolve source and mask assets into an internal input**

Update `submitImageEdit` so it resolves the image before task creation and passes only a fully resolved `ImageEditInput` to execution:

```ts
const submitImageEdit = async (input: ImageEditSubmissionInput): Promise<TaskRecord> => {
  const image = input.image ?? (input.sourceAssetId && options.loadSourceImage
    ? await options.loadSourceImage({ projectId: input.projectId, assetId: input.sourceAssetId })
    : undefined);
  if (!image) throw new Error('SOURCE_ASSET_MISSING');
  const mask = input.mask ?? (input.maskAssetId && options.loadMaskImage
    ? await options.loadMaskImage({ projectId: input.projectId, assetId: input.maskAssetId })
    : undefined);
  if (input.maskAssetId && !mask) throw new Error('MASK_ASSET_MISSING');
  const resolved: ImageEditInput = { ...input, image, ...(mask ? { mask } : {}) };
  const task = createImageTask(resolved, resolved.tool === 'resize' && !resolved.connectionId.trim() ? 'local-transform' : 'image-editing');
  await options.runtime.flush();
  await executeImageTask(task, resolved, 'edit');
  return task;
};
```

- [ ] **Step 4: Run the service and IPC tests and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/features/agent/task-service-image-edit.test.ts src/desktop/ipc/agent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit only Task 2 files**

```bash
git add src/features/agent/task-service.ts src/features/agent/task-service-image-edit.test.ts
git commit -m "fix: resolve managed source images for edit tasks"
```

### Task 3: Stop sending image bytes from Studio

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Test: `src/app/Studio.test.tsx`

- [ ] **Step 1: Strengthen the Studio regression test**

Extend the existing background-removal assertion:

```ts
await waitFor(() => expect(submitImageEdit).toHaveBeenCalledWith(expect.objectContaining({
  projectId: 'project-image-only',
  sourceAssetId: 'asset-image-only',
  tool: 'remove-background',
})));
expect(submitImageEdit.mock.calls[0]?.[0]).not.toHaveProperty('image');
expect(readAsset).not.toHaveBeenCalled();
```

Declare `const readAsset = vi.fn(async () => new Uint8Array([137, 80, 78, 71]));` and assign it to `window.designhub` so the final assertion observes the renderer behavior.

- [ ] **Step 2: Run the Studio test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/app/Studio.test.tsx -t "runs background removal from a project image"
```

Expected: FAIL because Studio still reads the asset and sends a `Blob`.

- [ ] **Step 3: Remove renderer asset reads from image-tool submission**

Delete the `readAsset` call and `Blob` construction in `submitProjectImageTask`. Keep `sourceAssetId: imageLayer.assetId` and the remaining task metadata. Change the null-return message to:

```ts
notify(t(locale, '图像任务未能提交。', 'The image task could not be submitted.'));
```

Provider execution errors continue to use the existing generic retry message.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/app/Studio.test.tsx -t "runs background removal from a project image"
npx vitest run --config vitest.config.ts src/desktop/ipc/agent.test.ts src/features/agent/task-service-image-edit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit only Task 3 files**

```bash
git add src/app/studio/Studio.tsx src/app/Studio.test.tsx
git commit -m "fix: submit canvas image tools by asset id"
```

### Task 4: Verify the complete change

**Files:**
- Verify all files changed in Tasks 1-3

- [ ] **Step 1: Run static checks**

```bash
npm run typecheck
npm run lint
```

Expected: both commands exit 0 with no warnings.

- [ ] **Step 2: Run the full unit suite**

```bash
npm run test:unit
```

Expected: all non-skipped tests pass.

- [ ] **Step 3: Build production bundles**

```bash
npm run build
```

Expected: renderer, main, and preload builds exit 0.

- [ ] **Step 4: Check patch integrity**

```bash
git diff --check HEAD~3..HEAD
```

Expected: no output.

- [ ] **Step 5: Manually verify the running app**

Restart the Electron development app, select a managed canvas image, run a non-destructive image tool, and confirm that a task placeholder appears instead of the connection-error toast. Do not transmit a user image to a provider without explicit approval; use the local resize tool when approval is absent.
