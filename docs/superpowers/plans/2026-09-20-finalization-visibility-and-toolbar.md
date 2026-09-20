# Finalization Visibility and Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make candidate finalization directly available from the right canvas toolbar and ensure the finalized image reliably appears both after reopening the canvas and on the project detail card.

**Architecture:** Keep `Workbench` responsible for candidate selection and the ordered scene/revision finalization transaction, then notify `Studio` through a typed callback so project metadata is synchronized before navigation. Add a focused `ProjectDocumentPreview` component that reads the persisted scene and managed image asset for detail-page thumbnails, with the existing artwork preview as a fallback.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Electron preload desktop API, existing DesignScene/revision/project metadata stores, CSS.

---

## File map

- Create `src/app/studio/ProjectDocumentPreview.tsx`: load one document scene, choose its formal content image, read the managed asset, and own the object URL lifecycle.
- Create `src/app/studio/ProjectDocumentPreview.test.tsx`: verify content selection, reference exclusion, fallback behavior, and URL cleanup.
- Modify `src/app/studio/ProjectDetailPage.tsx`: render `ProjectDocumentPreview` inside each saved document card.
- Modify `src/app/studio/project-detail.css`: make the real thumbnail fill the existing preview area without changing card dimensions.
- Modify `src/app/studio/Workbench.tsx`: expose the finalization callback, move the primary finalization action, choose the correct content layer, and await every persistence boundary.
- Modify `src/app/studio/workbench.css`: add a separator and finalization action state to the existing glass toolbar.
- Modify `src/app/studio/Workbench.test.tsx`: cover toolbar state, content/reference layer behavior, persistence ordering, and failure retention.
- Modify `src/app/studio/Studio.tsx`: persist `finalizedRevisionId`, synchronize project state, and resolve the callback before leaving the workbench.
- Modify `src/app/Studio.test.tsx`: verify metadata synchronization and detail-page status after finalization.
- Modify `src/features/canvas/CanvasWorkspace.test.tsx`: retain a regression test proving a persisted finalized scene wins over the initial empty scene on remount.

### Task 1: Add persisted document thumbnails

**Files:**
- Create: `src/app/studio/ProjectDocumentPreview.tsx`
- Create: `src/app/studio/ProjectDocumentPreview.test.tsx`
- Modify: `src/app/studio/ProjectDetailPage.tsx`
- Modify: `src/app/studio/project-detail.css`

- [ ] **Step 1: Write failing tests for content asset selection and cleanup**

Create `ProjectDocumentPreview.test.tsx` with a persisted scene containing a reference layer before a content layer. Verify that only the content asset is read, the generated image is displayed, and its URL is revoked on unmount:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createScene } from '../../features/canvas/scene';
import { ProjectDocumentPreview } from './ProjectDocumentPreview';

afterEach(() => vi.restoreAllMocks());

it('renders the persisted content image and ignores reference layers', async () => {
  const scene = createScene({
    id: 'doc-1', width: 1080, height: 1440, layers: [
      { id: 'reference', type: 'image', role: 'reference', assetId: 'asset-reference', x: 0, y: 0, width: 200, height: 200, rotation: 0, opacity: 1, visible: true, locked: false },
      { id: 'content', type: 'image', role: 'content', assetId: 'asset-final', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
    ],
  });
  const loadDocumentScene = vi.fn(async () => scene);
  const readAsset = vi.fn(async () => new Uint8Array([1, 2, 3]));
  const createObjectURL = vi.fn(() => 'blob:final');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentScene, readAsset };

  const view = render(<ProjectDocumentPreview workspaceId="workspace-1" projectId="project-1" documentId="doc-1" artwork="market" alt="主海报定稿预览" />);

  expect(await screen.findByRole('img', { name: '主海报定稿预览' })).toHaveAttribute('src', 'blob:final');
  expect(readAsset).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1', assetId: 'asset-final' });
  expect(readAsset).not.toHaveBeenCalledWith(expect.objectContaining({ assetId: 'asset-reference' }));
  view.unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:final');
});

