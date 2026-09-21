# Analysis History and Current Analysis Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent analysis-history browsing, a collapsible current-analysis panel, expandable/copyable request context, persisted image restoration, and hidden scrollbars to the project canvas.

**Architecture:** Keep task selection, asset loading, composer merging, and collapsed state in `ProjectCanvas`; keep presentational request expansion and collapse controls in `AnalysisPanel`; expose one stage-background callback from `ProjectCanvasStage`. Existing workbench consumers retain their current behavior through optional props. Per the user's explicit request, execute directly on `main` rather than creating a worktree.

**Tech Stack:** React 19, TypeScript, react-konva, Vitest, Testing Library, CSS.

---

## File Map

- Modify `src/app/studio/ProjectCanvasStage.tsx`: expose a true-background pointer callback without changing design interactions.
- Modify `src/app/studio/ProjectCanvasStage.test.tsx`: cover stage background versus design clicks.
- Modify `src/app/studio/AnalysisPanel.tsx`: render collapsed state, request expansion, copy control, and panel collapse control.
- Modify `src/app/studio/AnalysisPanel.test.tsx`: cover request and collapsed-panel behavior.
- Modify `src/app/studio/ProjectCanvas.tsx`: load selected-task assets, merge copied content, keep history open, render status icons, and coordinate panel collapse.
- Modify `src/app/studio/ProjectCanvas.test.tsx`: cover history, persisted assets, copying, and canvas-driven collapse.
- Modify `src/app/studio/project-canvas.css`: style history status icons, compact collapsed control, and scrollbar suppression.
- Modify `src/app/studio/workbench.css`: style the request row/details and hide the analysis-body scrollbar without changing workbench layout.

### Task 1: Add an explicit canvas-background event

**Files:**
- Modify: `src/app/studio/ProjectCanvasStage.tsx`
- Test: `src/app/studio/ProjectCanvasStage.test.tsx`

- [ ] **Step 1: Write the failing stage-interaction tests**

Extend the `react-konva` mock so its `Stage` exposes pointer-start behavior and the image button stops propagation through the Konva event object:

```tsx
type KonvaMockProps = {
  children?: ReactNode;
  onClick?: (event: { cancelBubble: boolean }) => void;
  onDblClick?: (event: { cancelBubble: boolean }) => void;
  onMouseDown?: (event: { target: { getClassName: () => string } }) => void;
  stroke?: string;
};

vi.mock('react-konva', () => ({
  Stage: ({ children, onMouseDown }: KonvaMockProps) => (
    <div
      data-testid="konva-stage"
      onMouseDown={() => onMouseDown?.({ target: { getClassName: () => 'Stage' } })}
    >
      {children}
    </div>
  ),
  Layer: ({ children }: KonvaMockProps) => <div>{children}</div>,
  Rect: () => <div />,
  Image: ({ onClick, onDblClick, stroke }: KonvaMockProps) => (
    <button
      type="button"
      data-testid="design-image"
      data-stroke={stroke}
      onClick={(domEvent) => {
        domEvent.stopPropagation();
        onClick?.({ cancelBubble: false });
      }}
      onDoubleClick={(domEvent) => {
        domEvent.stopPropagation();
        onDblClick?.({ cancelBubble: false });
      }}
    />
  ),
}));
```

Add two tests:

```tsx
it('reports a true canvas background press', () => {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
  const onCanvasBackground = vi.fn();
  render(<ProjectCanvasStage projectId="project-1" designs={[]} onSelect={vi.fn()} onCanvasBackground={onCanvasBackground} />);

  fireEvent.mouseDown(screen.getByTestId('konva-stage'));

  expect(onCanvasBackground).toHaveBeenCalledOnce();
});

it('does not report a design press as canvas background', () => {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Chrome');
  const onCanvasBackground = vi.fn();
  render(
    <ProjectCanvasStage
      projectId="project-1"
      designs={[{ id: 'design-1', assetId: 'asset-1', sourceTaskId: 'generation-1', width: 1080, height: 1440, title: 'Poster', createdAt: '2026-09-21T00:00:00.000Z' }]}
      onSelect={vi.fn()}
      onCanvasBackground={onCanvasBackground}
    />,
  );

  fireEvent.click(screen.getByTestId('design-image'));

  expect(onCanvasBackground).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvasStage.test.tsx
```

