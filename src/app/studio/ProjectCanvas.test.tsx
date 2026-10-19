import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectCanvas, getAnalysisHistory, getLatestConversationTask, getPendingCanvasDesigns, imageToolDesignAnchors } from './ProjectCanvas';
import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { ProjectCanvasLayout, ProjectDesign } from '../../features/projects/metadata';
import type { TaskRecord } from '../../features/tasks/state';
import type { ExportProjectDesignInput } from '../../platform/contracts';
import { imageTools, type ImageTool, type ToolParams } from '../../features/image-tools/target';

type StageMockProps = {
  designs: readonly ProjectDesign[];
  selectedDesignIds?: readonly string[];
  pendingDesigns?: ReadonlyArray<{ id: string; width: number; height: number }>;
  onSelect: (designId: string | null) => void;
  onAddToConversation?: (designId: string) => void;
  onCanvasBackground?: () => void;
  onImportImages?: (files: readonly File[]) => void;
  children?: ReactNode;
};

vi.mock('./ProjectCanvasStage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ProjectCanvasStage')>()),
  ProjectCanvasStage: ({ designs, selectedDesignIds = [], pendingDesigns = [], onSelect, onAddToConversation, onCanvasBackground, onImportImages }: StageMockProps) => (
    <div
      aria-label="设计画布内容"
      data-testid="project-canvas-stage"
      onDrop={(event) => onImportImages?.(Array.from(event.dataTransfer.files))}
    >
      <button type="button" aria-label="画布空白" onClick={onCanvasBackground}>画布空白</button>
      {pendingDesigns.map((design) => <span key={design.id} aria-label={`正在处理图片 ${design.id}`}>{design.width} × {design.height}</span>)}
      {designs.map((design) => (
        <button
          type="button"
          key={design.id}
          aria-label={`设计稿 ${design.title}`}
          aria-pressed={selectedDesignIds.includes(design.id)}
          onClick={() => onSelect(design.id)}
          onDoubleClick={() => onAddToConversation?.(design.id)}
        >
          {design.title}
        </button>
      ))}
    </div>
  ),
}));

const originalDesktopApi = window.designhub;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

afterEach(() => {
  vi.useRealTimers();
  window.designhub = originalDesktopApi;
});

const conversation = (input: Partial<TaskRecord> & Pick<TaskRecord, 'id' | 'createdAt'>): TaskRecord => ({
  id: input.id,
  requestId: `${input.id}-request`,
  requestText: input.requestText ?? input.id,
  state: input.state ?? 'completed',
  cancelRequested: false,
  attempt: 1,
  capability: 'conversation',
  analysisThreadId: input.analysisThreadId ?? 'thread-1',
  createdAt: input.createdAt,
});

type SubmitConversation = (message: string, attachments: ConversationImageAttachment[], context?: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] }) => Promise<TaskRecord | null>;

const renderProjectCanvasWithTasks = (taskRecords: TaskRecord[], onSubmitConversation: SubmitConversation = vi.fn(async () => null)) => {
  window.designhub = {
    listProjectDesigns: vi.fn(async () => []),
    loadProjectCanvasLayout: vi.fn(async () => null),
    listTasks: vi.fn(async () => taskRecords),
  };
  return render(
    <ProjectCanvas
      locale="zh-CN"
      project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [] }}
      libraryId="workspace-1"
      readOnly={false}
      conversationConnected
      designer={null}
      notify={vi.fn()}
      onBack={vi.fn()}
      onConnections={vi.fn()}
      onSubmitConversation={onSubmitConversation}
      onSubmitDesignGeneration={vi.fn(async () => null)}
    />,
  );
};

describe('getAnalysisHistory', () => {
  it('includes the displayed analysis, orders newest first, and counts every conversation in the thread', () => {
    const older = conversation({ id: 'older', createdAt: '2026-09-20T10:00:00.000Z' });
    const displayed = conversation({ id: 'latest', createdAt: '2026-09-21T10:00:00.000Z' });
    const middle = conversation({ id: 'middle', createdAt: '2026-09-20T12:00:00.000Z' });
    const unrelated = conversation({ id: 'other-thread', analysisThreadId: 'thread-2', createdAt: '2026-09-22T10:00:00.000Z' });

    const history = getAnalysisHistory([older, middle, unrelated], 'thread-1', displayed);

    expect(history.map((task) => task.id)).toEqual(['latest', 'middle', 'older']);
    expect(history).toHaveLength(3);
  });

  it('does not duplicate the displayed task when it is already in the task list', () => {
    const displayed = conversation({ id: 'latest', createdAt: '2026-09-21T10:00:00.000Z' });

    expect(getAnalysisHistory([displayed], 'thread-1', displayed).map((task) => task.id)).toEqual(['latest']);
  });
});

describe('getLatestConversationTask', () => {
  it('returns the newest persisted conversation task', () => {
    const older = conversation({ id: 'older', createdAt: '2026-09-20T10:00:00.000Z' });
    const latest = conversation({ id: 'latest', createdAt: '2026-09-21T10:00:00.000Z' });
    const generation = { ...latest, id: 'generation', capability: 'design-generation' };

    expect(getLatestConversationTask([older, generation, latest])?.id).toBe('latest');
  });
});

