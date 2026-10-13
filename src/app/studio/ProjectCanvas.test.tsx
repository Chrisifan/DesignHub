import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectCanvas, getAnalysisHistory, getLatestConversationTask, getPendingCanvasDesigns, imageToolDesignAnchors } from './ProjectCanvas';
import type { ProjectDesign } from '../../features/projects/metadata';
import type { TaskRecord } from '../../features/tasks/state';
import type { ExportProjectDesignInput } from '../../platform/contracts';

type StageMockProps = {
  designs: readonly ProjectDesign[];
  selectedDesignIds?: readonly string[];
  pendingDesigns?: ReadonlyArray<{ id: string; width: number; height: number }>;
  onSelect: (designId: string | null) => void;
  onAddToConversation?: (designId: string) => void;
  onCanvasBackground?: () => void;
  children?: ReactNode;
};

vi.mock('./ProjectCanvasStage', () => ({
  ProjectCanvasStage: ({ designs, selectedDesignIds = [], pendingDesigns = [], onSelect, onAddToConversation, onCanvasBackground }: StageMockProps) => (
    <div aria-label="设计画布内容">
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

afterEach(() => {
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

const renderProjectCanvasWithTasks = (taskRecords: TaskRecord[]) => {
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
      onSubmitConversation={vi.fn(async () => null)}
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

  it('collapses on canvas background and expands when the static dots are clicked', async () => {
    const analysis = { ...conversation({ id: 'analysis-1', createdAt: '2026-09-21T10:00:00.000Z', requestText: '第一轮分析' }), source: { kind: 'project' as const, id: 'project-1' }, result: { text: '第一轮结果' } };
    renderProjectCanvasWithTasks([analysis]);

    fireEvent.click(await screen.findByRole('button', { name: '画布空白' }));
    expect(document.querySelector('.project-canvas-analysis-panel')).toHaveClass('project-canvas-analysis-panel--collapsed');
    expect(screen.getByTestId('collapsed-analysis-dots')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '展开本轮分析' }));
    expect(document.querySelector('.project-canvas-analysis-panel')).toHaveClass('project-canvas-analysis-panel--expanded');
    expect(screen.queryByTestId('collapsed-analysis-dots')).not.toBeInTheDocument();
  });
});