Expected: FAIL because `onCanvasBackground` is not a `ProjectCanvasStage` prop and is never called.

- [ ] **Step 3: Implement the minimal callback**

Add the optional prop:

```ts
onCanvasBackground?: () => void;
```

Destructure it and call it only from the existing stage/layer branch in `handlePointerDown`:

```ts
const handlePointerDown = (rawEvent: unknown): void => {
  const event = rawEvent as StageEvent;
  const className = event.target.getClassName?.();
  if (className !== 'Stage' && className !== 'Layer') return;
  const stage = stageRef.current;
  const pointer = stage?.getPointerPosition?.() ?? { x: 0, y: 0 };
  dragRef.current = { start: pointer, viewport };
  onSelect(null);
  onCanvasBackground?.();
};
```

- [ ] **Step 4: Run the test and verify GREEN**

Run the Task 1 command again. Expected: all `ProjectCanvasStage` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/studio/ProjectCanvasStage.tsx src/app/studio/ProjectCanvasStage.test.tsx
git commit -m "feat: report project canvas background presses"
```

### Task 2: Add current-analysis collapse and request controls

**Files:**
- Modify: `src/app/studio/AnalysisPanel.tsx`
- Test: `src/app/studio/AnalysisPanel.test.tsx`

- [ ] **Step 1: Write failing request-expansion and action tests**

Import `fireEvent`, define a preview attachment, and add tests that exercise the public component behavior:

```tsx
const attachment = {
  assetId: 'asset-1',
  name: 'reference.png',
  mimeType: 'image/png',
  bytes: new Uint8Array([1, 2, 3]),
  previewUrl: 'data:image/png;base64,AQID',
};

it('shows one request line until the user expands its text and images', () => {
  render(
    <AnalysisPanel
      locale="zh-CN"
      message="第一行需求\n第二行补充"
      attachments={[attachment]}
      task={task('分析内容')}
      canGenerate={false}
      onGenerate={vi.fn()}
    />,
  );

  expect(screen.getByText('第一行需求 第二行补充')).toHaveClass('workbench-analysis-panel__request-line');
  expect(screen.queryByRole('img', { name: 'reference.png' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '展开本轮输入' }));

  expect(screen.getByTestId('analysis-request-details')).toHaveTextContent('第一行需求 第二行补充');
  expect(screen.getByRole('img', { name: 'reference.png' })).toBeVisible();
});

it('copies the current request payload and collapses the full panel', () => {
  const onCopyRequest = vi.fn();
  const onCollapse = vi.fn();
  render(
    <AnalysisPanel
      locale="zh-CN"
      message="生成春季主视觉"
      attachments={[attachment]}
      task={task('分析内容')}
      canGenerate={false}
      onGenerate={vi.fn()}
      onCopyRequest={onCopyRequest}
      onCollapse={onCollapse}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '复制到对话框' }));
  fireEvent.click(screen.getByRole('button', { name: '收起本轮分析' }));

  expect(onCopyRequest).toHaveBeenCalledWith({ message: '生成春季主视觉', attachments: [attachment] });
  expect(onCollapse).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Write the failing collapsed-state test**