it('falls back to the artwork preview when no formal image can be read', async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDocumentScene: vi.fn(async () => createScene({ id: 'doc-1', width: 100, height: 100, layers: [] })),
    readAsset: vi.fn(async () => null),
  };
  const view = render(<ProjectDocumentPreview workspaceId="workspace-1" projectId="project-1" documentId="doc-1" artwork="market" alt="主海报定稿预览" />);
  await waitFor(() => expect(view.container.querySelector('.artwork--market')).toBeInTheDocument());
  expect(screen.queryByRole('img', { name: '主海报定稿预览' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDocumentPreview.test.tsx
```

Expected: FAIL because `ProjectDocumentPreview.tsx` does not exist.

- [ ] **Step 3: Implement the preview component**

Create `ProjectDocumentPreview.tsx` with a single effect that selects the persisted formal image and cleans up URLs:

```tsx
import { useEffect, useState } from 'react';
import { getDesktopApi } from '../../platform/runtime';
import type { Artwork } from './types';
import { ArtworkPreview } from './ui';

type ProjectDocumentPreviewProps = {
  workspaceId?: string;
  projectId: string;
  documentId?: string;
  artwork: Artwork;
  alt: string;
};

export const ProjectDocumentPreview = ({ workspaceId, projectId, documentId, artwork, alt }: ProjectDocumentPreviewProps) => {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !documentId) return undefined;
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      const scene = await getDesktopApi().loadDocumentScene?.(workspaceId, projectId, documentId);
      const image = scene?.layers.find((layer) => layer.type === 'image' && layer.role === 'content' && layer.assetId !== 'placeholder')
        ?? scene?.layers.find((layer) => layer.type === 'image' && layer.role !== 'reference' && layer.assetId !== 'placeholder');
      if (!image) return;
      const bytes = await getDesktopApi().readAsset?.({ workspaceId, projectId, assetId: image.assetId });
      if (!bytes || cancelled) return;
      objectUrl = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'image/*' }));
      if (!cancelled) setSource(objectUrl);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, projectId, workspaceId]);

  return source
    ? <img className="project-detail-document-card__image" src={source} alt={alt} />
    : <ArtworkPreview kind={artwork} />;
};
```

In `ProjectDetailPage.tsx`, replace the static card preview content with:

```tsx
<ProjectDocumentPreview
  workspaceId={project.workspaceId}
  projectId={project.id}
  documentId={entry?.id}
  artwork={project.artwork}
  alt={t(locale, `${name}定稿预览`, `${name} final preview`)}
/>
```

Add the import and the following rule to `project-detail.css`:

```css
.project-detail-document-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

- [ ] **Step 4: Run preview and detail tests**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDocumentPreview.test.tsx src/app/studio/ProjectDetailPage.test.tsx
```

Expected: PASS; existing card layout and click behavior remain unchanged.

- [ ] **Step 5: Commit the thumbnail slice**

```bash
git add src/app/studio/ProjectDocumentPreview.tsx src/app/studio/ProjectDocumentPreview.test.tsx src/app/studio/ProjectDetailPage.tsx src/app/studio/project-detail.css
git commit -m "feat: show finalized document previews"
```

### Task 2: Move finalization to the right toolbar and make scene persistence reliable

**Files:**
- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/workbench.css`
- Modify: `src/app/studio/Workbench.test.tsx`

- [ ] **Step 1: Write failing toolbar and finalization tests**

Extend `Workbench.test.tsx` with helpers that return one completed candidate, then add these cases:

```tsx
const conversationTask = {
  id: 'conversation-1', requestId: 'request-1', state: 'completed' as const, cancelRequested: false, attempt: 1,
  capability: 'conversation', analysisThreadId: 'thread-1', documentId: 'doc-1',
  source: { kind: 'project' as const, id: 'spring-market' }, result: { text: 'Brief' },
};
const completedCandidateTask = {
  id: 'design-1', requestId: 'request-2', state: 'completed' as const, cancelRequested: false, attempt: 1,
  capability: 'design-generation', analysisThreadId: 'thread-1', documentId: 'doc-1',
  source: { kind: 'project' as const, id: 'spring-market' },
  result: { candidates: [{ id: 'candidate-1', baseRevisionId: null, assetIds: ['asset-candidate'], sceneAssetId: 'asset-candidate', createdAt: '2026-09-20T00:00:00.000Z' }] },
};

const enterCandidateThread = async (props: Partial<WorkbenchProps> = {}) => {
  const onSubmitConversation = vi.fn(async () => conversationTask);
  const onSubmitDesignGeneration = vi.fn(async () => completedCandidateTask);
  render(<Workbench {...makeProps({ workspaceId: 'workspace-1', documentId: 'doc-1', onSubmitConversation, onSubmitDesignGeneration, ...props })} />);
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成候选' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '生成' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '生成' }));
  return { onSubmitConversation, onSubmitDesignGeneration };
};

it('enables the right-toolbar finalization action only after selecting a candidate', async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
  };
  await enterCandidateThread();
  const contextTools = screen.getByRole('toolbar', { name: '上下文工具' });
  const finalize = within(contextTools).getByRole('button', { name: '定稿所选候选' });
  expect(finalize).toBeDisabled();
  const candidateImage = await screen.findByRole('img', { name: '生成候选稿' });
  fireEvent.click(candidateImage.closest('button')!);
  expect(finalize).toBeEnabled();
  expect(screen.getAllByRole('button', { name: '定稿所选候选' })).toHaveLength(1);
});

it('preserves reference layers and waits for scene storage before leaving', async () => {
  let resolveSave!: (value: boolean) => void;
  const saveDocumentScene = vi.fn(() => new Promise<boolean>((resolve) => { resolveSave = resolve; }));
  const onBack = vi.fn();
  const onCandidateFinalized = vi.fn(async () => undefined);
  const scene = createScene({ id: 'doc-1', width: 1080, height: 1440, layers: [
    { id: 'reference', type: 'image', role: 'reference', assetId: 'asset-reference', x: 10, y: 10, width: 200, height: 200, rotation: 0, opacity: .5, visible: true, locked: false },
    { id: 'content', type: 'image', role: 'content', assetId: 'asset-old', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
    commitDocumentRevision: vi.fn(async () => ({ revisionId: 'revision-final' })),
    setFinalDocumentRevision: vi.fn(async () => true),
    saveDocumentScene,
  };
  await enterCandidateThread({ scene, onBack, onCandidateFinalized });
  fireEvent.click((await screen.findByRole('img', { name: '生成候选稿' })).closest('button')!);
  fireEvent.click(within(screen.getByRole('toolbar', { name: '上下文工具' })).getByRole('button', { name: '定稿所选候选' }));

  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalled());
  const savedScene = saveDocumentScene.mock.calls[0]![0].scene;
  expect(savedScene.layers).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'reference', assetId: 'asset-reference', role: 'reference' }),
    expect.objectContaining({ id: 'content', assetId: 'asset-candidate', role: 'content' }),
  ]));
  expect(onBack).not.toHaveBeenCalled();
  resolveSave(true);
  await waitFor(() => expect(onCandidateFinalized).toHaveBeenCalledWith({ documentId: 'doc-1', revisionId: 'revision-final', scene: savedScene }));
  expect(onBack).toHaveBeenCalledOnce();
});

it('keeps the selected candidate when scene storage fails', async () => {
  const notify = vi.fn();
  const onBack = vi.fn();
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
    commitDocumentRevision: vi.fn(async () => ({ revisionId: 'revision-final' })),
    setFinalDocumentRevision: vi.fn(async () => true),
    saveDocumentScene: vi.fn(async () => false),
  };
  await enterCandidateThread({ onBack, notify });
  fireEvent.click((await screen.findByRole('img', { name: '生成候选稿' })).closest('button')!);
  const contextTools = screen.getByRole('toolbar', { name: '上下文工具' });
  fireEvent.click(within(contextTools).getByRole('button', { name: '定稿所选候选' }));
  await waitFor(() => expect(notify).toHaveBeenCalledWith('候选定稿失败'));
  expect(onBack).not.toHaveBeenCalled();
  expect(within(contextTools).getByRole('button', { name: '定稿所选候选' })).toBeEnabled();
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
pnpm exec vitest run src/app/studio/Workbench.test.tsx
```

