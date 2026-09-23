import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectCanvas, getAnalysisHistory, getLatestConversationTask } from './ProjectCanvas';
import type { ProjectDesign } from '../../features/projects/metadata';
import type { TaskRecord } from '../../features/tasks/state';
import type { ExportDocumentInput } from '../../platform/contracts';

type StageMockProps = {
  designs: readonly ProjectDesign[];
  selectedDesignIds?: readonly string[];
  onSelect: (designId: string | null) => void;
  onAddToConversation?: (designId: string) => void;
  onCanvasBackground?: () => void;
  children?: ReactNode;
};

vi.mock('./ProjectCanvasStage', () => ({
  ProjectCanvasStage: ({ designs, selectedDesignIds = [], onSelect, onAddToConversation, onCanvasBackground }: StageMockProps) => (
    <div aria-label="设计画布内容">
      <button type="button" aria-label="画布空白" onClick={onCanvasBackground}>画布空白</button>
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

describe('ProjectCanvas design references', () => {
  it('removes the analysis toolbar action and exposes background removal for one selected design', async () => {
    const design: ProjectDesign = {
      id: 'design-1', projectId: 'project-1', assetId: 'asset-1', sourceTaskId: 'generation-1',
      width: 1080, height: 1440, title: '春日海报', createdAt: '2026-09-21T10:00:00.000Z',
    };
    const onRemoveBackground = vi.fn(async () => undefined);
    window.designhub = {
      chooseWorkspaceDirectory: async () => null,
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
    };

    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', workspaceId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design], documents: 0 }}
        workspaceId="workspace-1"
        readOnly={false}
        conversationConnected
        designer={null}
        notify={vi.fn()}
        onBack={vi.fn()}
        onConnections={vi.fn()}
        onRemoveBackground={onRemoveBackground}
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
    await waitFor(() => expect(onRemoveBackground).toHaveBeenCalledWith(design));
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
      chooseWorkspaceDirectory: async () => null,
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
    };
    render(
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
      chooseWorkspaceDirectory: async () => null,
      listProjectDesigns: vi.fn(async () => [design]),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
      readAsset,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', workspaceId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs: [design], documents: 0 }}
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

    const draft = screen.getByRole('button', { name: '设计稿 春日海报' });
    fireEvent.click(draft);
    await Promise.resolve();
    expect(readAsset).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '预览 春日海报' })).not.toBeInTheDocument();

    fireEvent.doubleClick(draft);
    await waitFor(() => expect(readAsset).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1', assetId: 'asset-1' }));
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
      chooseWorkspaceDirectory: async () => null,
      listProjectDesigns: vi.fn(async () => designs),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => tasks),
      readAsset,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', workspaceId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs, documents: 0 }}
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
    const exportDocument = vi.fn(async (input: ExportDocumentInput) => ({ path: `/tmp/${input.documentId}.png`, sha256: 'a'.repeat(64) }));
    window.designhub = {
      chooseWorkspaceDirectory: async () => null,
      listProjectDesigns: vi.fn(async () => designs),
      loadProjectCanvasLayout: vi.fn(async () => null),
      listTasks: vi.fn(async () => [analysis]),
      exportDocument,
    };
    render(
      <ProjectCanvas
        locale="zh-CN"
        project={{ id: 'project-1', workspaceId: 'workspace-1', name: '海报项目', enName: 'Poster', description: '', enDescription: '', designers: [], artwork: 'blank', designs, documents: 0 }}
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

    fireEvent.click(await screen.findByRole('button', { name: /分析历史/u }));
    fireEvent.click(screen.getByRole('button', { name: /第一轮分析/u }));
    fireEvent.click(screen.getByRole('button', { name: '导出所选设计稿' }));

    await waitFor(() => expect(exportDocument).toHaveBeenCalledTimes(2));
    expect(exportDocument.mock.calls.map(([input]) => input.documentId)).toEqual(['design-1', 'design-2']);
  });

  it('loads an analysis image and appends its request to the conversation draft once', async () => {
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
      listAssets: vi.fn(async () => [{ id: 'asset-1', name: 'plant.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'hash-1', managed: true }]),
      readAsset: vi.fn(async () => new Uint8Array([1, 2, 3])),
    };
    render(
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