```tsx
it('renders only the animated dots and expand action while collapsed', () => {
  const onExpand = vi.fn();
  render(
    <AnalysisPanel
      locale="zh-CN"
      message="生成春季主视觉"
      attachments={[]}
      task={task('分析内容')}
      canGenerate={false}
      onGenerate={vi.fn()}
      collapsed
      onExpand={onExpand}
    />,
  );

  expect(screen.getByTestId('collapsed-analysis-dots').children).toHaveLength(3);
  expect(screen.queryByText('分析内容')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '展开本轮分析' }));
  expect(onExpand).toHaveBeenCalledOnce();
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/AnalysisPanel.test.tsx
```

Expected: FAIL because the new props, labels, request details, and collapsed representation do not exist.

- [ ] **Step 4: Implement the public props and resettable request expansion**

Export the attachment type and extend props:

```ts
export type AnalysisPanelAttachment = ConversationImageAttachment & {
  assetId?: string;
  previewUrl: string;
};

export type AnalysisPanelRequest = {
  message: string;
  attachments: AnalysisPanelAttachment[];
};

export type AnalysisPanelProps = {
  locale: Locale;
  message: string;
  attachments: AnalysisPanelAttachment[];
  task?: TaskRecord;
  canGenerate: boolean;
  collapsed?: boolean;
  onGenerate: () => void;
  onRetry?: () => void;
  onCopyRequest?: (request: AnalysisPanelRequest) => void;
  onCollapse?: () => void;
  onExpand?: () => void;
};
```

Use request-local state and reset it whenever the displayed task changes:

```ts
const [requestExpanded, setRequestExpanded] = useState(false);
useEffect(() => setRequestExpanded(false), [task?.id]);
const requestSummary = message.replace(/\s+/gu, ' ').trim();
```

- [ ] **Step 5: Implement the collapsed representation**

Return before the full panel markup when `collapsed` is true:

```tsx
if (collapsed) {
  return (
    <aside className="workbench-analysis-panel workbench-analysis-panel--collapsed" aria-label={locale === 'zh-CN' ? '本轮分析已收起' : 'Current analysis collapsed'}>
      <span className="workbench-analysis-panel__streaming" data-testid="collapsed-analysis-dots" aria-hidden="true"><span /><span /><span /></span>
      <IconButton name="chevron-down" label={locale === 'zh-CN' ? '展开本轮分析' : 'Expand current analysis'} onClick={onExpand} />
    </aside>
  );
}
```

- [ ] **Step 6: Replace the header with the approved request row**

Use one ellipsized line and right-edge actions when `onCopyRequest` or `onCollapse` is provided. When neither prop is provided, retain the existing header markup so the document workbench does not change:

```tsx
<div className="workbench-analysis-panel__header">
  <div className="workbench-analysis-panel__request">
    <p>{locale === 'zh-CN' ? '本轮分析' : 'Current analysis'}</p>
    <strong className="workbench-analysis-panel__request-line" title={message}>
      {requestSummary || (locale === 'zh-CN' ? '等待输入' : 'Waiting for input')}
    </strong>
  </div>
  {onCopyRequest && <IconButton name="copy" label={locale === 'zh-CN' ? '复制到对话框' : 'Copy to conversation'} onClick={() => onCopyRequest({ message, attachments })} />}
  <IconButton
    name="chevron-down"
    className={`workbench-analysis-panel__request-toggle${requestExpanded ? ' is-expanded' : ''}`}
    label={locale === 'zh-CN' ? (requestExpanded ? '收起本轮输入' : '展开本轮输入') : (requestExpanded ? 'Collapse current request' : 'Expand current request')}
    aria-expanded={requestExpanded}
    onClick={() => setRequestExpanded((value) => !value)}
  />
  {onCollapse && <IconButton className="workbench-analysis-panel__collapse" name="chevron-down" label={locale === 'zh-CN' ? '收起本轮分析' : 'Collapse current analysis'} onClick={onCollapse} />}
</div>
{requestExpanded && (
  <div className="workbench-analysis-panel__request-details" data-testid="analysis-request-details">
    <p>{message}</p>
    {attachments.length > 0 && <div className="workbench-analysis-panel__attachments">{attachments.map((attachment) => <img key={attachment.assetId ?? attachment.previewUrl} src={attachment.previewUrl} alt={attachment.name} />)}</div>}
  </div>
)}
```