Expected: FAIL because the only primary finalization action is still in the top toolbar, the callback prop is absent, and scene saving is not awaited.

- [ ] **Step 3: Implement the Workbench contract and correct content-layer selection**

Add the callback to `WorkbenchProps` and destructuring:

```ts
onCandidateFinalized?: (input: {
  documentId: string;
  revisionId: string;
  scene: DesignScene;
}) => void | Promise<void>;
```

Change the formal layer lookup in `finalizeCandidate` to:

```ts
const imageLayer = scene.layers.find((layer): layer is Extract<typeof layer, { type: 'image' }> => (
  layer.type === 'image'
  && layer.role !== 'reference'
  && layer.assetId !== 'placeholder'
));
```

Keep the existing full-canvas content-layer creation path when `imageLayer` is absent.

- [ ] **Step 4: Make finalization boundaries explicit and awaited**

After `setFinalDocumentRevision` succeeds, replace `persistScene(candidateScene)` with an awaited save and callback:

```ts
const saved = await getDesktopApi().saveDocumentScene?.({
  workspaceId,
  projectId: project.id,
  documentId,
  scene: candidateScene,
});
if (saved !== true) throw new Error('SCENE_SAVE_FAILED');
setScene(candidateScene);
await onCandidateFinalized?.({
  documentId,
  revisionId: committed.revisionId,
  scene: candidateScene,
});
```

Only execute the existing revision refresh, candidate/thread cleanup, and `onBack()` after the callback resolves. Leave all cleanup inside the success path so the catch branch preserves selection and candidates.

- [ ] **Step 5: Move the action into the right toolbar**

Delete the `check-circle` action from `.workbench-toolbar__actions`. After `panelOrder.map(...)` inside `.workbench-context-tools`, add:

```tsx
<span className="workbench-context-tools__separator" aria-hidden="true" />
<IconButton
  name="check-circle"
  label={t(locale, '定稿所选候选', 'Finalize selected candidate')}
  disabled={readOnly || revisionBusy || !selectedCandidateId}
  onClick={() => { if (selectedCandidateId) void finalizeCandidate(selectedCandidateId); }}
/>
```

Add to `workbench.css`:

```css
.workbench-context-tools__separator {
  width: 24px;
  height: 1px;
  margin: 2px auto;
  background: var(--workbench-glass-border);
}

.workbench-context-tools > .icon-button:last-child:not(:disabled) {
  color: var(--on-primary);
  background: var(--primary);
}
```

- [ ] **Step 6: Run Workbench tests**

Run:

```bash
pnpm exec vitest run src/app/studio/Workbench.test.tsx
```

Expected: PASS, including failure retention and reference-layer preservation.

- [ ] **Step 7: Commit the Workbench slice**

```bash
git add src/app/studio/Workbench.tsx src/app/studio/workbench.css src/app/studio/Workbench.test.tsx
git commit -m "fix: make candidate finalization reliable"
```