describe('getPendingCanvasDesigns', () => {
  it('creates a result-sized placeholder for a running image tool task', () => {
    const source: ProjectDesign = {
      id: 'design-source', projectId: 'project-1', assetId: 'asset-source', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '商品图', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const task: TaskRecord = {
      id: 'task-upscale', requestId: 'request-upscale', state: 'running', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: 'asset-source',
      tool: 'upscale', toolParams: { scale: 2, detail: 'balanced' },
    };

    expect(getPendingCanvasDesigns([task], [source])).toEqual([{
      id: 'task-upscale', rowKey: 'generation-1', anchorId: 'design-source', width: 1600, height: 1200, status: 'running',
    }]);
  });

  it('removes failed and cancelled image tool placeholders from the canvas layout', () => {
    const source: ProjectDesign = {
      id: 'design-source', projectId: 'project-1', assetId: 'asset-source', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '商品图', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const task: TaskRecord = {
      id: 'task-expand', requestId: 'request-expand', state: 'failed', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: 'asset-source',
      tool: 'expand', toolParams: { mode: 'original-scene', top: 100, right: 100, bottom: 100, left: 100 }, errorCode: 'RESULT_DIMENSIONS_INVALID',
    };

    expect(getPendingCanvasDesigns([
      task,
      { ...task, id: 'task-cancelled', state: 'cancelled' },
    ], [source])).toEqual([]);
  });

  it('keeps an unknown image tool placeholder visible because the remote result is unresolved', () => {
    const source: ProjectDesign = {
      id: 'design-source', projectId: 'project-1', assetId: 'asset-source', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '商品图', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const task: TaskRecord = {
      id: 'task-expand', requestId: 'request-expand', state: 'unknown', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: 'asset-source',
      tool: 'expand', toolParams: { mode: 'original-scene', top: 100, right: 100, bottom: 100, left: 100 },
    };

    expect(getPendingCanvasDesigns([task], [source])).toEqual([{
      id: 'task-expand', rowKey: 'generation-1', anchorId: 'design-source', width: 1000, height: 800, status: 'unknown',
    }]);
  });

  it('uses the selected source design id instead of an ambiguous asset match', () => {
    const first: ProjectDesign = {
      id: 'design-first', projectId: 'project-1', assetId: 'asset-shared', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '第一张', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const selected: ProjectDesign = { ...first, id: 'design-selected', title: '选中图片' };
    const task: TaskRecord = {
      id: 'task-selected', requestId: 'request-selected', state: 'running', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: 'asset-shared', sourceDesignId: 'design-selected',
      tool: 'remove-background', toolParams: { edgeRefinement: 50 },
    };

    expect(getPendingCanvasDesigns([task], [first, selected])).toEqual([{
      id: 'task-selected', rowKey: 'generation-1', anchorId: 'design-selected', width: 800, height: 600, status: 'running',
    }]);
  });

  it('ignores settled image tool tasks and unrelated tasks', () => {
    const source: ProjectDesign = {
      id: 'design-source', projectId: 'project-1', assetId: 'asset-source', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '商品图', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const base: TaskRecord = {
      id: 'task-edit', requestId: 'request-edit', state: 'completed', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: 'asset-source',
      tool: 'remove-background', toolParams: { edgeRefinement: 50 },
    };

    expect(getPendingCanvasDesigns([
      base,
      { ...base, id: 'conversation', capability: 'conversation', state: 'running' },
    ], [source])).toEqual([]);
  });

  it('removes the placeholder as soon as its persisted result is available', () => {
    const source: ProjectDesign = {
      id: 'design-source', projectId: 'project-1', assetId: 'asset-source', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '商品图', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const result: ProjectDesign = {
      id: 'design-result', projectId: 'project-1', assetId: 'asset-result', sourceTaskId: 'task-edit',
      width: 800, height: 600, title: '商品图（去除背景）', createdAt: '2026-10-10T00:01:00.000Z',
    };
    const task: TaskRecord = {
      id: 'task-edit', requestId: 'request-edit', state: 'running', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: 'asset-source',
      tool: 'remove-background', toolParams: { edgeRefinement: 50 },
    };

    expect(getPendingCanvasDesigns([task], [source, result])).toEqual([]);
  });

  it('does not duplicate a placeholder when the result asset is persisted before its task linkage is repaired', () => {
    const source: ProjectDesign = {
      id: 'design-source', projectId: 'project-1', assetId: 'asset-source', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '商品图', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const result: ProjectDesign = {
      id: 'design-result', projectId: 'project-1', assetId: 'asset-result', sourceTaskId: 'legacy-source-task',
      width: 800, height: 600, title: '商品图（去除背景）', createdAt: '2026-10-10T00:01:00.000Z',
    };
    const task: TaskRecord = {
      id: 'task-edit', requestId: 'request-edit', state: 'running', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: 'asset-source',
      tool: 'remove-background', toolParams: { edgeRefinement: 50 }, result: { assetIds: ['asset-result'] },
    };

    expect(getPendingCanvasDesigns([task], [source, result])).toEqual([]);
  });
});

describe('image tool layout references', () => {
  it('anchors a legacy result through the task output asset when sourceTaskId is stale', () => {
    const source: ProjectDesign = {
      id: 'design-source', projectId: 'project-1', assetId: 'asset-source', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '商品图', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const result: ProjectDesign = {
      id: 'design-result', projectId: 'project-1', assetId: 'asset-result', sourceTaskId: 'legacy-source-task',
      width: 800, height: 600, title: '商品图（去除背景）', createdAt: '2026-10-10T00:01:00.000Z',
    };
    const task: TaskRecord = {
      id: 'task-edit', requestId: 'request-edit', state: 'completed', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: 'asset-source', sourceDesignId: 'design-source',
      tool: 'remove-background', toolParams: { edgeRefinement: 50 }, result: { assetIds: ['asset-result'] },
    };

    expect(imageToolDesignAnchors([task], [source, result])).toEqual({ 'design-result': 'design-source' });
  });
});

describe('ProjectCanvas design references', () => {
  it('restores the persisted image selection when the canvas refreshes', async () => {
    const design: ProjectDesign = {
      id: 'design-selected', projectId: 'project-1', assetId: 'asset-selected', sourceTaskId: 'task-1',
      width: 800, height: 600, title: '已选图片', createdAt: '2026-10-14T00:00:00.000Z',
    };
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => ({
        viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 },
        nodes: { [design.id]: { x: 120, y: 80 } },
        selectedDesignIds: [design.id],
      })),
      listTasks: vi.fn(async () => []),
    };

    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design] }}
        libraryId="workspace-1"
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

    expect(await screen.findByRole('button', { name: '设计稿 已选图片' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('debounces image selection changes into one complete layout save', async () => {
    vi.useFakeTimers();
    const designs: ProjectDesign[] = [
      { id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'task-1', width: 800, height: 600, title: '图片一', createdAt: '2026-10-14T00:00:00.000Z' },
      { id: 'design-2', projectId: 'project-1', assetId: 'asset-2', sourceTaskId: 'task-1', width: 800, height: 600, title: '图片二', createdAt: '2026-10-14T00:01:00.000Z' },
    ];
    const layout = {
      viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 },
      nodes: { 'design-1': { x: 120, y: 80 }, 'design-2': { x: 944, y: 80 } },
      selectedDesignIds: [] as string[],
    };
    const saveProjectCanvasLayout = vi.fn(async ({ layout: savedLayout }: { libraryId: string; projectId: string; layout: ProjectCanvasLayout }) => savedLayout);
    window.designhub = {
      listProjectDesigns: vi.fn(async () => designs),
      loadProjectCanvasLayout: vi.fn(async () => layout),
      saveProjectCanvasLayout,
      listTasks: vi.fn(async () => []),
    };

    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs, canvasLayout: layout }}
        libraryId="workspace-1"
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
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: '设计稿 图片一' }));
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.click(screen.getByRole('button', { name: '设计稿 图片二' }));
    act(() => { vi.advanceTimersByTime(249); });
    expect(saveProjectCanvasLayout).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(saveProjectCanvasLayout).toHaveBeenCalledOnce();
    expect(saveProjectCanvasLayout).toHaveBeenCalledWith({
      libraryId: 'workspace-1',
      projectId: 'project-1',
      layout: { ...layout, selectedDesignIds: ['design-2'] },
    });
  });

  it('flushes a pending image selection when the canvas unmounts', async () => {
    vi.useFakeTimers();
    const design: ProjectDesign = {
      id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'task-1',
      width: 800, height: 600, title: '待保存图片', createdAt: '2026-10-14T00:00:00.000Z',
    };
    const layout: ProjectCanvasLayout = {
      viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 },
      nodes: { 'design-1': { x: 120, y: 80 } },
      selectedDesignIds: [],
    };
    const saveProjectCanvasLayout = vi.fn(async ({ layout: savedLayout }: { libraryId: string; projectId: string; layout: ProjectCanvasLayout }) => savedLayout);
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => layout),
      saveProjectCanvasLayout,
      listTasks: vi.fn(async () => []),
    };
    const view = render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design], canvasLayout: layout }}
        libraryId="workspace-1"
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
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: '设计稿 待保存图片' }));
    view.unmount();

    expect(saveProjectCanvasLayout).toHaveBeenCalledWith({
      libraryId: 'workspace-1',
      projectId: 'project-1',
      layout: { ...layout, selectedDesignIds: ['design-1'] },
    });
  });

  it('does not let a stale refresh overwrite a selection whose save just completed', async () => {
    vi.useFakeTimers();
    const design: ProjectDesign = {
      id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'task-1',
      width: 800, height: 600, title: '竞态图片', createdAt: '2026-10-14T00:00:00.000Z',
    };
    const oldLayout: ProjectCanvasLayout = {
      viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 },
      nodes: { 'design-1': { x: 120, y: 80 } },
      selectedDesignIds: [],
    };
    const staleLayoutRead = deferred<ProjectCanvasLayout | null>();
    const slowTaskRead = deferred<TaskRecord[] | null>();
    const saveResult = deferred<ProjectCanvasLayout | null>();
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(() => staleLayoutRead.promise),
      saveProjectCanvasLayout: vi.fn(() => saveResult.promise),
      listTasks: vi.fn(() => slowTaskRead.promise),
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design], canvasLayout: oldLayout }}
        libraryId="workspace-1"
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

    fireEvent.click(screen.getByRole('button', { name: '设计稿 竞态图片' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    await act(async () => {
      saveResult.resolve({ ...oldLayout, selectedDesignIds: ['design-1'] });
      await Promise.resolve();
    });
    await act(async () => {
      staleLayoutRead.resolve(oldLayout);
      slowTaskRead.resolve([]);
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: '设计稿 竞态图片' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('serializes debounced layout saves so an older request cannot finish last', async () => {
    vi.useFakeTimers();
    const designs: ProjectDesign[] = [
      { id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'task-1', width: 800, height: 600, title: '图片一', createdAt: '2026-10-14T00:00:00.000Z' },
      { id: 'design-2', projectId: 'project-1', assetId: 'asset-2', sourceTaskId: 'task-1', width: 800, height: 600, title: '图片二', createdAt: '2026-10-14T00:01:00.000Z' },
    ];
    const layout: ProjectCanvasLayout = {
      viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 },
      nodes: { 'design-1': { x: 120, y: 80 }, 'design-2': { x: 944, y: 80 } },
      selectedDesignIds: [],
    };
    const saves: Array<ReturnType<typeof deferred<ProjectCanvasLayout | null>>> = [];
    const savedInputs: Array<{ libraryId: string; projectId: string; layout: ProjectCanvasLayout }> = [];
    const saveProjectCanvasLayout = vi.fn((input: { libraryId: string; projectId: string; layout: ProjectCanvasLayout }) => {
      savedInputs.push(input);
      const result = deferred<ProjectCanvasLayout | null>();
      saves.push(result);
      return result.promise;
    });
    window.designhub = {
      listProjectDesigns: vi.fn(async () => designs),
      loadProjectCanvasLayout: vi.fn(async () => layout),
      saveProjectCanvasLayout,
      listTasks: vi.fn(async () => []),
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs, canvasLayout: layout }}
        libraryId="workspace-1"
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
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: '设计稿 图片一' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    fireEvent.click(screen.getByRole('button', { name: '设计稿 图片二' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });

    expect(saveProjectCanvasLayout).toHaveBeenCalledOnce();
    await act(async () => {
      saves[0]!.resolve({ ...layout, selectedDesignIds: ['design-1'] });
      await Promise.resolve();
    });
    expect(saveProjectCanvasLayout).toHaveBeenCalledTimes(2);
    expect(savedInputs[1]?.layout.selectedDesignIds).toEqual(['design-2']);
    saves[1]!.resolve({ ...layout, selectedDesignIds: ['design-2'] });
  });

  it('keeps the full debounce window for an edit queued behind an in-flight save', async () => {
    vi.useFakeTimers();
    const designs: ProjectDesign[] = [
      { id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'task-1', width: 800, height: 600, title: '图片一', createdAt: '2026-10-14T00:00:00.000Z' },
      { id: 'design-2', projectId: 'project-1', assetId: 'asset-2', sourceTaskId: 'task-1', width: 800, height: 600, title: '图片二', createdAt: '2026-10-14T00:01:00.000Z' },
    ];
    const layout: ProjectCanvasLayout = {
      viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 },
      nodes: { 'design-1': { x: 120, y: 80 }, 'design-2': { x: 944, y: 80 } },
      selectedDesignIds: [],
    };
    const saves: Array<ReturnType<typeof deferred<ProjectCanvasLayout | null>>> = [];
    const saveProjectCanvasLayout = vi.fn((_input: { libraryId: string; projectId: string; layout: ProjectCanvasLayout }) => {
      void _input;
      const result = deferred<ProjectCanvasLayout | null>();
      saves.push(result);
      return result.promise;
    });
    window.designhub = {
      listProjectDesigns: vi.fn(async () => designs),
      loadProjectCanvasLayout: vi.fn(async () => layout),
      saveProjectCanvasLayout,
      listTasks: vi.fn(async () => []),
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs, canvasLayout: layout }}
        libraryId="workspace-1"
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
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: '设计稿 图片一' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    fireEvent.click(screen.getByRole('button', { name: '设计稿 图片二' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    await act(async () => {
      saves[0]!.resolve({ ...layout, selectedDesignIds: ['design-1'] });
      await Promise.resolve();
    });

    expect(saveProjectCanvasLayout).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(149); });
    expect(saveProjectCanvasLayout).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(saveProjectCanvasLayout).toHaveBeenCalledTimes(2);
    saves[1]!.resolve({ ...layout, selectedDesignIds: ['design-2'] });
  });

  it('does not replace a pending local selection when the same project metadata updates', async () => {
    vi.useFakeTimers();
    const design: ProjectDesign = { id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'task-1', width: 800, height: 600, title: '本地选择', createdAt: '2026-10-14T00:00:00.000Z' };
    const layout: ProjectCanvasLayout = { viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 }, nodes: { 'design-1': { x: 120, y: 80 } }, selectedDesignIds: [] };
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => layout),
      saveProjectCanvasLayout: vi.fn(async ({ layout: savedLayout }) => savedLayout),
      listTasks: vi.fn(async () => []),
    };
    const props = {
      locale: 'zh-CN' as const,
      libraryId: 'workspace-1',
      readOnly: false,
      conversationConnected: true,
      designer: null,
      notify: vi.fn(),
      onBack: vi.fn(),
      onConnections: vi.fn(),
      onSubmitConversation: vi.fn(async () => null),
      onSubmitDesignGeneration: vi.fn(async () => null),
    };
    const view = render(
      <ProjectCanvas {...props} project={{ id: 'project-1', libraryId: 'workspace-1', name: '原名称', enName: 'Original', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design], canvasLayout: layout }} />,
    );
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: '设计稿 本地选择' }));

    view.rerender(<ProjectCanvas {...props} project={{ id: 'project-1', libraryId: 'workspace-1', name: '新名称', enName: 'Renamed', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design], canvasLayout: { ...layout } }} />);

    expect(screen.getByRole('button', { name: '设计稿 本地选择' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('drains the previous project save before a new project can replace it', async () => {
    vi.useFakeTimers();
    const designsA: ProjectDesign[] = [
      { id: 'design-a1', projectId: 'project-a', assetId: 'asset-a1', sourceTaskId: 'task-a', width: 800, height: 600, title: '项目 A 图片一', createdAt: '2026-10-14T00:00:00.000Z' },
      { id: 'design-a2', projectId: 'project-a', assetId: 'asset-a2', sourceTaskId: 'task-a', width: 800, height: 600, title: '项目 A 图片二', createdAt: '2026-10-14T00:01:00.000Z' },
    ];
    const designB: ProjectDesign = { id: 'design-b', projectId: 'project-b', assetId: 'asset-b', sourceTaskId: 'task-b', width: 800, height: 600, title: '项目 B 图片', createdAt: '2026-10-14T00:00:00.000Z' };
    const layoutA: ProjectCanvasLayout = { viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 }, nodes: { 'design-a1': { x: 120, y: 80 }, 'design-a2': { x: 944, y: 80 } }, selectedDesignIds: [] };
    const layoutB: ProjectCanvasLayout = { viewport: { zoom: 0.9, offsetX: 30, offsetY: 30 }, nodes: { 'design-b': { x: 40, y: 40 } }, selectedDesignIds: [] };
    const saves: Array<ReturnType<typeof deferred<ProjectCanvasLayout | null>>> = [];
    const savedInputs: Array<{ libraryId: string; projectId: string; layout: ProjectCanvasLayout }> = [];
    const saveProjectCanvasLayout = vi.fn((input: { libraryId: string; projectId: string; layout: ProjectCanvasLayout }) => {
      savedInputs.push(input);
      const result = deferred<ProjectCanvasLayout | null>();
      saves.push(result);
      return result.promise;
    });
    window.designhub = {
      listProjectDesigns: vi.fn(async ({ projectId }) => projectId === 'project-a' ? designsA : [designB]),
      loadProjectCanvasLayout: vi.fn(async ({ projectId }) => projectId === 'project-a' ? layoutA : layoutB),
      saveProjectCanvasLayout,
      listTasks: vi.fn(async () => []),
    };
    const props = {
      locale: 'zh-CN' as const,
      libraryId: 'workspace-1',
      readOnly: false,
      conversationConnected: true,
      designer: null,
      notify: vi.fn(),
      onBack: vi.fn(),
      onConnections: vi.fn(),
      onSubmitConversation: vi.fn(async () => null),
      onSubmitDesignGeneration: vi.fn(async () => null),
    };
    const view = render(
      <ProjectCanvas {...props} project={{ id: 'project-a', libraryId: 'workspace-1', name: '项目 A', enName: 'A', description: '', enDescription: '', designers: [], artwork: 'blank', designs: designsA, canvasLayout: layoutA }} />,
    );
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: '设计稿 项目 A 图片一' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    fireEvent.click(screen.getByRole('button', { name: '设计稿 项目 A 图片二' }));

    view.rerender(<ProjectCanvas {...props} project={{ id: 'project-b', libraryId: 'workspace-1', name: '项目 B', enName: 'B', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [designB], canvasLayout: layoutB }} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: '设计稿 项目 B 图片' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(saveProjectCanvasLayout).toHaveBeenCalledOnce();

    await act(async () => {
      saves[0]!.resolve({ ...layoutA, selectedDesignIds: ['design-a1'] });
      await Promise.resolve();
    });

    expect(saveProjectCanvasLayout).toHaveBeenCalledTimes(2);
    expect(savedInputs[1]).toMatchObject({ projectId: 'project-a', layout: { selectedDesignIds: ['design-a2'] } });
    await act(async () => {
      saves[1]!.resolve({ ...layoutA, selectedDesignIds: ['design-a2'] });
      await Promise.resolve();
    });
    expect(saveProjectCanvasLayout).toHaveBeenCalledTimes(3);
    expect(savedInputs[2]).toMatchObject({ projectId: 'project-b', layout: { selectedDesignIds: ['design-b'] } });
    saves[2]!.resolve({ ...layoutB, selectedDesignIds: ['design-b'] });
  });

  it('ignores refresh results from the previously open project', async () => {
    const designA: ProjectDesign = { id: 'design-a', projectId: 'project-a', assetId: 'asset-a', sourceTaskId: 'task-a', width: 800, height: 600, title: '项目 A 图片', createdAt: '2026-10-14T00:00:00.000Z' };
    const designB: ProjectDesign = { id: 'design-b', projectId: 'project-b', assetId: 'asset-b', sourceTaskId: 'task-b', width: 800, height: 600, title: '项目 B 图片', createdAt: '2026-10-14T00:00:00.000Z' };
    const layoutA: ProjectCanvasLayout = { viewport: { zoom: 0.7, offsetX: 10, offsetY: 10 }, nodes: { 'design-a': { x: 20, y: 20 } }, selectedDesignIds: ['design-a'] };
    const layoutB: ProjectCanvasLayout = { viewport: { zoom: 0.9, offsetX: 30, offsetY: 30 }, nodes: { 'design-b': { x: 40, y: 40 } }, selectedDesignIds: ['design-b'] };
    const designsA = deferred<ProjectDesign[] | null>();
    const layoutReadA = deferred<ProjectCanvasLayout | null>();
    const tasksA = deferred<TaskRecord[] | null>();
    let taskReadCount = 0;
    window.designhub = {
      listProjectDesigns: vi.fn(({ projectId }: { projectId: string }) => projectId === 'project-a' ? designsA.promise : Promise.resolve([designB])),
      loadProjectCanvasLayout: vi.fn(({ projectId }: { projectId: string }) => projectId === 'project-a' ? layoutReadA.promise : Promise.resolve(layoutB)),
      listTasks: vi.fn(() => taskReadCount++ === 0 ? tasksA.promise : Promise.resolve([])),
    };
    const props = {
      locale: 'zh-CN' as const,
      libraryId: 'workspace-1',
      readOnly: false,
      conversationConnected: true,
      designer: null,
      notify: vi.fn(),
      onBack: vi.fn(),
      onConnections: vi.fn(),
      onSubmitConversation: vi.fn(async () => null),
      onSubmitDesignGeneration: vi.fn(async () => null),
    };
    const view = render(
      <ProjectCanvas {...props} project={{ id: 'project-a', libraryId: 'workspace-1', name: '项目 A', enName: 'A', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [designA], canvasLayout: layoutA }} />,
    );

    view.rerender(<ProjectCanvas {...props} project={{ id: 'project-b', libraryId: 'workspace-1', name: '项目 B', enName: 'B', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [designB], canvasLayout: layoutB }} />);
    expect(await screen.findByRole('button', { name: '设计稿 项目 B 图片' })).toHaveAttribute('aria-pressed', 'true');

    await act(async () => {
      designsA.resolve([designA]);
      layoutReadA.resolve(layoutA);
      tasksA.resolve([]);
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: '设计稿 项目 B 图片' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '设计稿 项目 A 图片' })).not.toBeInTheDocument();
  });

  it('shows the next project designs before its refresh completes', async () => {
    const designA: ProjectDesign = { id: 'design-a', projectId: 'project-a', assetId: 'asset-a', sourceTaskId: 'task-a', width: 800, height: 600, title: '项目 A 即时图片', createdAt: '2026-10-14T00:00:00.000Z' };
    const designB: ProjectDesign = { id: 'design-b', projectId: 'project-b', assetId: 'asset-b', sourceTaskId: 'task-b', width: 800, height: 600, title: '项目 B 即时图片', createdAt: '2026-10-14T00:00:00.000Z' };
    const layoutA: ProjectCanvasLayout = { viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 }, nodes: { 'design-a': { x: 120, y: 80 } }, selectedDesignIds: [] };
    const layoutB: ProjectCanvasLayout = { viewport: { zoom: 0.9, offsetX: 30, offsetY: 30 }, nodes: { 'design-b': { x: 40, y: 40 } }, selectedDesignIds: [] };
    const designsB = deferred<ProjectDesign[] | null>();
    const layoutReadB = deferred<ProjectCanvasLayout | null>();
    window.designhub = {
      listProjectDesigns: vi.fn(({ projectId }: { projectId: string }) => projectId === 'project-a' ? Promise.resolve([designA]) : designsB.promise),
      loadProjectCanvasLayout: vi.fn(({ projectId }: { projectId: string }) => projectId === 'project-a' ? Promise.resolve(layoutA) : layoutReadB.promise),
      listTasks: vi.fn(async () => []),
    };
    const props = {
      locale: 'zh-CN' as const,
      libraryId: 'workspace-1',
      readOnly: false,
      conversationConnected: true,
      designer: null,
      notify: vi.fn(),
      onBack: vi.fn(),
      onConnections: vi.fn(),
      onSubmitConversation: vi.fn(async () => null),
      onSubmitDesignGeneration: vi.fn(async () => null),
    };
    const view = render(
      <ProjectCanvas {...props} project={{ id: 'project-a', libraryId: 'workspace-1', name: '项目 A', enName: 'A', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [designA], canvasLayout: layoutA }} />,
    );
    await act(async () => { await Promise.resolve(); });

    view.rerender(<ProjectCanvas {...props} project={{ id: 'project-b', libraryId: 'workspace-1', name: '项目 B', enName: 'B', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [designB], canvasLayout: layoutB }} />);

    expect(screen.getByRole('button', { name: '设计稿 项目 B 即时图片' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '设计稿 项目 A 即时图片' })).not.toBeInTheDocument();
  });

  it('imports pasted image files through the project design path and ignores non-images', async () => {
    const persistedDesign: ProjectDesign = {
      id: 'design-pasted', projectId: 'project-1', assetId: 'asset-pasted', sourceTaskId: 'canvas-import-task',
      width: 1080, height: 1440, title: 'pasted.png', createdAt: '2026-10-14T00:00:00.000Z',
    };
    const importAssets = vi.fn(async () => [{ status: 'success' as const, asset: { id: 'asset-pasted', name: 'pasted.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true } }]);
    const addProjectDesigns = vi.fn(async () => [persistedDesign]);
    window.designhub = {
      listProjectDesigns: vi.fn(async () => []),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
      importAssets,
      addProjectDesigns,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [] }}
        libraryId="workspace-1"
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
    const image = new File(['png'], 'pasted.png', { type: 'image/png' });
    const text = new File(['notes'], 'notes.txt', { type: 'text/plain' });

    fireEvent.paste(window, { clipboardData: { files: [text, image] } });

    await waitFor(() => expect(importAssets).toHaveBeenCalledWith(expect.objectContaining({
      libraryId: 'workspace-1',
      projectId: 'project-1',
      items: [expect.objectContaining({ name: 'pasted.png', mimeType: 'image/png', metadata: { purpose: 'project-design', origin: 'canvas-import' } })],
    })));
    expect(addProjectDesigns).toHaveBeenCalledWith(expect.objectContaining({
      libraryId: 'workspace-1',
      projectId: 'project-1',
      designs: [expect.objectContaining({ assetId: 'asset-pasted', title: 'pasted.png' })],
    }));
    expect(await screen.findByRole('button', { name: '设计稿 pasted.png' })).toBeVisible();
  });

  it('imports dropped image files through the same project design path', async () => {
    const persistedDesign: ProjectDesign = {
      id: 'design-dropped', projectId: 'project-1', assetId: 'asset-dropped', sourceTaskId: 'canvas-import-task',
      width: 1080, height: 1440, title: 'dropped.png', createdAt: '2026-10-14T00:00:00.000Z',
    };
    const importAssets = vi.fn(async () => [{ status: 'success' as const, asset: { id: 'asset-dropped', name: 'dropped.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'd'.repeat(64), managed: true } }]);
    const addProjectDesigns = vi.fn(async () => [persistedDesign]);
    window.designhub = {
      listProjectDesigns: vi.fn(async () => []),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
      importAssets,
      addProjectDesigns,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [] }}
        libraryId="workspace-1"
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
    const image = new File(['png'], 'dropped.png', { type: 'image/png' });

    fireEvent.drop(screen.getByTestId('project-canvas-stage'), { dataTransfer: { files: [image] } });

    await waitFor(() => expect(importAssets).toHaveBeenCalledWith(expect.objectContaining({
      libraryId: 'workspace-1',
      projectId: 'project-1',
      items: [expect.objectContaining({ name: 'dropped.png', mimeType: 'image/png', metadata: { purpose: 'project-design', origin: 'canvas-import' } })],
    })));
    expect(addProjectDesigns).toHaveBeenCalledWith(expect.objectContaining({
      libraryId: 'workspace-1',
      projectId: 'project-1',
      designs: [expect.objectContaining({ assetId: 'asset-dropped', title: 'dropped.png', width: 1080, height: 1440 })],
    }));
    expect(await screen.findByRole('button', { name: '设计稿 dropped.png' })).toBeVisible();
  });

  it('does not import pasted images into a read-only canvas', async () => {
    const importAssets = vi.fn();
    const addProjectDesigns = vi.fn();
    window.designhub = {
      listProjectDesigns: vi.fn(async () => []),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
      importAssets,
      addProjectDesigns,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [] }}
        libraryId="workspace-1"
        readOnly
        conversationConnected
        designer={null}
        notify={vi.fn()}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onSubmitConversation={vi.fn(async () => null)}
        onSubmitDesignGeneration={vi.fn(async () => null)}
      />,
    );

    fireEvent.paste(window, { clipboardData: { files: [new File(['png'], 'pasted.png', { type: 'image/png' })] } });
    await act(async () => { await Promise.resolve(); });

    expect(importAssets).not.toHaveBeenCalled();
    expect(addProjectDesigns).not.toHaveBeenCalled();
  });

  it('keeps a read-only canvas selection stable across polling refreshes', async () => {
    vi.useFakeTimers();
    const design: ProjectDesign = { id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'task-1', width: 800, height: 600, title: '只读图片', createdAt: '2026-10-14T00:00:00.000Z' };
    const refreshedDesign: ProjectDesign = { id: 'design-2', projectId: 'project-1', assetId: 'asset-2', sourceTaskId: 'task-2', width: 800, height: 600, title: '轮询新增图片', createdAt: '2026-10-14T00:01:00.000Z' };
    const layout: ProjectCanvasLayout = { viewport: { zoom: 0.8, offsetX: 20, offsetY: 30 }, nodes: { 'design-1': { x: 120, y: 80 } }, selectedDesignIds: [] };
    let designReadCount = 0;
    window.designhub = {
      listProjectDesigns: vi.fn(async () => designReadCount++ === 0 ? [design] : [design, refreshedDesign]),
      loadProjectCanvasLayout: vi.fn(async () => layout),
      listTasks: vi.fn(async () => []),
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '只读项目', enName: 'Read only', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design], canvasLayout: layout }}
        libraryId="workspace-1"
        readOnly
        conversationConnected
        designer={null}
        notify={vi.fn()}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onSubmitConversation={vi.fn(async () => null)}
        onSubmitDesignGeneration={vi.fn(async () => null)}
      />,
    );
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: '设计稿 只读图片' }));
    expect(screen.getByRole('button', { name: '设计稿 只读图片' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });

    expect(screen.getByRole('button', { name: '设计稿 只读图片' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '设计稿 轮询新增图片' })).toBeVisible();
  });

  it('keeps images pasted into the conversation input out of the canvas import path', async () => {
    const importAssets = vi.fn(async () => [{ status: 'success' as const, asset: { id: 'asset-unexpected', name: 'reference.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true } }]);
    const addProjectDesigns = vi.fn(async () => []);
    window.designhub = {
      listProjectDesigns: vi.fn(async () => []),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
      importAssets,
      addProjectDesigns,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [] }}
        libraryId="workspace-1"
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
    const image = new File([new Uint8Array([1, 2, 3])], 'reference.png', { type: 'image/png' });
    Object.defineProperty(image, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });

    fireEvent.paste(screen.getByRole('textbox', { name: '设计需求' }), { clipboardData: { files: [image] } });

    expect(await screen.findByRole('button', { name: '预览 reference.png' })).toBeVisible();
    expect(importAssets).not.toHaveBeenCalled();
    expect(addProjectDesigns).not.toHaveBeenCalled();
  });

  it('keeps images pasted inside a dialog out of the canvas import path', async () => {
    const importAssets = vi.fn();
    const addProjectDesigns = vi.fn();
    window.designhub = {
      listProjectDesigns: vi.fn(async () => []),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
      importAssets,
      addProjectDesigns,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [] }}
        libraryId="workspace-1"
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
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);

    const defaultAllowed = fireEvent.paste(dialog, { clipboardData: { files: [new File(['png'], 'dialog.png', { type: 'image/png' })] } });
    await act(async () => { await Promise.resolve(); });
    dialog.remove();

    expect(defaultAllowed).toBe(true);
    expect(importAssets).not.toHaveBeenCalled();
    expect(addProjectDesigns).not.toHaveBeenCalled();
  });

  it('does not notify historical image tool failures when the canvas first loads', async () => {
    const notify = vi.fn();
    const historicalFailure: TaskRecord = {
      id: 'task-historical-failure', requestId: 'request-historical-failure', state: 'failed', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: 'asset-source',
      tool: 'expand', toolParams: { mode: 'original-scene', top: 100, right: 100, bottom: 100, left: 100 },
      errorCode: 'RESULT_DIMENSIONS_INVALID',
    };
    const analysis: TaskRecord = {
      ...conversation({ id: 'analysis-loaded', createdAt: '2026-10-14T00:00:00.000Z' }),
      source: { kind: 'project', id: 'project-1' },
      result: { text: '历史任务已加载' },
    };
    window.designhub = {
      listProjectDesigns: vi.fn(async () => []),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => [historicalFailure, analysis]),
    };

    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [] }}
        libraryId="workspace-1"
        readOnly={false}
        conversationConnected
        designer={null}
        notify={notify}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onSubmitConversation={vi.fn(async () => null)}
        onSubmitDesignGeneration={vi.fn(async () => null)}
      />,
    );

    expect(await screen.findByText('历史任务已加载')).toBeVisible();
    expect(notify).not.toHaveBeenCalled();
  });

  it('shows an image tool placeholder as soon as the task is queued', async () => {
    const design: ProjectDesign = {
      id: 'design-tool-placeholder', projectId: 'project-1', assetId: 'asset-tool-placeholder', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '待处理图片', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const queuedTask: TaskRecord = {
      id: 'task-tool-placeholder', requestId: 'request-tool-placeholder', state: 'queued', cancelRequested: false, attempt: 1,
      source: { kind: 'project', id: 'project-1' }, capability: 'image-editing', sourceAssetId: design.assetId,
      tool: 'remove-background', toolParams: { edgeRefinement: 50 },
    };
    let tasks: TaskRecord[] = [];
    const onSubmitImageTask = vi.fn(async () => {
      tasks = [queuedTask];
      return queuedTask;
    });
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => tasks),
    };

    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design] }}
        libraryId="workspace-1"
        readOnly={false}
        conversationConnected
        designer={null}
        notify={vi.fn()}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onSubmitImageTask={onSubmitImageTask}
        onSubmitConversation={vi.fn(async () => null)}
        onSubmitDesignGeneration={vi.fn(async () => null)}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '设计稿 待处理图片' }));
    fireEvent.click(screen.getByRole('button', { name: '去除背景' }));
    fireEvent.click(screen.getByRole('button', { name: '执行' }));

    expect(await screen.findByLabelText('正在处理图片 task-tool-placeholder')).toHaveTextContent('800 × 600');
    expect(screen.queryByRole('dialog', { name: '去除背景' })).not.toBeInTheDocument();
  });

  it('shows image tools in the left toolbar and applies the selected image', async () => {
    const design: ProjectDesign = {
      id: 'design-tool-target', projectId: 'project-1', assetId: 'asset-tool-target', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '商品图', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const onSubmitImageTask = vi.fn(async () => undefined);
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
    };

    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design] }}
        libraryId="workspace-1"
        readOnly={false}
        conversationConnected
        designer={null}
        notify={vi.fn()}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onSubmitImageTask={onSubmitImageTask}
        onSubmitConversation={vi.fn(async () => null)}
        onSubmitDesignGeneration={vi.fn(async () => null)}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '设计稿 商品图' }));
    expect(screen.getByRole('toolbar', { name: '图片工具' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '画布图像工具' })).not.toBeInTheDocument();
    const toolButtons = [...screen.getByRole('toolbar', { name: '图片工具' }).querySelectorAll('button')];
    expect(toolButtons).toHaveLength(9);
    expect(toolButtons.map((button) => button.querySelector('.ui-icon')?.getAttribute('style'))).toEqual([
      expect.stringContaining('eye-off.svg'),
      expect.stringContaining('palette.svg'),
      expect.stringContaining('trash-2.svg'),
      expect.stringContaining('pencil.svg'),
      expect.stringContaining('arrow-up-right.svg'),
      expect.stringContaining('crop.svg'),
      expect.stringContaining('zoom-in.svg'),
      expect.stringContaining('maximize-2.svg'),
      expect.stringContaining('layout-grid.svg'),
    ]);
    fireEvent.click(screen.getByRole('button', { name: '去除背景' }));
    fireEvent.click(screen.getByRole('button', { name: '执行' }));

    await waitFor(() => expect(onSubmitImageTask).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'remove-background',
      targetLayerId: 'design-tool-target',
      beforeScene: expect.objectContaining({
        layers: [expect.objectContaining({ assetId: 'asset-tool-target' })],
      }),
    })));
  });

  // Each declared toolbar tool must submit its own valid contract and selected source.
  // Regional tools additionally protect against dropping the mask entered in the UI.
  const submissionCases: Record<ImageTool, { label: string; params: ToolParams; prompt?: string; regional?: boolean }> = {
    'remove-background': { label: 'Remove background', params: { edgeRefinement: 50 } },
    'replace-background': { label: 'Replace background', prompt: 'A sunlit studio', params: { source: 'description', prompt: 'A sunlit studio', lighting: 'match-original' } },
    'remove-object': { label: 'Remove object', params: { feather: 10 }, regional: true },
    inpaint: { label: 'Inpaint', prompt: 'A small green plant', params: { prompt: 'A small green plant', strength: 0.5 }, regional: true },
    expand: { label: 'Expand image', params: { mode: 'original-scene', top: 75, right: 75, bottom: 75, left: 75 } },
    'smart-crop': { label: 'Smart crop', params: { width: 800, height: 600, focus: 'subject' } },
    upscale: { label: 'Upscale image', params: { scale: 2, preserveDetails: 'balanced' } },
    resize: { label: 'Resize', params: { width: 800, height: 600, fit: 'contain', format: 'png' } },
    'remove-watermark': { label: 'Remove watermark', params: { rightsConfirmed: 'confirmed', feather: 10 }, regional: true },
  };

  it.each(imageTools)('submits %s from its toolbar UI with the selected design and exact parameters/region', async (tool) => {
    const testCase = submissionCases[tool];
    expect(testCase, `Missing submission case for declared tool: ${tool}`).toBeDefined();
    const otherDesign: ProjectDesign = {
      id: 'design-unselected', projectId: 'project-1', assetId: 'asset-unselected', sourceTaskId: 'generation-1',
      width: 320, height: 240, title: 'Other image', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const selectedDesign: ProjectDesign = {
      id: 'design-matrix-selected', projectId: 'project-1', assetId: 'asset-matrix-selected', sourceTaskId: 'generation-2',
      width: 800, height: 600, title: 'Selected image', createdAt: '2026-10-10T00:01:00.000Z',
    };
    const onSubmitImageTask = vi.fn(async () => undefined);
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [otherDesign, selectedDesign]),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
    };
    render(
      <ProjectCanvas
        locale="en"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: 'Poster', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [otherDesign, selectedDesign] }}
        libraryId="workspace-1"
        readOnly={false}
        conversationConnected
        designer={null}
        notify={vi.fn()}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onSubmitImageTask={onSubmitImageTask}
        onSubmitConversation={vi.fn(async () => null)}
        onSubmitDesignGeneration={vi.fn(async () => null)}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '设计稿 Selected image' }));
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'Image tools' })).getByRole('button', { name: testCase.label }));
    const dialog = within(screen.getByRole('dialog', { name: testCase.label }));
    if (testCase.prompt) fireEvent.change(dialog.getByRole('textbox', { name: 'Prompt' }), { target: { value: testCase.prompt } });
    if (testCase.regional) {
      expect(dialog.getByRole('button', { name: 'Apply mask' })).toBeDisabled();
      const mask = within(dialog.getByRole('form', { name: 'Mask editor' }));
      fireEvent.change(mask.getByRole('spinbutton', { name: 'X' }), { target: { value: '20' } });
      fireEvent.change(mask.getByRole('spinbutton', { name: 'Y' }), { target: { value: '30' } });
      fireEvent.change(mask.getByRole('spinbutton', { name: 'Width' }), { target: { value: '120' } });
      fireEvent.change(mask.getByRole('spinbutton', { name: 'Height' }), { target: { value: '90' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Apply mask' }));
    } else {
      fireEvent.click(dialog.getByRole('button', { name: 'Run' }));
    }

    await waitFor(() => expect(onSubmitImageTask).toHaveBeenCalledExactlyOnceWith({
      tool,
      prompt: expect.any(String),
      params: testCase.params,
      baseRevisionId: null,
      targetLayerId: 'design-matrix-selected',
      ...(testCase.regional ? { region: { x: 20, y: 30, width: 120, height: 90 } } : {}),
      beforeScene: expect.objectContaining({
        width: 800,
        height: 600,
        layers: [expect.objectContaining({ id: 'design-matrix-selected', type: 'image', assetId: 'asset-matrix-selected', width: 800, height: 600 })],
      }),
    }));
  });

  it('keeps image tools on the project canvas without opening a document', async () => {
    const design: ProjectDesign = {
      id: 'design-direct-tool', projectId: 'project-1', assetId: 'asset-direct-tool', sourceTaskId: 'generation-1',
      width: 800, height: 600, title: '直接图片', createdAt: '2026-10-10T00:00:00.000Z',
    };
    const onSubmitImageTask = vi.fn(async () => undefined);
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design] }}
        libraryId="workspace-1"
        readOnly={false}
        conversationConnected
        designer={null}
        notify={vi.fn()}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onSubmitImageTask={onSubmitImageTask}
        onSubmitConversation={vi.fn(async () => null)}
        onSubmitDesignGeneration={vi.fn(async () => null)}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '设计稿 直接图片' }));
    fireEvent.click(screen.getByRole('button', { name: '去除背景' }));
    expect(screen.getByRole('dialog', { name: '去除背景' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打开主海报' })).not.toBeInTheDocument();
  });

  it('disables design generation while visual clarification is required', async () => {
    const analysis: TaskRecord = {
      ...conversation({ id: 'analysis-clarification', createdAt: '2026-09-29T10:00:00.000Z' }),
      source: { kind: 'project', id: 'project-1' },
      result: { text: '你希望修改图一还是图二？' },
      visualContextPlan: {
        version: 1,
        items: [
          { assetId: 'asset-a', roles: ['visual-reference'], confidence: 0.4 },
          { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0.4 },
        ],
        clarificationRequired: true,
      },
    };

    renderProjectCanvasWithTasks([analysis]);

    expect(await screen.findByText('你希望修改图一还是图二？')).toBeVisible();
    expect(screen.getByRole('button', { name: '生成单张' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '生成多张' })).toBeDisabled();
  });

  it('removes the analysis toolbar action and exposes background removal for one selected design', async () => {
    const design: ProjectDesign = {
      id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'generation-1',
      width: 1080, height: 1440, title: '春日海报', createdAt: '2026-09-21T10:00:00.000Z',
    };
    const onSubmitImageTask = vi.fn(async () => undefined);
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
    };

    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design] }}
        libraryId="workspace-1"
        readOnly={false}
        conversationConnected
        designer={null}
        notify={vi.fn()}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onSubmitImageTask={onSubmitImageTask}
        onSubmitConversation={vi.fn(async () => null)}
        onSubmitDesignGeneration={vi.fn(async () => null)}
      />,
    );

    expect(screen.queryByRole('button', { name: '设计分析' })).not.toBeInTheDocument();
    const removeButton = screen.getByRole('button', { name: '去除背景' });
    expect(removeButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '设计稿 春日海报' }));
    expect(removeButton).toBeEnabled();
    fireEvent.click(removeButton);
    fireEvent.click(screen.getByRole('button', { name: '执行' }));
    await waitFor(() => expect(onSubmitImageTask).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'remove-background',
      targetLayerId: 'design-1',
      beforeScene: expect.objectContaining({ layers: [expect.objectContaining({ assetId: 'asset-1' })] }),
    })));
  });

  it('reports refreshed designs so the project list can update its cover', async () => {
    const design: ProjectDesign = {
      id: 'design-refreshed',
      projectId: 'project-1',
      assetId: 'asset-refreshed',
      sourceTaskId: 'generation-1',
      width: 1080,
      height: 1440,
      title: '最新设计稿',
      createdAt: '2026-09-21T10:00:00.000Z',
    };
    const onDesignsChange = vi.fn();
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [] }}
        libraryId="workspace-1"
        readOnly={false}
        conversationConnected
        designer={null}
        notify={vi.fn()}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onDesignsChange={onDesignsChange}
        onSubmitConversation={vi.fn(async () => null)}
        onSubmitDesignGeneration={vi.fn(async () => null)}
      />,
    );

    await waitFor(() => expect(onDesignsChange).toHaveBeenCalledWith([design]));
  });

  it('adds a design to the conversation only after a double click', async () => {
    const design: ProjectDesign = {
      id: 'design-1',
      projectId: 'project-1',
      assetId: 'asset-1',
      sourceTaskId: 'generation-1',
      sourceConversationTaskId: 'analysis-1',
      width: 1080,
      height: 1440,
      title: '春日海报',
      createdAt: '2026-09-21T10:00:00.000Z',
    };
    const readAsset = vi.fn(async () => new Uint8Array([1, 2, 3]));
    window.designhub = {
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
      readAsset,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design] }}
        libraryId="workspace-1"
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

    const draft = screen.getByRole('button', { name: '设计稿 春日海报' });
    fireEvent.click(draft);
    await Promise.resolve();
    expect(readAsset).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '预览 春日海报' })).not.toBeInTheDocument();

    fireEvent.doubleClick(draft);
    await waitFor(() => expect(readAsset).toHaveBeenCalledWith({ libraryId: 'workspace-1', projectId: 'project-1', assetId: 'asset-1' }));
    expect(await screen.findByRole('button', { name: '预览 春日海报' })).toBeVisible();
  });

  it('selects every design generated from the chosen analysis without attaching them', async () => {
    const designs: ProjectDesign[] = [
      { id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'generation-1', sourceConversationTaskId: 'analysis-1', width: 1080, height: 1440, title: '方案一', createdAt: '2026-09-21T10:00:00.000Z' },
      { id: 'design-2', projectId: 'project-1', assetId: 'asset-2', sourceTaskId: 'generation-1', sourceConversationTaskId: 'analysis-1', width: 1080, height: 1440, title: '方案二', createdAt: '2026-09-21T10:01:00.000Z' },
      { id: 'design-3', projectId: 'project-1', assetId: 'asset-3', sourceTaskId: 'generation-2', sourceConversationTaskId: 'analysis-2', width: 1080, height: 1440, title: '其他方案', createdAt: '2026-09-21T11:00:00.000Z' },
    ];
    const tasks = [
      { ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z', requestText: '第一轮分析' }), source: { kind: 'project' as const, id: 'project-1' }, result: { text: '第一轮结果' } },
      { ...conversation({ id: 'analysis-2', createdAt: '2026-09-21T11:00:00.000Z', requestText: '第二轮分析' }), source: { kind: 'project' as const, id: 'project-1' }, result: { text: '第二轮结果' } },
    ];
    const readAsset = vi.fn(async () => new Uint8Array([1]));
    window.designhub = {
      listProjectDesigns: vi.fn(async () => designs),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => tasks),
      readAsset,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs }}
        libraryId="workspace-1"
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

    fireEvent.click(await screen.findByRole('button', { name: /分析历史/u }));
    fireEvent.click(screen.getByRole('button', { name: /第一轮分析/u }));

    expect(screen.getByRole('button', { name: '设计稿 方案一' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '设计稿 方案二' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '设计稿 其他方案' })).toHaveAttribute('aria-pressed', 'false');
    expect(readAsset).not.toHaveBeenCalled();
  });

  it('exports every design selected through an analysis result', async () => {
    const designs: ProjectDesign[] = [
      { id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'generation-1', sourceConversationTaskId: 'analysis-1', width: 1080, height: 1440, title: '方案一', createdAt: '2026-09-21T10:00:00.000Z' },
      { id: 'design-2', projectId: 'project-1', assetId: 'asset-2', sourceTaskId: 'generation-1', sourceConversationTaskId: 'analysis-1', width: 1080, height: 1440, title: '方案二', createdAt: '2026-09-21T10:01:00.000Z' },
    ];
    const analysis = { ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z', requestText: '第一轮分析' }), source: { kind: 'project' as const, id: 'project-1' }, result: { text: '第一轮结果' } };
    const exportProjectDesign = vi.fn(async (input: ExportProjectDesignInput) => ({ path: `/tmp/${input.designId}.png`, sha256: 'a'.repeat(64) }));
    window.designhub = {
      listProjectDesigns: vi.fn(async () => designs),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => [analysis]),
      exportProjectDesign,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs }}
        libraryId="workspace-1"
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

    fireEvent.click(await screen.findByRole('button', { name: /分析历史/u }));
    fireEvent.click(screen.getByRole('button', { name: /第一轮分析/u }));
    fireEvent.click(screen.getByRole('button', { name: '导出所选设计稿' }));

    await waitFor(() => expect(exportProjectDesign).toHaveBeenCalledTimes(2));
    expect(exportProjectDesign.mock.calls.map(([input]) => input.designId)).toEqual(['design-1', 'design-2']);
  });

  it('loads an analysis image and appends its request to the conversation draft once', async () => {
    const analysis = {
      ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z', requestText: '加入春季植物元素' }),
      source: { kind: 'project' as const, id: 'project-1' },
      contextAssetIds: ['asset-1'],
      result: { text: '使用暖色植物插画。' },
    };
    window.designhub = {
      listProjectDesigns: vi.fn(async () => []),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => [analysis]),
      listAssets: vi.fn(async () => [{ id: 'asset-1', name: 'plant.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'hash-1', managed: true }]),
      readAsset: vi.fn(async () => new Uint8Array([1, 2, 3])),
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', libraryId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [] }}
        libraryId="workspace-1"
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

    fireEvent.change(screen.getByLabelText('设计需求'), { target: { value: '保留现有草稿' } });
    fireEvent.click(await screen.findByRole('button', { name: '展开本轮输入' }));
    expect(await screen.findByRole('img', { name: 'plant.png' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '复制到对话框' }));
    fireEvent.click(screen.getByRole('button', { name: '复制到对话框' }));

    expect(screen.getByLabelText('设计需求')).toHaveValue('保留现有草稿\n\n加入春季植物元素');
    expect(screen.getAllByRole('button', { name: '预览 plant.png' })).toHaveLength(1);
  });

  it('keeps analysis history open and shows status icons after selecting an item', async () => {
    const tasks: TaskRecord[] = [
      { ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z', requestText: '第一轮分析', state: 'completed' }), source: { kind: 'project', id: 'project-1' }, result: { text: '第一轮结果' } },
      { ...conversation({ id: 'analysis-2', createdAt: '2026-09-21T11:00:00.000Z', requestText: '第二轮分析', state: 'running' }), source: { kind: 'project', id: 'project-1' } },
      { ...conversation({ id: 'analysis-3', createdAt: '2026-09-21T12:00:00.000Z', requestText: '第三轮分析', state: 'failed' }), source: { kind: 'project', id: 'project-1' } },
    ];
    renderProjectCanvasWithTasks(tasks);
    fireEvent.click(await screen.findByRole('button', { name: /分析历史/u }));

    expect(document.querySelector('.project-canvas-analysis-history__list')).toHaveClass('project-canvas-analysis-history__list-enter');
    expect(screen.getByTestId('analysis-status-completed')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-status-running')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-status-failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /第一轮分析/u }));

    expect(screen.getByRole('button', { name: /第二轮分析/u })).toBeVisible();
  });

  it('renders collapsed history as a neural presence and opens history from it', async () => {
    const tasks: TaskRecord[] = [
      { ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z', requestText: '第一轮分析' }), source: { kind: 'project', id: 'project-1' }, result: { text: '第一轮结果' } },
      { ...conversation({ id: 'analysis-2', createdAt: '2026-09-21T11:00:00.000Z', requestText: '第二轮分析' }), source: { kind: 'project', id: 'project-1' }, result: { text: '第二轮结果' } },
    ];
    renderProjectCanvasWithTasks(tasks);

    const presence = await screen.findByRole('button', { name: '打开分析历史' });
    expect(presence).toBeInTheDocument();
    fireEvent.click(presence);
    expect(screen.getByLabelText('分析历史列表')).toHaveClass('is-open');
    expect(screen.getByTestId('project-canvas')).toHaveAttribute('data-analysis-dock-view', 'history');
    expect(screen.getByTestId('project-canvas-analysis-presence')).toHaveClass('is-hidden');
    expect(screen.getByRole('button', { name: /第一轮分析/u })).toBeVisible();
  });

  it('shows an idle neural presence before the first analysis', async () => {
    renderProjectCanvasWithTasks([]);

    const presence = await screen.findByRole('button', { name: '神经簇智体待命' });
    expect(presence).toBeDisabled();
    expect(screen.getByTestId('project-canvas-analysis-presence')).toHaveAttribute('data-mode', 'idle');
    expect(screen.getByTestId('project-canvas')).toHaveAttribute('data-analysis-dock-view', 'presence');
    expect(screen.queryByLabelText('分析历史列表')).not.toBeInTheDocument();
  });

  it('keeps the completed result visible while history is expanded', async () => {
    const analysis = { ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z', requestText: '第一轮分析' }), source: { kind: 'project' as const, id: 'project-1' }, result: { text: '第一轮结果' } };
    renderProjectCanvasWithTasks([analysis]);

    fireEvent.click(await screen.findByRole('button', { name: /打开分析历史/u }));

    expect(screen.getByRole('complementary', { name: '设计分析' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /第一轮分析/u })).toBeVisible();
  });

  it('closes history before entering thinking and hides the progress analysis panel', async () => {
    const running = { ...conversation({ id: 'analysis-running', createdAt: '2026-09-21T12:00:00.000Z', requestText: '新需求', state: 'running' }), source: { kind: 'project' as const, id: 'project-1' } };
    const submitConversation = vi.fn(async () => running);
    renderProjectCanvasWithTasks([
      { ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z' }), source: { kind: 'project' as const, id: 'project-1' }, result: { text: '第一轮结果' } },
    ], submitConversation);

    fireEvent.click(await screen.findByRole('button', { name: /打开分析历史/u }));
    fireEvent.change(screen.getByLabelText('设计需求'), { target: { value: '新需求' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(submitConversation).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('分析历史列表')).not.toBeInTheDocument();
    expect(await screen.findByTestId('project-canvas-analysis-presence')).toHaveAttribute('data-mode', 'thinking');
    expect(screen.queryByRole('complementary', { name: '设计分析' })).not.toBeInTheDocument();
  });

  it('returns to the neural presence on canvas background and opens history when clicked', async () => {
    const analysis = { ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z', requestText: '第一轮分析' }), source: { kind: 'project' as const, id: 'project-1' }, result: { text: '第一轮结果' } };
    renderProjectCanvasWithTasks([analysis]);

    fireEvent.click(await screen.findByRole('button', { name: '画布空白' }));
    expect(document.querySelector('.project-canvas-analysis-panel')).not.toBeInTheDocument();
    const presence = screen.getByRole('button', { name: '打开分析历史' });
    expect(presence).toBeInTheDocument();

    fireEvent.click(presence);
    expect(screen.getByLabelText('分析历史列表')).toHaveClass('is-open');
    expect(screen.getByRole('button', { name: /第一轮分析/u })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /分析历史/u }));
    expect(screen.getByTestId('project-canvas')).toHaveAttribute('data-analysis-dock-view', 'presence');
    expect(screen.getByTestId('project-canvas-analysis-presence')).not.toHaveClass('is-hidden');
    expect(screen.getByTestId('project-canvas-analysis-presence')).toBeVisible();
  });
});