Wrap that approved header in `const enhancedRequest = Boolean(onCopyRequest || onCollapse)` and use the pre-existing header branch when `enhancedRequest` is false. Keep the analysis body, failure state, streaming behavior, generation footer, and workbench rendering unchanged.

- [ ] **Step 7: Run the test and verify GREEN**

Run the Task 2 command again. Expected: all `AnalysisPanel` tests PASS.

- [ ] **Step 8: Run the workbench regression test**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/Workbench.test.tsx
```

Expected: the known baseline Workbench failure may remain, but there must be no new failure caused by the optional `AnalysisPanel` props. Record the exact baseline result before proceeding.

- [ ] **Step 9: Commit**

```bash
git add src/app/studio/AnalysisPanel.tsx src/app/studio/AnalysisPanel.test.tsx
git commit -m "feat: add current analysis request controls"
```

### Task 3: Load persisted request images and merge copied content

**Files:**
- Modify: `src/app/studio/ProjectCanvas.tsx`
- Test: `src/app/studio/ProjectCanvas.test.tsx`

- [ ] **Step 1: Extend the `ProjectCanvasStage` test mock contract**

Add `onCanvasBackground?: () => void` to `StageMockProps` and expose a button beside the mocked designs:

```tsx
<button type="button" aria-label="画布空白" onClick={onCanvasBackground}>画布空白</button>
```

This lets component-level tests verify that a stage background action reaches the panel state.

- [ ] **Step 2: Write the failing persisted-image and copy-merge test**

Provide a selected analysis with `contextAssetIds: ['asset-1']`, mock `listAssets` and `readAsset`, start the composer with existing text and an existing asset, select the analysis, expand its request, and copy it:

```tsx
const renderProjectCanvas = () => render(
  <ProjectCanvas
    locale="zh-CN"
    project={{ id: 'project-1', workspaceId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [], documents: 0 }}
    workspaceId="workspace-1"
    readOnly={false}
    conversationConnected
    designer={null}
    notify={vi.fn()}
    onBack={vi.fn()}
    onConnections={vi.fn()}
    onSubmitConversation={vi.fn(async () => null)}
    onSubmitDesignGeneration={vi.fn(async () => null)}
  />,
);

it('loads a selected analysis image and appends its request to the conversation draft once', async () => {
  const analysis = {
    ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z', requestText: '加入春季植物元素' }),
    source: { kind: 'project' as const, id: 'project-1' },
    contextAssetIds: ['asset-1'],
    result: { text: '使用暖色植物插画。' },
  };
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listProjectDesigns: vi.fn(async () => []),
    loadProjectCanvasLayout: vi.fn(async () => null),
    listTasks: vi.fn(async () => [analysis]),
    listAssets: vi.fn(async () => [{ id: 'asset-1', name: 'plant.png', format: 'PNG', mimeType: 'image/png', contentHash: 'hash-1', managed: true }]),
    readAsset: vi.fn(async () => new Uint8Array([1, 2, 3])),
  };
  renderProjectCanvas();

  fireEvent.change(screen.getByLabelText('设计需求'), { target: { value: '保留现有草稿' } });
  fireEvent.click(await screen.findByRole('button', { name: /分析历史/u }));
  fireEvent.click(screen.getByRole('button', { name: /加入春季植物元素/u }));
  fireEvent.click(screen.getByRole('button', { name: '展开本轮输入' }));
  expect(await screen.findByRole('img', { name: 'plant.png' })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: '复制到对话框' }));
  fireEvent.click(screen.getByRole('button', { name: '复制到对话框' }));

  expect(screen.getByLabelText('设计需求')).toHaveValue('保留现有草稿\n\n加入春季植物元素');
  expect(screen.getByRole('button', { name: '预览 plant.png' })).toBeVisible();
  expect(screen.getAllByRole('button', { name: '预览 plant.png' })).toHaveLength(1);
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx
```

Expected: FAIL because task assets are not loaded and `AnalysisPanel` copy is not wired to the composer.

- [ ] **Step 4: Add an attachment identity helper**

In `ProjectCanvas.tsx`, add:

```ts
const attachmentIdentity = (attachment: ConversationDockAttachment): string => {
  if (attachment.assetId) return `asset:${attachment.assetId}`;
  return `upload:${attachment.name}:${attachment.mimeType}:${Array.from(attachment.bytes).join(',')}`;
};
```

- [ ] **Step 5: Load the selected task’s persisted image assets**

Replace the submit-only attachment display assumption with an effect keyed by the displayed task:

```ts
const analysisAssetKey = (analysisTask?.contextAssetIds ?? []).join('\0');