### Task 3: Synchronize finalized revision metadata in Studio

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/Studio.test.tsx`

- [ ] **Step 1: Write a failing Studio integration test**

Add a test fixture with one persisted project and one document. Drive the UI into its workbench, expose a completed candidate through `listTasks`, select it, and finalize from the right toolbar. Assert the exact metadata patch and resulting detail status:

```tsx
it('stores the finalized revision id before returning to project details', async () => {
  const document = { id: 'doc-1', name: '主海报', width: 1080, height: 1440, updatedAt: '2026-09-20T00:00:00.000Z' };
  const workspace = { workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1 as const, openMode: 'writable' as const };
  const conversationTask = {
    id: 'conversation-1', requestId: 'request-1', state: 'completed' as const, cancelRequested: false, attempt: 1,
    capability: 'conversation', analysisThreadId: 'thread-1', documentId: 'doc-1',
    source: { kind: 'project' as const, id: 'project-1' }, result: { text: 'Brief' },
  };
  const completedCandidateTask = {
    id: 'design-1', requestId: 'request-2', state: 'completed' as const, cancelRequested: false, attempt: 1,
    capability: 'design-generation', analysisThreadId: 'thread-1', documentId: 'doc-1',
    source: { kind: 'project' as const, id: 'project-1' },
    result: { candidates: [{ id: 'candidate-1', baseRevisionId: null, assetIds: ['asset-final'], sceneAssetId: 'asset-final', createdAt: '2026-09-20T00:00:00.000Z' }] },
  };
  const finalizedScene = createScene({ id: 'doc-1', width: 1080, height: 1440, layers: [
    { id: 'content', type: 'image', role: 'content', assetId: 'asset-final', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: '项目一', documents: [document] }]);
  const updateProjectMetadata = vi.fn(async ({ patch }: UpdateProjectMetadataInput): Promise<ProjectMetadata> => ({
    projectId: 'project-1', workspaceId: 'workspace-1', name: '项目一', archived: false,
    documents: patch.documents!.map((entry) => ({ ...entry, updatedAt: '2026-09-20T00:00:00.000Z' })),
    createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z',
  }));
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listActiveProjects,
    updateProjectMetadata,
    submitConversation: vi.fn(async () => conversationTask),
    submitDesignGeneration: vi.fn(async () => completedCandidateTask),
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    listTasks: vi.fn(async () => []),
    readAsset: vi.fn(async () => new Uint8Array([1])),
    commitDocumentRevision: vi.fn(async () => ({ revisionId: 'revision-final' })),
    setFinalDocumentRevision: vi.fn(async () => true),
    saveDocumentScene: vi.fn(async () => true),
    loadDocumentScene: vi.fn(async () => finalizedScene),
  };
  vi.spyOn(window, 'confirm').mockReturnValue(true);

  render(<Studio locale="zh-CN" theme="system" workspace={workspace} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '项目一' }));
  fireEvent.click(screen.getByRole('button', { name: '打开画布' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成候选' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '生成' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '生成' }));
  fireEvent.click((await screen.findByRole('img', { name: '生成候选稿' })).closest('button')!);
  fireEvent.click(within(screen.getByRole('toolbar', { name: '上下文工具' })).getByRole('button', { name: '定稿所选候选' }));

  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith({
    workspaceId: 'workspace-1', projectId: 'project-1',
    patch: { documents: [expect.objectContaining({ id: 'doc-1', finalizedRevisionId: 'revision-final' })] },
  }));
  expect(await screen.findByText('已定稿')).toBeInTheDocument();
});
```

Reuse the test file's existing workspace, project metadata, and task helper shapes rather than creating incompatible partial types.

- [ ] **Step 2: Run the Studio test and verify it fails**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx -t "stores the finalized revision id"
```

Expected: FAIL because `Workbench` is not yet wired with `onCandidateFinalized` and project metadata remains unchanged.

- [ ] **Step 3: Implement a throwing metadata synchronization callback**

In `Studio.tsx`, add a function that uses the project supplied by the Workbench instance, preserves all document fields, and throws on missing persistence:

```ts
const finalizeProjectDocument = async (project: Project, input: { documentId: string; revisionId: string }): Promise<void> => {
  if (!workspace || workspace.openMode !== 'writable') throw new Error('WORKSPACE_NOT_WRITABLE');
  const documents = (project.documentEntries ?? []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    width: entry.width,
    height: entry.height,
    ...(entry.sourceDocumentId ? { sourceDocumentId: entry.sourceDocumentId } : {}),
    ...(entry.sourceRevisionId !== undefined ? { sourceRevisionId: entry.sourceRevisionId } : {}),
    ...(entry.id === input.documentId
      ? { finalizedRevisionId: input.revisionId }
      : entry.finalizedRevisionId !== undefined ? { finalizedRevisionId: entry.finalizedRevisionId } : {}),
  }));
  const metadata = await getDesktopApi().updateProjectMetadata?.({
    workspaceId: workspace.workspaceId,
    projectId: project.id,
    patch: { documents },
  });
  if (!metadata) throw new Error('PROJECT_METADATA_UPDATE_FAILED');
  setProjects((current) => current.map((entry) => entry.id === project.id ? mergeProjectMetadata(entry, metadata) : entry));
  setSelected((current) => current?.id === project.id ? mergeProjectMetadata(current, metadata) : current);
};
```