useEffect(() => {
  let cancelled = false;
  const assetIds = analysisAssetKey ? analysisAssetKey.split('\0') : [];
  if (!workspaceId || assetIds.length === 0) {
    setAnalysisAttachments([]);
    return () => { cancelled = true; };
  }
  void (async () => {
    const managed = await getDesktopApi().listAssets?.({ workspaceId, projectId: project.id, includeContextAssets: true }) ?? [];
    const byId = new Map(managed.map((asset) => [asset.id, asset]));
    const loaded = await Promise.all(assetIds.map(async (assetId) => {
      const asset = byId.get(assetId);
      if (!asset?.mimeType.startsWith('image/')) return null;
      const bytes = await getDesktopApi().readAsset?.({ workspaceId, projectId: project.id, assetId });
      if (!bytes) return null;
      return { assetId, name: asset.name, mimeType: asset.mimeType, bytes, previewUrl: bytesToDataUrl(asset.mimeType, bytes) } satisfies ConversationDockAttachment;
    }));
    if (!cancelled) setAnalysisAttachments(loaded.filter((entry): entry is ConversationDockAttachment => entry !== null));
  })();
  return () => { cancelled = true; };
}, [analysisAssetKey, analysisTask?.id, project.id, workspaceId]);
```

- [ ] **Step 6: Wire copy-and-merge behavior**

Add:

```ts
const copyAnalysisRequest = ({ message: copiedMessage, attachments: copiedAttachments }: AnalysisPanelRequest): void => {
  const normalized = copiedMessage.trim();
  if (normalized) {
    setMessage((current) => {
      const existing = current.trimEnd();
      if (!existing) return normalized;
      if (existing.endsWith(normalized)) return current;
      return `${existing}\n\n${normalized}`;
    });
  }
  setAttachments((current) => {
    const identities = new Set(current.map(attachmentIdentity));
    return [...current, ...copiedAttachments.filter((attachment) => {
      const identity = attachmentIdentity(attachment);
      if (identities.has(identity)) return false;
      identities.add(identity);
      return true;
    })];
  });
  setReferencedAssetIds((current) => [...new Set([...current, ...copiedAttachments.flatMap((attachment) => attachment.assetId ? [attachment.assetId] : [])])]);
};
```

Import `AnalysisPanelRequest` and pass `onCopyRequest={copyAnalysisRequest}` to the project-canvas `AnalysisPanel`.

- [ ] **Step 7: Run the focused test and verify GREEN**

Run the Task 3 command again. Expected: all `ProjectCanvas` tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvas.test.tsx
git commit -m "feat: copy analysis requests into conversation"
```

### Task 4: Keep history open, add status icons, and coordinate collapse

**Files:**
- Modify: `src/app/studio/ProjectCanvas.tsx`
- Test: `src/app/studio/ProjectCanvas.test.tsx`

- [ ] **Step 1: Write failing history and collapse tests**

Add separate tests for each behavior:

```tsx
const analysisTask = (id: string, state: TaskRecord['state'], requestText: string, createdAt: string): TaskRecord => ({
  ...conversation({ id, createdAt, requestText, state }),
  source: { kind: 'project', id: 'project-1' },
  result: state === 'completed' ? { text: `${requestText}结果` } : undefined,
});

const renderProjectCanvasWithTasks = (taskRecords: TaskRecord[]) => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listProjectDesigns: vi.fn(async () => []),
    loadProjectCanvasLayout: vi.fn(async () => null),
    listTasks: vi.fn(async () => taskRecords),
  };
  return render(
    <ProjectCanvas
      locale="zh-CN"
      project={{ id: 'project-1', workspaceId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [], documents: 0 }}
      workspaceId="workspace-1"
      readOnly={false}
      conversationConnected
      designer={null}
      notify={vi.fn()}
      onBack={vi.fn()}
      onConnections={vi.fn()}
      onSubmitConversation={vi.fn(async () => null)}
      onSubmitDesignGeneration={vi.fn(async () => null)}
    />,
  );
};

it('keeps analysis history open and shows status icons after selecting an item', async () => {
  const completedAnalysis = analysisTask('analysis-1', 'completed', '第一轮分析', '2026-09-21T10:00:00.000Z');
  const runningAnalysis = analysisTask('analysis-2', 'running', '第二轮分析', '2026-09-21T11:00:00.000Z');
  const failedAnalysis = analysisTask('analysis-3', 'failed', '第三轮分析', '2026-09-21T12:00:00.000Z');
  renderProjectCanvasWithTasks([completedAnalysis, runningAnalysis, failedAnalysis]);
  fireEvent.click(await screen.findByRole('button', { name: /分析历史/u }));

  expect(screen.getByTestId('analysis-status-completed')).toBeInTheDocument();
  expect(screen.getByTestId('analysis-status-running')).toBeInTheDocument();
  expect(screen.getByTestId('analysis-status-failed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /第一轮分析/u }));

  expect(screen.getByRole('button', { name: /第二轮分析/u })).toBeVisible();
});

it('collapses on canvas background and expands when a history item is selected', async () => {
  const completedAnalysis = analysisTask('analysis-1', 'completed', '第一轮分析', '2026-09-21T10:00:00.000Z');
  renderProjectCanvasWithTasks([completedAnalysis]);
  fireEvent.click(await screen.findByRole('button', { name: '画布空白' }));
  expect(screen.getByTestId('collapsed-analysis-dots')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /分析历史/u }));
  fireEvent.click(screen.getByRole('button', { name: /第一轮分析/u }));
  expect(screen.queryByTestId('collapsed-analysis-dots')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx
```

Expected: FAIL because the list still closes, status icons do not exist, and the panel has no coordinated collapsed state.

- [ ] **Step 3: Add and reset the collapsed state**

Add:

```ts
const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
```

Reset it in the existing project-change effect:

```ts
setAnalysisCollapsed(false);
```

- [ ] **Step 4: Keep history open and expand the selected analysis**

Change `selectAnalysis` to:

```ts
const selectAnalysis = (taskId: string): void => {
  setSelectedAnalysisTaskId(taskId);
  setSelectedDesignIds(designs.filter((design) => design.sourceConversationTaskId === taskId).map((design) => design.id));
  setAnalysisCollapsed(false);
};
```

- [ ] **Step 5: Add status-icon mapping and rename the history UI**

Add a small mapping function:

```ts
const analysisStatus = (task: TaskRecord): { icon: string; kind: 'completed' | 'running' | 'failed'; label: string } => {
  if (task.state === 'completed') return { icon: 'circle-check', kind: 'completed', label: t(locale, '已完成', 'Completed') };
  if (task.state === 'failed' || task.state === 'cancelled') return { icon: 'circle-alert', kind: 'failed', label: t(locale, '失败', 'Failed') };
  return { icon: 'clock', kind: 'running', label: t(locale, '处理中', 'Processing') };
};
```