Define this module-level helper above `Studio` and replace the duplicated field mapping currently inside `updateProject` with it:

```ts
const mergeProjectMetadata = (current: Project, metadata: ProjectMetadata): Project => ({
  ...current,
  name: metadata.name,
  enName: metadata.name,
  description: metadata.brief ?? current.description,
  enDescription: metadata.brief ?? current.enDescription,
  documents: metadata.documents.length,
  documentEntries: metadata.documents.map(({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId }) => ({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId })),
  archived: metadata.archived,
  activeDesignerVersionId: metadata.activeDesignerVersionId,
  contributorDesignerVersionIds: metadata.contributorDesignerVersionIds,
  designerSnapshot: metadata.designerSnapshot,
  brandSnapshot: metadata.brandSnapshot,
  coverAssetId: metadata.coverAssetId,
});
```

Wire every Workbench instance with:

```tsx
onCandidateFinalized={({ documentId, revisionId }) => finalizeProjectDocument(project, { documentId, revisionId })}
```

- [ ] **Step 4: Run Studio and Workbench tests**

Run:

```bash
pnpm exec vitest run src/app/Studio.test.tsx src/app/studio/Workbench.test.tsx
```

Expected: PASS; finalization waits for metadata and returns to a detail page that reports “已定稿”.

- [ ] **Step 5: Commit metadata synchronization**

```bash
git add src/app/studio/Studio.tsx src/app/Studio.test.tsx
git commit -m "fix: synchronize finalized document metadata"
```

### Task 4: Lock in reopen behavior and run the full acceptance suite

**Files:**
- Modify: `src/features/canvas/CanvasWorkspace.test.tsx`

- [ ] **Step 1: Add a persisted-scene hydration regression test**

Add a test that mounts `CanvasWorkspace` with an empty initial scene but returns a finalized scene from `loadDocumentScene`:

```tsx
it('hydrates the finalized content image instead of saving the initial empty scene', async () => {
  const initial = createScene({ id: 'doc-1', width: 1080, height: 1440, layers: [] });
  const finalized = createScene({ id: 'doc-1', width: 1080, height: 1440, layers: [
    { id: 'content', type: 'image', role: 'content', assetId: 'asset-final', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  const onSceneChange = vi.fn();
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDocumentScene: vi.fn(async () => finalized),
    saveDocumentScene,
    readAsset: vi.fn(async () => new Uint8Array([1])),
  };
  render(<CanvasWorkspace locale="zh-CN" scene={initial} onSceneChange={onSceneChange} workspaceId="workspace-1" projectId="project-1" documentId="doc-1" />);
  await waitFor(() => expect(onSceneChange).toHaveBeenCalledWith(finalized));
  expect(saveDocumentScene).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the hydration regression test**

Run:

```bash
pnpm exec vitest run src/features/canvas/CanvasWorkspace.test.tsx -t "hydrates the finalized content image"
```

Expected: PASS with the current hydration mechanism, proving no production change is needed in `CanvasWorkspace.tsx`.

- [ ] **Step 3: Run the focused acceptance suite**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDocumentPreview.test.tsx src/app/studio/ProjectDetailPage.test.tsx src/app/studio/Workbench.test.tsx src/app/Studio.test.tsx src/features/canvas/CanvasWorkspace.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 4: Run static and production checks**

Run each command separately:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit 0 with no new errors.

- [ ] **Step 5: Run broader regression tests**

```bash
pnpm test:integration
pnpm test:e2e
```

Expected: all configured integration and E2E tests PASS. If an environment prerequisite prevents execution, record the exact command and error rather than treating it as a pass.

- [ ] **Step 6: Commit the regression test and any evidence-driven hydration fix**

```bash
git add src/features/canvas/CanvasWorkspace.test.tsx
git commit -m "test: cover finalized scene hydration"
```

- [ ] **Step 7: Inspect the final diff**

```bash
git status --short
git log -5 --oneline
git diff HEAD~4 --check
```

Expected: no uncommitted source changes, four focused implementation commits after the design/plan commits, and no whitespace errors.