Render the icon before each item’s text:

```tsx
const status = analysisStatus(task);
return (
  <button type="button" className={`project-canvas-analysis-history__item${task.id === selectedAnalysisTaskId ? ' is-selected' : ''}`} key={task.id} onClick={() => selectAnalysis(task.id)}>
    <span className={`project-canvas-analysis-history__status is-${status.kind}`} data-testid={`analysis-status-${status.kind}`}><Icon name={status.icon} size={13} /></span>
    <span className="project-canvas-analysis-history__copy"><strong>{task.requestText || t(locale, '未命名分析', 'Untitled analysis')}</strong><span>{status.label}</span></span>
  </button>
);
```

Update the section label and trigger text to `分析历史` / `Analysis history`.

- [ ] **Step 6: Wire the panel and stage collapse controls**

Pass:

```tsx
<ProjectCanvasStage
  {...existingProps}
  onCanvasBackground={() => setAnalysisCollapsed(true)}
/>
```

and:

```tsx
<AnalysisPanel
  {...existingProps}
  collapsed={analysisCollapsed}
  onCollapse={() => setAnalysisCollapsed(true)}
  onExpand={() => setAnalysisCollapsed(false)}
  onCopyRequest={copyAnalysisRequest}
/>
```

- [ ] **Step 7: Run the focused test and verify GREEN**

Run the Task 4 command again. Expected: all `ProjectCanvas` tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvas.test.tsx
git commit -m "feat: improve analysis history navigation"
```

### Task 5: Apply the approved visual treatment and hide scrollbars

**Files:**
- Modify: `src/app/studio/project-canvas.css`
- Modify: `src/app/studio/workbench.css`
- Test: `src/app/studio/AnalysisPanel.test.tsx`
- Test: `src/app/studio/ProjectCanvas.test.tsx`

- [ ] **Step 1: Add failing class-level assertions**

Add assertions that the collapsed shell, request details, and history structures receive the intended classes:

```tsx
expect(screen.getByTestId('collapsed-analysis-dots').closest('.workbench-analysis-panel')).toHaveClass('workbench-analysis-panel--collapsed');
expect(screen.getByText('第一行需求\n第二行补充').closest('.workbench-analysis-panel__request-details')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /第一轮分析/u }).querySelector('.project-canvas-analysis-history__status')).toBeInTheDocument();
```

- [ ] **Step 2: Run focused tests and verify RED where classes are absent**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/AnalysisPanel.test.tsx src/app/studio/ProjectCanvas.test.tsx
```

Expected: FAIL only for class structures not already introduced by Tasks 2–4. If all assertions pass because the markup already carries the classes, proceed directly to CSS and retain the assertions as regression coverage.

- [ ] **Step 3: Style the collapsed control and request header**

In `workbench.css`, add rules equivalent to:

```css
.workbench-analysis-panel--collapsed {
  width: auto;
  min-width: 76px;
  min-height: 36px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 6px 4px 10px;
  border-radius: 999px;
}

.workbench-analysis-panel--collapsed .workbench-analysis-panel__streaming { padding: 0; }
.workbench-analysis-panel--collapsed .icon-button { width: 26px; height: 26px; }
.workbench-analysis-panel__request { min-width: 0; flex: 1; }
.workbench-analysis-panel__request-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workbench-analysis-panel__request-details { padding: 10px 12px; border-bottom: 1px solid var(--border-subtle); }
.workbench-analysis-panel__request-details > p { margin: 0; white-space: pre-wrap; font-size: 12px; line-height: 1.55; }
.workbench-analysis-panel__request-toggle.is-expanded .ui-icon,
.workbench-analysis-panel__collapse .ui-icon { transform: rotate(180deg); }
```

Keep the approved existing radius and lower shadow for the expanded panel.

- [ ] **Step 4: Style status icons and two-column history rows**

In `project-canvas.css`, change history items to a status-column layout:

```css
.project-canvas-analysis-history__item {
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
}

.project-canvas-analysis-history__status {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-ui);
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}

.project-canvas-analysis-history__status.is-running .ui-icon { animation: project-analysis-spin 1s linear infinite; }
.project-canvas-analysis-history__status.is-failed { color: var(--warning); background: color-mix(in srgb, var(--warning) 12%, transparent); }
.project-canvas-analysis-history__copy { min-width: 0; display: grid; gap: 3px; }

@keyframes project-analysis-spin { to { transform: rotate(360deg); } }
```

Move the existing `strong` and secondary `span` selectors under `__copy` so they do not style the icon container.

- [ ] **Step 5: Hide scrollbars while preserving scrolling**

Add:

```css
.workbench-analysis-panel__body,
.workbench-analysis-panel__attachments,
.project-canvas-analysis-history__list {
  scrollbar-width: none;
}

.workbench-analysis-panel__body::-webkit-scrollbar,
.workbench-analysis-panel__attachments::-webkit-scrollbar,
.project-canvas-analysis-history__list::-webkit-scrollbar {
  display: none;
}
```

Do not remove any `overflow-y: auto` or `overflow-x: auto` declarations.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the Task 5 test command again. Expected: PASS.

- [ ] **Step 7: Run changed-file ESLint**

```bash
pnpm exec eslint src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvasStage.tsx src/app/studio/AnalysisPanel.tsx src/app/studio/ProjectCanvas.test.tsx src/app/studio/ProjectCanvasStage.test.tsx src/app/studio/AnalysisPanel.test.tsx
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/studio/project-canvas.css src/app/studio/workbench.css src/app/studio/AnalysisPanel.test.tsx src/app/studio/ProjectCanvas.test.tsx
git commit -m "style: refine project analysis surfaces"
```

### Task 6: Final verification and baseline comparison

**Files:**
- Verify all files changed by Tasks 1–5.

- [ ] **Step 1: Run the complete focused interaction suite**

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/app/studio/ProjectCanvas.test.tsx \
  src/app/studio/ProjectCanvasStage.test.tsx \
  src/app/studio/AnalysisPanel.test.tsx \
  src/app/studio/ConversationDock.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run production build**

```bash
pnpm build
```

Expected: renderer, main, and preload builds succeed. The existing large-chunk warning is acceptable.

- [ ] **Step 3: Run full lint and compare baseline**

```bash
pnpm lint
```

Expected: only the pre-existing unused-symbol errors may remain at `src/app/studio/Studio.tsx:28` and `src/app/studio/Workbench.tsx:147`; no changed file may add an error.

- [ ] **Step 4: Run full unit suite and compare baseline**

```bash
pnpm test -- --run
```

Expected: no new failures beyond the recorded baseline in `src/app/Studio.test.tsx` and `src/app/studio/Workbench.test.tsx`. Record exact counts.

- [ ] **Step 5: Run typecheck and compare baseline**

```bash
pnpm exec tsc --noEmit
```

Expected: only the pre-existing `generationRatio` mismatch at `src/app/studio/Studio.tsx:576` may remain.

- [ ] **Step 6: Check the final diff**

```bash
git diff --check
git status --short
git log --oneline -8
```

Expected: no whitespace errors; only intentional files are modified or newly committed.

- [ ] **Step 7: Commit any verification-only corrections**

If verification required a source or test correction, commit only those files:

```bash
git add src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvasStage.tsx src/app/studio/AnalysisPanel.tsx src/app/studio/project-canvas.css src/app/studio/workbench.css src/app/studio/ProjectCanvas.test.tsx src/app/studio/ProjectCanvasStage.test.tsx src/app/studio/AnalysisPanel.test.tsx
git commit -m "fix: complete analysis panel interactions"
```

If no corrections were needed, do not create an empty commit.
