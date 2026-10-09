import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

import { Workbench, type WorkbenchProps } from './Workbench';
import type { Project } from './types';
import { createScene, type DesignScene } from '../../features/canvas/scene';
import { createDesignGenerationSlots, type TaskRecord } from '../../features/tasks/state';
import type { DesignSceneCandidate } from '../../features/composition/design-scene-candidate';

vi.mock('react-konva', () => {
  const component = ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>;
  return { Ellipse: component, Layer: component, Line: component, Rect: component, Stage: component, Text: component };
});

const project: Project = {
  id: 'spring-market',
  name: '春间市集',
  enName: 'Spring Market',
  description: '城市周末市集的系列视觉。',
  enDescription: 'A visual series for an urban weekend market.',
  designers: ['林夏'],
  artwork: 'market',
  documents: 3,
};

const makeProps = (
  overrides: Partial<WorkbenchProps> = {},
): WorkbenchProps => ({
  locale: 'zh-CN',
  project,
  onBack: vi.fn(),
  onConnections: vi.fn(),
  notify: vi.fn(),
  ...overrides,
});

it('reviews a local scene candidate without committing it until confirmation', async () => {
  const commitDocumentRevision = vi.fn(async () => ({ revisionId: 'revision-1' }));
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { commitDocumentRevision, saveDocumentScene, loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })) };
  const initialCandidate: DesignSceneCandidate = {
    id: 'candidate-local', sourceTaskId: 'local-task', mode: 'structured', editable: true,
    scene: createScene({ id: 'candidate-scene', width: 1080, height: 1440, layers: [] }),
    assets: [{ assetId: 'core-art', role: 'core' }], createdAt: '2026-09-28T00:00:00.000Z',
  };
  render(<Workbench {...makeProps({ project: { ...project, libraryId: 'library-1', documentEntries: [{ id: 'doc-1', name: 'Draft', width: 1080, height: 1440 }] }, libraryId: 'library-1', documentId: 'doc-1', initialCandidate })} />);
  expect(screen.getByTestId('canvas-candidate-scene')).toBeInTheDocument();
  expect(commitDocumentRevision).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认候选' }));
  await waitFor(() => expect(commitDocumentRevision).toHaveBeenCalledOnce());
  expect(saveDocumentScene).toHaveBeenCalled();
});

it('restores an unresolved local candidate from task storage and records discard', async () => {
  const resolveCompositionCandidate = vi.fn(async () => ({ candidateResolution: 'discarded' as const } as TaskRecord));
  const candidate: DesignSceneCandidate = {
    id: 'candidate-restored', sourceTaskId: 'local-task-restored', mode: 'structured', editable: true,
    scene: createScene({ id: 'candidate-restored-scene', width: 1080, height: 1440, layers: [] }),
    assets: [{ assetId: 'core-restored', role: 'core' }], createdAt: '2026-10-01T00:00:00.000Z',
  };
  window.designhub = {
    listTasks: vi.fn(async () => [{
      id: 'local-task-restored', requestId: 'local-task-restored', state: 'completed' as const, cancelRequested: false, attempt: 1,
      capability: 'local-composition', source: { kind: 'project' as const, id: 'spring-market' }, documentId: 'doc-1', result: { compositionCandidate: candidate },
    }]),
    resolveCompositionCandidate,
  };

  render(<Workbench {...makeProps({ project: { ...project, libraryId: 'library-1' }, libraryId: 'library-1', documentId: 'doc-1' })} />);

  expect(await screen.findByTestId('canvas-candidate-scene')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '放弃候选' }));
  await waitFor(() => expect(resolveCompositionCandidate).toHaveBeenCalledWith({ libraryId: 'library-1', taskId: 'local-task-restored', resolution: 'discarded' }));
  expect(screen.queryByTestId('canvas-candidate-scene')).not.toBeInTheDocument();
});

it('lays out the workbench around one canvas surface', () => {
  render(<Workbench {...makeProps()} />);

  const canvas = screen.getByRole('region', { name: '设计画布' });
  expect(canvas.querySelector('.workbench-ruler--horizontal')).toBeInTheDocument();
  expect(canvas.querySelector('.workbench-ruler--vertical')).toBeInTheDocument();
  expect(screen.getByRole('toolbar', { name: '画布工具' })).toBeInTheDocument();
  expect(screen.getByRole('toolbar', { name: '上下文工具' })).toBeInTheDocument();
  expect(screen.getByRole('form', { name: 'AI 操作坞' })).toBeInTheDocument();
  expect(document.querySelector('.workbench-body')).toHaveClass(
    'workbench-body--canvas-first',
  );
  const zoomIn = screen.getByRole('button', { name: '放大' });
  expect(zoomIn).toHaveAttribute('data-tooltip', '放大');
  fireEvent.mouseEnter(zoomIn);
  expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('放大');
  expect(zoomIn).toHaveAttribute('aria-describedby');
  fireEvent.mouseLeave(zoomIn);
});

it('centers the current draft when the canvas first opens on a wide viewport', async () => {
  const scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
  const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}),
  });
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
  rectSpy.mockImplementation(() => {
    const element = rectSpy.mock.contexts.at(-1) as HTMLElement;
    if (element.classList.contains('workbench-canvas__stage')) return rect(0, 0, 1440, 900);
    if (element.dataset.draftRole === 'current') return rect(720, 450, 280, 373);
    return rect(0, 0, 0, 0);
  });

  render(<Workbench {...makeProps()} />);

  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ left: 140, top: 186.5, behavior: 'smooth' }));
  rectSpy.mockRestore();
});

it('keeps an active generation batch centered when an existing candidate is selected', async () => {
  const scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
  const animationFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}),
  });
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
  rectSpy.mockImplementation(() => {
    const element = rectSpy.mock.contexts.at(-1) as HTMLElement;
    if (element.classList.contains('workbench-canvas__stage')) return rect(0, 0, 800, 600);
    if (element.dataset.generationBatchId === 'generation-active') return rect(1200, 900, 180, 240);
    if (element.dataset.candidateId === 'candidate-existing') return rect(400, 300, 280, 373);
    return rect(0, 0, 0, 0);
  });
  const existingTask: TaskRecord = {
    id: 'generation-existing', requestId: 'request-existing', state: 'completed', cancelRequested: false, attempt: 1,
    capability: 'design-generation', analysisThreadId: 'thread-1', documentId: 'doc-1', createdAt: '2026-10-08T00:00:00.000Z',
    source: { kind: 'project', id: 'spring-market' },
    result: { imageCount: 1, candidate: { id: 'candidate-existing', baseRevisionId: null, assetIds: ['asset-existing'], sceneAssetId: 'asset-existing', createdAt: '2026-10-08T00:00:01.000Z' } },
  };
  const activeTask: TaskRecord = {
    id: 'generation-active', requestId: 'request-active', state: 'running', cancelRequested: false, attempt: 1,
    capability: 'design-generation', analysisThreadId: 'thread-1', documentId: 'doc-1', createdAt: '2026-10-08T00:01:00.000Z',
    source: { kind: 'project', id: 'spring-market' }, generationSlots: createDesignGenerationSlots(1),
  };
  window.designhub = { listTasks: vi.fn(async () => [existingTask, activeTask]) };

  render(<Workbench {...makeProps({ project: { ...project, libraryId: 'workspace-1' }, libraryId: 'workspace-1', documentId: 'doc-1' })} />);

  await waitFor(() => expect(screen.getByRole('button', { name: '候选设计稿' })).toHaveAttribute('aria-pressed', 'true'));
  expect(scrollTo.mock.calls.at(-1)?.[0]).toEqual({ left: 890, top: 720, behavior: 'smooth' });
  animationFrame.mockRestore();
  rectSpy.mockRestore();
});

it('shows the conversation designer and keeps prompt actions adjacent', () => {
  render(<Workbench {...makeProps({
    project: { ...project, activeDesignerVersionId: 'gu-yan', designerSnapshot: { id: 'gu-yan', name: { zh: '顾言', en: 'Gu Yan' }, artworkUrl: '/gu-yan.png', artworkAlt: { zh: '顾言', en: 'Gu Yan' } } },
  })} />);
  const dock = screen.getByRole('form', { name: 'AI 操作坞' });
  expect(dock).toHaveClass('conversation-dock--compact');
  expect(within(dock).getByText('顾言')).toBeInTheDocument();
  expect(within(dock).getByRole('img', { name: '顾言的人物形象' })).toBeInTheDocument();
  expect(within(dock).queryByText('当前对话设计师')).not.toBeInTheDocument();
  expect(within(dock).queryByText('模型已连接')).not.toBeInTheDocument();
  const controls = Array.from(dock.querySelectorAll('textarea, button')).map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim());
  expect(controls.indexOf('发送')).toBeGreaterThan(controls.indexOf('生成'));
  expect(dock.querySelector('.conversation-dock__toolbar')).toBeInTheDocument();
  expect(dock.querySelector('.conversation-dock__input-wrap')).toBeInTheDocument();
  expect(within(dock).getByRole('button', { name: '模型任务' })).toHaveAttribute('data-tooltip', '模型任务');
});

it('routes command dock shortcuts to tasks and version history', () => {
  const onTasks = vi.fn();
  render(<Workbench {...makeProps({ onTasks })} />);
  const dock = screen.getByRole('form', { name: 'AI 操作坞' });
  fireEvent.click(within(dock).getByRole('button', { name: '模型任务' }));
  expect(onTasks).toHaveBeenCalledOnce();
  fireEvent.click(within(dock).getByRole('button', { name: '版本历史' }));
  expect(screen.getByRole('dialog', { name: '历史' })).toBeInTheDocument();
});

it('opens layers and properties as floating canvas panels', () => {
  render(<Workbench {...makeProps()} />);

  fireEvent.click(screen.getByRole('button', { name: '图层' }));
  expect(screen.getByRole('complementary', { name: '图层' })).toHaveClass(
    'workbench-layers--expanded',
  );

  fireEvent.click(screen.getByRole('button', { name: '属性' }));
  expect(screen.getByRole('complementary', { name: '属性' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: '属性' })).not.toBeInTheDocument();
});

it('focuses the command dock for conversation and keeps detailed contexts in drawers', () => {
  render(<Workbench {...makeProps()} />);

  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  expect(screen.getByRole('textbox', { name: '修改说明' })).toHaveFocus();

  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  expect(screen.getByRole('dialog', { name: '历史' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  expect(screen.getByRole('dialog', { name: '工具' })).toBeInTheDocument();
});

it('opens a workbench context drawer without narrowing the canvas', () => {
  render(<Workbench {...makeProps()} />);

  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  expect(screen.getByRole('dialog', { name: '工具' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog', { name: '工具' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
});

it('keeps conversation actions in the canvas command dock', () => {
  render(<Workbench {...makeProps()} />);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  expect(screen.getByRole('form', { name: 'AI 操作坞' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '生成' })).toBeInTheDocument();
});

it('keeps the workbench canvas clear until a context is selected', () => {
  render(<Workbench {...makeProps()} />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
});

it('exposes the design canvas, routes the project action, and keeps export out of the header', () => {
  const props = makeProps();
  render(<Workbench {...props} />);

  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
  expect(screen.getByText('预览未保存')).toBeInTheDocument();
  expect(screen.getByText('1080 × 1440 px')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '属性' }));
  expect(screen.getByRole('textbox', { name: '标题文字' })).toHaveValue(
    '春间市集',
  );
  fireEvent.click(screen.getByRole('button', { name: '返回项目' }));

  expect(props.onBack).toHaveBeenCalledOnce();
  expect(within(document.querySelector('.workbench-toolbar')!).queryByRole('button', { name: '导出' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('toolbar', { name: '上下文工具' })).getByRole('button', { name: '导出所选候选' })).toBeDisabled();
});

it('bootstraps an empty document with its persisted dimensions', () => {
  const sizedProject: Project = {
    ...project,
    documentEntries: [{ id: 'square-doc', name: '方图', width: 1080, height: 1080 }],
  };
  render(<Workbench {...makeProps({ project: sizedProject, documentId: 'square-doc' })} />);
  expect(screen.getByText('1080 × 1080 px')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '画布图像工具' }));
  fireEvent.click(screen.getByRole('button', { name: '配置调整尺寸' }));
  const dialog = screen.getByRole('dialog', { name: '调整尺寸' });
  expect(within(dialog).getByRole('spinbutton', { name: '宽度' })).toHaveValue(1080);
  expect(within(dialog).getByRole('spinbutton', { name: '高度' })).toHaveValue(1080);
});

it('makes layer visibility and text properties observable on the example preview', () => {
  render(<Workbench {...makeProps()} />);
  const canvas = screen.getByRole('region', { name: '设计画布' });

  fireEvent.click(screen.getByRole('button', { name: '标题文字' }));
  fireEvent.change(screen.getByRole('textbox', { name: '标题文字' }), {
    target: { value: '周末花市' },
  });
  fireEvent.change(screen.getByRole('slider', { name: '不透明度' }), {
    target: { value: '42' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'X 坐标' }), {
    target: { value: '18' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Y 坐标' }), {
    target: { value: '-12' },
  });

  const previewTitle = within(canvas).getByText('周末花市');
  expect(previewTitle).toHaveStyle({
    opacity: '0.42',
    transform: 'translate(18px, -12px)',
  });
  expect(canvas.querySelector('.workbench-selection')).toHaveStyle({
    transform: 'translate(18px, -12px)',
  });

  fireEvent.click(screen.getByRole('button', { name: '隐藏标题文字' }));
  expect(canvas).toHaveAttribute('data-text-visible', 'false');
  expect(
    screen.getByRole('button', { name: '显示标题文字' }),
  ).toBeInTheDocument();
});

it('does not expose title transforms as editable properties for non-text layers', () => {
  render(<Workbench {...makeProps()} />);
  fireEvent.click(screen.getByRole('button', { name: '属性' }));
  fireEvent.change(screen.getByRole('textbox', { name: '标题文字' }), {
    target: { value: '保留标题' },
  });

  fireEvent.click(screen.getByRole('button', { name: '装饰图形' }));

  expect(screen.getByText('此示例仅开放文字属性')).toBeInTheDocument();
  expect(
    screen.queryByRole('textbox', { name: '标题文字' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('spinbutton', { name: 'X 坐标' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('slider', { name: '不透明度' }),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '标题文字' }));
  expect(screen.getByRole('textbox', { name: '标题文字' })).toHaveValue(
    '保留标题',
  );
});

it('prevents edits while the selected text layer is locked', () => {
  render(<Workbench {...makeProps()} />);

  fireEvent.click(screen.getByRole('button', { name: '锁定标题文字' }));
  fireEvent.click(screen.getByRole('button', { name: '标题文字' }));

  expect(screen.getByRole('textbox', { name: '标题文字' })).toBeDisabled();
  expect(screen.getByRole('spinbutton', { name: 'X 坐标' })).toBeDisabled();
  expect(screen.getByRole('spinbutton', { name: 'Y 坐标' })).toBeDisabled();
  expect(screen.getByRole('slider', { name: '不透明度' })).toBeDisabled();
  expect(screen.getByText('解锁图层后可继续编辑')).toBeInTheDocument();
});

it('only offers a shape layer when the artwork has a shape target', () => {
  render(
    <Workbench {...makeProps({ project: { ...project, artwork: 'type' } })} />,
  );

  expect(
    screen.queryByRole('button', { name: '装饰图形' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '形状工具' }),
  ).not.toBeInTheDocument();
});

it('uses the select tool to reopen properties and the compact layer selector', () => {
  render(<Workbench {...makeProps()} />);
  fireEvent.click(screen.getByRole('button', { name: '历史' }));

  fireEvent.click(screen.getByRole('button', { name: '选择工具' }));

  expect(screen.getByRole('complementary', { name: '属性' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '图层' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

it('keeps one context panel open and preserves a prompt when connection setup is required', () => {
  const props = makeProps();
  render(<Workbench {...props} />);

  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  const panel = screen.getByRole('form', { name: 'AI 操作坞' });
  const prompt = within(panel).getByRole('textbox', { name: '修改说明' });
  fireEvent.change(prompt, { target: { value: '保留标题，只调整背景层次' } });
  fireEvent.click(within(panel).getByRole('button', { name: '发送' }));

  expect(props.onConnections).toHaveBeenCalledOnce();
  expect(prompt).toHaveValue('保留标题，只调整背景层次');
  expect(within(panel).getByText('未设置设计师')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  expect(
    screen.queryByRole('dialog', { name: '对话' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('dialog', { name: '历史' }),
  ).toBeInTheDocument();
});

it('submits a conversation through the active project service when provided', () => {
  const onSubmitConversation = vi.fn();
  render(<Workbench {...makeProps({ onSubmitConversation })} />);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  const panel = screen.getByRole('form', { name: 'AI 操作坞' });
  const prompt = within(panel).getByRole('textbox', { name: '修改说明' });
  fireEvent.change(prompt, { target: { value: '调整标题间距' } });
  fireEvent.click(within(panel).getByRole('button', { name: '发送' }));
  expect(onSubmitConversation).toHaveBeenCalledWith('调整标题间距', []);
  expect(prompt).toHaveValue('');
});

it('disables the conversation send control while submission is in flight', () => {
  const onSubmitConversation = vi.fn(() => new Promise<null>(() => undefined));
  render(<Workbench {...makeProps({ onSubmitConversation })} />);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  const panel = screen.getByRole('form', { name: 'AI 操作坞' });
  const prompt = within(panel).getByRole('textbox', { name: '修改说明' });
  fireEvent.change(prompt, { target: { value: '发送时保持按钮忙碌' } });
  const send = within(panel).getByRole('button', { name: '发送' });

  fireEvent.click(send);

  expect(onSubmitConversation).toHaveBeenCalledOnce();
  expect(send).toBeDisabled();
});

it('refreshes analysis progress at a responsive interval while a conversation runs', async () => {
  const task = {
    id: 'conversation-running', requestId: 'request-running', state: 'queued' as const,
    cancelRequested: false, attempt: 1, capability: 'conversation' as const, documentId: 'doc-1',
    source: { kind: 'project' as const, id: 'spring-market' },
  };
  const listTasks = vi.fn(async () => [task]);
  window.designhub = { listTasks };
  const onSubmitConversation = vi.fn(async () => task);
  const interval = vi.spyOn(window, 'setInterval');
  const view = render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', onSubmitConversation })} />);
  try {
    fireEvent.click(screen.getByRole('button', { name: '对话' }));
    const panel = screen.getByRole('form', { name: 'AI 操作坞' });
    fireEvent.change(within(panel).getByRole('textbox', { name: '修改说明' }), { target: { value: '实时显示分析' } });
    fireEvent.click(within(panel).getByRole('button', { name: '发送' }));
    await waitFor(() => expect(interval).toHaveBeenCalledWith(expect.any(Function), 250));
  } finally {
    view.unmount();
    interval.mockRestore();
  }
});

it('consumes a home conversation once through the normal analysis path', async () => {
  const onSubmitConversation = vi.fn(async () => ({
    id: 'conversation-home',
    requestId: 'request-home',
    state: 'queued' as const,
    cancelRequested: false,
    attempt: 1,
    capability: 'conversation' as const,
    documentId: 'doc-1',
    source: { kind: 'project' as const, id: 'spring-market' },
  }));
  const onInitialConversationConsumed = vi.fn();
  const initialConversation = {
    id: 'launch-1',
    projectId: 'spring-market',
    documentId: 'doc-1',
    message: '设计一张海报',
    attachments: [],
  };
  const view = render(<Workbench {...makeProps({ onSubmitConversation, initialConversation, onInitialConversationConsumed })} />);

  await waitFor(() => expect(onSubmitConversation).toHaveBeenCalledWith('设计一张海报', []));
  expect(onInitialConversationConsumed).toHaveBeenCalledWith('launch-1');
  view.rerender(<Workbench {...makeProps({ onSubmitConversation, initialConversation, onInitialConversationConsumed })} />);
  expect(onSubmitConversation).toHaveBeenCalledTimes(1);
});

it('restores a failed home conversation to the command dock', async () => {
  const onSubmitConversation = vi.fn(async () => null);
  render(<Workbench {...makeProps({
    onSubmitConversation,
    initialConversation: {
      id: 'launch-failed',
      projectId: 'spring-market',
      documentId: 'doc-1',
      message: '保留失败的需求',
      attachments: [],
    },
  })} />);

  await waitFor(() => expect(screen.getByRole('textbox', { name: '修改说明' })).toHaveValue('保留失败的需求'));
});

it('chains a completed conversation into design generation', async () => {
  const scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
  let generationLayoutReady = false;
  const animationFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    generationLayoutReady = true;
    callback(0);
    return 1;
  });
  const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}),
  });
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
  rectSpy.mockImplementation(() => {
    const element = rectSpy.mock.contexts.at(-1) as HTMLElement;
    if (element.classList.contains('workbench-canvas__stage')) return rect(0, 0, 800, 600);
    if (element.dataset.generationBatchId === 'design-1' && generationLayoutReady) return rect(1200, 900, 900, 373);
    return rect(0, 0, 0, 0);
  });
  const onSubmitConversation = vi.fn(async () => ({ id: 'conversation-1', requestId: 'request-1', state: 'completed' as const, cancelRequested: false, attempt: 1, capability: 'conversation', documentId: 'doc-1', source: { kind: 'project' as const, id: 'spring-market' }, result: { text: 'Use a calm editorial hierarchy.' } }));
  const onSubmitDesignGeneration = vi.fn(async () => ({ id: 'design-1', requestId: 'request-2', state: 'running' as const, cancelRequested: false, attempt: 1, capability: 'design-generation', generationSlots: createDesignGenerationSlots() }));
  render(<Workbench {...makeProps({ onSubmitConversation, onSubmitDesignGeneration })} />);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成一张安静的主视觉' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(screen.getAllByRole('status').some((element) => element.textContent?.includes('对话理解完成'))).toBe(true));
  expect(screen.getByRole('complementary', { name: '设计分析' })).toBeInTheDocument();
  const conversationButton = screen.getByRole('button', { name: '对话' });
  expect(conversationButton).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(conversationButton);
  expect(screen.queryByRole('complementary', { name: '设计分析' })).not.toBeInTheDocument();
  fireEvent.click(conversationButton);
  expect(screen.getByRole('complementary', { name: '设计分析' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '生成多张' }));
  await waitFor(() => expect(onSubmitDesignGeneration).toHaveBeenCalledWith('conversation-1', null, '3:4', 3));
  expect(document.querySelector('.workbench-canvas-world .workbench-candidate-board')).toBeInTheDocument();
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ left: 1250, top: 786.5, behavior: 'smooth' }));
  animationFrame.mockRestore();
  rectSpy.mockRestore();
});

it('blocks design generation when conversation analysis requires clarification', async () => {
  const conversation: TaskRecord = {
    id: 'conversation-ambiguous',
    requestId: 'request-ambiguous',
    state: 'completed' as const,
    cancelRequested: false,
    attempt: 1,
    capability: 'conversation' as const,
    analysisThreadId: 'thread-ambiguous',
    documentId: 'doc-1',
    source: { kind: 'project' as const, id: 'spring-market' },
    result: { text: '请确认要编辑哪一张图片。' },
    visualContextPlan: {
      version: 1 as const,
      items: [
        { assetId: 'asset-a', roles: ['visual-reference'], confidence: 0 },
        { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0 },
      ],
      clarificationRequired: true,
    },
  };
  const onSubmitConversation = vi.fn(async () => conversation);
  const onSubmitDesignGeneration = vi.fn(async () => null);
  render(<Workbench {...makeProps({ onSubmitConversation, onSubmitDesignGeneration })} />);

  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '根据这两张图生成设计稿' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));

  await waitFor(() => expect(screen.getByRole('button', { name: '生成单张' })).toBeDisabled());
  expect(screen.getByRole('button', { name: '生成多张' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '生成多张' }));
  expect(onSubmitDesignGeneration).not.toHaveBeenCalled();
});

it('supports plural candidates and retries a failed generation slot', async () => {
  const retryDesignGenerationSlot = vi.fn();
  window.designhub = { retryDesignGenerationSlot };
  const conversation = {
    id: 'conversation-1', requestId: 'request-1', state: 'completed' as const, cancelRequested: false, attempt: 1,
    capability: 'conversation', analysisThreadId: 'thread-1', documentId: 'doc-1', source: { kind: 'project' as const, id: 'spring-market' },
    result: { text: 'Brief' },
  };
  const candidates = [
    { id: 'candidate-primary', baseRevisionId: null, assetIds: ['asset-primary'], sceneAssetId: 'asset-primary', createdAt: '2026-09-20T00:00:00.000Z' },
    { id: 'candidate-expressive', baseRevisionId: null, assetIds: ['asset-expressive'], sceneAssetId: 'asset-expressive', createdAt: '2026-09-20T00:00:02.000Z' },
  ];
  const generation = {
    id: 'design-1', requestId: 'request-2', state: 'completed' as const, cancelRequested: false, attempt: 1,
    capability: 'design-generation', analysisThreadId: 'thread-1', documentId: 'doc-1', source: { kind: 'project' as const, id: 'spring-market' },
    generationSlots: [
      { id: 'primary' as const, direction: 'primary', state: 'completed' as const, attempt: 1, assetId: 'asset-primary', candidateId: 'candidate-primary' },
      { id: 'composition' as const, direction: 'composition', state: 'failed' as const, attempt: 1, errorCode: 'PROVIDER_REQUEST_FAILED' },
      { id: 'expressive' as const, direction: 'expressive', state: 'completed' as const, attempt: 1, assetId: 'asset-expressive', candidateId: 'candidate-expressive' },
    ],
    result: { imageCount: 2, candidates },
  };
  retryDesignGenerationSlot.mockImplementation(async () => ({
    ...generation,
    state: 'running' as const,
    generationSlots: generation.generationSlots.map((slot) => slot.id === 'composition'
      ? { ...slot, state: 'queued' as const, attempt: 2, errorCode: undefined }
      : slot),
  }));
  const onSubmitConversation = vi.fn(async () => conversation);
  const onSubmitDesignGeneration = vi.fn(async () => generation);
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', onSubmitConversation, onSubmitDesignGeneration })} />);

  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成海报' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '生成多张' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '生成多张' }));

  await waitFor(() => expect(screen.getByRole('button', { name: '重新生成构图探索' })).toBeVisible());
  expect(screen.getByRole('button', { name: '主方案' })).toBeVisible();
  expect(screen.getByRole('button', { name: '视觉突破' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  expect(screen.getAllByText('候选')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '重新生成构图探索' }));
  await waitFor(() => expect(retryDesignGenerationSlot).toHaveBeenCalledWith({ libraryId: 'workspace-1', taskId: 'design-1', slotId: 'composition' }));
});

it('shows the preferred completed design candidate directly in the canvas', async () => {
  const scene = createScene({ id: 'scene-canvas-candidate', width: 1080, height: 1440, layers: [
    { id: 'source-image', type: 'image', assetId: 'asset-source', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  window.designhub = {
    listTasks: vi.fn(async () => [{
      id: 'design-candidate-task',
      requestId: 'request-design-candidate',
      state: 'completed' as const,
      cancelRequested: false,
      attempt: 1,
      capability: 'design-generation',
      analysisThreadId: 'thread-candidate',
      documentId: 'doc-candidate',
      source: { kind: 'project' as const, id: 'spring-market' },
      generationSlots: [
        { id: 'primary' as const, direction: 'primary', state: 'completed' as const, attempt: 1, assetId: 'asset-primary', candidateId: 'candidate-primary' },
        { id: 'composition' as const, direction: 'composition', state: 'failed' as const, attempt: 1, errorCode: 'IMAGE_RESULT_EMPTY' },
        { id: 'expressive' as const, direction: 'expressive', state: 'failed' as const, attempt: 1, errorCode: 'IMAGE_RESULT_EMPTY' },
      ],
      result: { imageCount: 1, candidates: [{ id: 'candidate-primary', baseRevisionId: 'revision-base', assetIds: ['asset-primary'], sceneAssetId: 'asset-primary', createdAt: '2026-09-28T00:00:00.000Z' }] },
    }]),
    readAsset: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
  };

  render(<Workbench {...makeProps({ libraryId: 'library-1', documentId: 'doc-candidate', scene })} />);

  await waitFor(() => expect(screen.getByTestId('canvas-candidate-scene')).toHaveAttribute('data-candidate-id', 'candidate-primary'));
  expect(screen.getByTestId('canvas-candidate-scene')).toHaveAttribute('data-draft-role', 'candidate');
  expect(screen.getByRole('button', { name: '确认候选' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '放弃候选' })).toBeInTheDocument();
});

it('shows a completed image-tool result as a confirmable canvas candidate', async () => {
  const scene = createScene({ id: 'scene-tool-candidate', width: 800, height: 800, layers: [
    { id: 'image-one', type: 'image', assetId: 'asset-source', x: 0, y: 0, width: 800, height: 800, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  window.designhub = {
    listTasks: vi.fn(async () => [{
      id: 'remove-background-task', requestId: 'request-remove-background', state: 'completed' as const,
      cancelRequested: false, attempt: 1, capability: 'image-editing', tool: 'remove-background' as const,
      sourceAssetId: 'asset-source', documentId: 'doc-tool-candidate', baseRevisionId: 'revision-base',
      source: { kind: 'project' as const, id: 'spring-market' },
      result: { imageCount: 1, candidate: { id: 'candidate-remove-background', baseRevisionId: 'revision-base', assetIds: ['asset-result'], sceneAssetId: 'asset-result', createdAt: '2026-09-28T00:00:00.000Z' } },
    }]),
    readAsset: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
  };

  render(<Workbench {...makeProps({ libraryId: 'library-1', documentId: 'doc-tool-candidate', scene })} />);

  await waitFor(() => expect(screen.getByTestId('canvas-candidate-scene')).toHaveAttribute('data-candidate-id', 'candidate-remove-background'));
  expect(screen.getByRole('button', { name: '确认候选' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '放弃候选' })).toBeInTheDocument();
});

it('adds pasted images above the prompt and supports preview and removal', async () => {
  const image = new File([new Uint8Array([137, 80, 78, 71])], 'reference.png', { type: 'image/png' });
  const onSubmitConversation = vi.fn();
  render(<Workbench {...makeProps({ onSubmitConversation })} />);
  const prompt = screen.getByRole('textbox', { name: '修改说明' });

  fireEvent.paste(prompt, { clipboardData: { files: [image] } });
  const attachment = await screen.findByRole('button', { name: '预览 reference.png' });
  expect(attachment.closest('.conversation-dock__attachments')).toBeInTheDocument();
  expect(attachment.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,iVBORw==');
  expect(screen.getByRole('button', { name: '添加图片' })).toHaveAttribute('data-tooltip', '添加图片');
  fireEvent.click(attachment);
  expect(screen.getByRole('dialog', { name: 'reference.png' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));

  fireEvent.change(prompt, { target: { value: '参考这张图调整版式' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(onSubmitConversation).toHaveBeenCalledWith('参考这张图调整版式', [expect.objectContaining({
    name: 'reference.png',
    mimeType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71]),
  })]));

  fireEvent.paste(prompt, { clipboardData: { files: [image] } });
  await screen.findByRole('button', { name: '删除 reference.png' });
  fireEvent.click(screen.getByRole('button', { name: '删除 reference.png' }));
  expect(screen.queryByRole('button', { name: '预览 reference.png' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'reference.png' })).not.toBeInTheDocument();
});

it('submits a generation request through the active project service', async () => {
  const onSubmitImageGeneration = vi.fn(async () => undefined);
  render(<Workbench {...makeProps({ onSubmitImageGeneration })} />);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  const panel = screen.getByRole('form', { name: 'AI 操作坞' });
  fireEvent.change(within(panel).getByRole('textbox', { name: '修改说明' }), { target: { value: '生成春季市集主视觉' } });
  fireEvent.click(within(panel).getByRole('button', { name: '生成' }));
  await waitFor(() => expect(onSubmitImageGeneration).toHaveBeenCalledWith('生成春季市集主视觉', null));
});

it('shows an explicit no-designer state when the project has no persisted snapshot', () => {
  render(<Workbench {...makeProps({ modelConnected: true })} />);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  expect(screen.getByText('未设置设计师')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: '设计师' })).toBeInTheDocument();
  expect(screen.queryByText('当前对话设计师')).not.toBeInTheDocument();
});

it('updates preview zoom and grid without changing the document', () => {
  const scrollTo = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
  const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
    left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}),
  });
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
  rectSpy.mockImplementation(() => {
    const element = rectSpy.mock.contexts.at(-1) as HTMLElement;
    if (element.classList.contains('workbench-canvas__stage')) return rect(0, 0, 800, 600);
    if (element.dataset.draftRole === 'current') return rect(1200, 900, 280, 373);
    return rect(0, 0, 0, 0);
  });
  render(<Workbench {...makeProps()} />);
  const canvas = screen.getByRole('region', { name: '设计画布' });
  const draft = document.querySelector('.workbench-design-card');
  expect(draft).toHaveStyle({ width: '280px', flexBasis: '280px' });

  fireEvent.click(screen.getByRole('button', { name: '放大' }));
  expect(screen.getByText('76%')).toBeInTheDocument();
  expect(draft).toHaveStyle({ width: '313px', flexBasis: '313px' });
  const gridButton = screen.getByRole('button', { name: '网格' });
  expect(gridButton).toBeEnabled();
  fireEvent.click(gridButton);
  expect(canvas).toHaveAttribute('data-grid-visible', 'true');
  fireEvent.click(screen.getByRole('button', { name: '重置缩放' }));
  expect(screen.getByText('68%')).toBeInTheDocument();
  expect(draft).toHaveStyle({ width: '280px', flexBasis: '280px' });
  expect(scrollTo).toHaveBeenCalledWith({ left: 940, top: 786.5, behavior: 'smooth' });
  rectSpy.mockRestore();
});

it('keeps a text-only scene on a sized canvas card so its floating layers remain interactive', () => {
  const scene = createScene({
    id: 'scene-text-only', width: 1080, height: 1440,
    layers: [{ id: 'title', type: 'text', text: '标题', fontFamily: 'Inter', fontSize: 96, fontWeight: 'bold', align: 'center', color: '#24262B', x: 120, y: 520, width: 840, height: 140, rotation: 0, opacity: 1, visible: true, locked: false }],
  });
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', scene })} />);

  const draft = document.querySelector('[data-draft-role="current"]');
  expect(draft).not.toHaveClass('workbench-design-card--empty');
  expect(draft).toHaveStyle({ width: '280px', flexBasis: '280px' });
});

it('reports an empty workspace document when properties cannot inspect a layer', () => {
  const notify = vi.fn();
  const emptyScene = createScene({ id: 'empty-scene', width: 1080, height: 1440, layers: [] });
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', scene: emptyScene, notify })} />);

  fireEvent.click(screen.getByRole('button', { name: '属性' }));

  expect(notify).toHaveBeenCalledWith('当前没有可编辑图层');
});

it('submits an offline canvas resize through the candidate workflow', async () => {
  const onSubmitImageTask = vi.fn(async () => undefined);
  render(<Workbench {...makeProps({ onSubmitImageTask })} />);
  fireEvent.click(screen.getByRole('button', { name: '画布图像工具' }));
  fireEvent.click(screen.getByRole('button', { name: '配置调整尺寸' }));
  const dialog = screen.getByRole('dialog', { name: '调整尺寸' });
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: '宽度' }), { target: { value: '540' } });
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: '高度' }), { target: { value: '720' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '执行' }));
  await waitFor(() => expect(onSubmitImageTask).toHaveBeenCalledWith(expect.objectContaining({ tool: 'resize', params: expect.objectContaining({ width: 540, height: 720 }) })));
});

it('exposes background editing tools with an explicit connection handoff', () => {
  const onConnections = vi.fn();
  render(<Workbench {...makeProps({ onConnections })} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  expect(screen.getByText('去除背景')).toBeInTheDocument();
  expect(screen.getByText('替换背景')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '配置替换背景' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '替换背景' })).getByRole('button', { name: '执行' }));
  expect(onConnections).toHaveBeenCalled();
});

it('submits provider-backed background tools through the active project callback', async () => {
  const onSubmitImageTask = vi.fn(async () => undefined);
  render(<Workbench {...makeProps({ onSubmitImageTask })} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  fireEvent.click(screen.getByRole('button', { name: '配置去除背景' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '去除背景' })).getByRole('button', { name: '执行' }));
  await waitFor(() => expect(onSubmitImageTask).toHaveBeenCalledWith(expect.objectContaining({ tool: 'remove-background' })));
});

it('does not submit an image tool without a selected image layer', async () => {
  const onSubmitImageTask = vi.fn(async () => undefined);
  const notify = vi.fn();
  const scene = createScene({ id: 'no-image-scene', width: 800, height: 600, layers: [
    { id: 'text-only', type: 'text', text: '标题', fontFamily: 'sans-serif', fontSize: 24, fontWeight: '400', align: 'left', color: '#111111', x: 0, y: 0, width: 200, height: 40, rotation: 0, opacity: 1, visible: true, locked: false },
  ] });
  render(<Workbench {...makeProps({ libraryId: 'library-1', documentId: 'doc-1', scene, onSubmitImageTask, notify })} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  fireEvent.click(screen.getByRole('button', { name: '配置去除背景' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '去除背景' })).getByRole('button', { name: '执行' }));

  expect(onSubmitImageTask).not.toHaveBeenCalled();
  expect(notify).toHaveBeenCalledWith('请选择一个图片图层');
});

it('does not submit an invalid configured image tool', () => {
  const onSubmitImageTask = vi.fn(async () => undefined);
  const notify = vi.fn();
  render(<Workbench {...makeProps({ onSubmitImageTask, notify })} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  fireEvent.click(screen.getByRole('button', { name: '配置替换背景' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '替换背景' })).getByRole('button', { name: '执行' }));
  expect(onSubmitImageTask).not.toHaveBeenCalled();
  expect(notify).toHaveBeenCalledWith('参数无效');
});

it('configures smart crop parameters before submitting the image task', async () => {
  const onSubmitImageTask = vi.fn(async () => undefined);
  render(<Workbench {...makeProps({ onSubmitImageTask })} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  fireEvent.click(screen.getByRole('button', { name: '配置智能裁切' }));
  const dialog = screen.getByRole('dialog', { name: '智能裁切' });
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: '宽度' }), { target: { value: '960' } });
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: '高度' }), { target: { value: '640' } });
  fireEvent.change(within(dialog).getByRole('combobox', { name: '焦点' }), { target: { value: 'subject' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '执行' }));
  await waitFor(() => expect(onSubmitImageTask).toHaveBeenCalledWith(expect.objectContaining({
    tool: 'smart-crop',
    params: { width: 960, height: 640, focus: 'subject' },
  })));
});

it('requires and applies a region before submitting a regional image tool', async () => {
  const onSubmitImageTask = vi.fn(async () => undefined);
  render(<Workbench {...makeProps({ onSubmitImageTask })} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  fireEvent.click(screen.getByRole('button', { name: '配置移除对象' }));
  expect(onSubmitImageTask).not.toHaveBeenCalled();
  const mask = within(screen.getByRole('dialog', { name: '移除对象' })).getByRole('form', { name: '遮罩编辑' });
  fireEvent.change(within(mask).getByRole('spinbutton', { name: '宽度' }), { target: { value: '200' } });
  fireEvent.change(within(mask).getByRole('spinbutton', { name: '高度' }), { target: { value: '200' } });
  fireEvent.click(within(mask).getByRole('button', { name: '应用遮罩' }));
  await waitFor(() => expect(onSubmitImageTask).toHaveBeenCalledWith(expect.objectContaining({
    tool: 'remove-object',
    region: { x: 0, y: 0, width: 200, height: 200 },
  })));
});

it('exposes a visible entry and the complete nine-tool canvas image set', async () => {
  const onSubmitImageTask = vi.fn(async () => undefined);
  render(<Workbench {...makeProps({ onSubmitImageTask })} />);
  fireEvent.click(screen.getByRole('button', { name: '画布图像工具' }));
  for (const label of ['去除背景', '替换背景', '移除对象', '局部重绘', '扩展画布', '智能裁切', '放大图像', '调整尺寸', '移除水印']) {
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `配置${label}` })).toBeInTheDocument();
  }
});

it('provides the exact English canvas and back labels', () => {
  render(<Workbench {...makeProps({ locale: 'en' })} />);

  expect(
    screen.getByRole('region', { name: 'Design canvas' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Back to project' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Unsaved preview')).toBeInTheDocument();
});

it('labels a workspace-backed workbench as a local session', () => {
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1' })} />);
  expect(screen.getByText('本地会话')).toBeInTheDocument();
  expect(screen.queryByText('示例会话')).not.toBeInTheDocument();
});

it('keeps a read-only workspace from persisting edits or submitting tasks', async () => {
  const saveDocumentScene = vi.fn(async () => true);
  const onSubmitConversation = vi.fn();
  const onSubmitImageTask = vi.fn(async () => undefined);
  window.designhub = { saveDocumentScene };
  const scene = createScene({
    id: 'scene-read-only', width: 1080, height: 1440,
    layers: [{ id: 'title', type: 'text', text: '春间市集', fontFamily: 'Inter', fontSize: 96, fontWeight: 'bold', align: 'center', color: '#24262B', x: 120, y: 520, width: 840, height: 140, rotation: 0, opacity: 1, visible: true, locked: false }],
  });
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', scene, readOnly: true, onSubmitConversation, onSubmitImageTask })} />);

  fireEvent.click(screen.getByRole('button', { name: '图层' }));
  fireEvent.click(screen.getByRole('button', { name: '春间市集' }));
  expect(screen.getByRole('spinbutton', { name: '横坐标' })).toBeDisabled();
  expect(saveDocumentScene).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '提交修改' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(onSubmitConversation).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  fireEvent.click(screen.getByRole('button', { name: '配置去除背景' }));
  expect(onSubmitImageTask).not.toHaveBeenCalled();
});

it('renders the persisted canvas workspace for a real project document', () => {
  const scene = createScene({ id: 'scene-1', width: 1080, height: 1440, layers: [] });
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', scene })} />);

  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '图层' }));
  expect(screen.getByRole('complementary', { name: '图层' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: '检查器' })).not.toBeInTheDocument();
});

it('persists property edits into the active document scene', async () => {
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { saveDocumentScene };
  const scene = createScene({
    id: 'scene-1', width: 1080, height: 1440,
    layers: [{ id: 'title', type: 'text', text: '春间市集', fontFamily: 'Inter', fontSize: 96, fontWeight: 'bold', align: 'center', color: '#24262B', x: 120, y: 520, width: 840, height: 140, rotation: 0, opacity: 1, visible: true, locked: false }],
  });
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', scene })} />);
  fireEvent.click(screen.getByRole('button', { name: '图层' }));
  fireEvent.click(screen.getByRole('button', { name: '春间市集' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文字内容' }), { target: { value: '新的标题' } });
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-1', projectId: 'spring-market', documentId: 'doc-1',
    scene: expect.objectContaining({ layers: [expect.objectContaining({ text: '新的标题' })] }),
  })));
});

it('hydrates a saved document once without reloading on workbench renders', async () => {
  const savedScene = createScene({
    id: 'saved-scene', width: 1080, height: 1440,
    layers: [{ id: 'saved-title', type: 'text', text: 'Saved title', fontFamily: 'sans-serif', fontSize: 72, fontWeight: 'bold', align: 'left', color: '#24262B', x: 100, y: 100, width: 880, height: 120, rotation: 0, opacity: 1, visible: true, locked: false }],
  });
  const loadDocumentScene = vi.fn().mockResolvedValueOnce(savedScene).mockResolvedValue(null);
  window.designhub = { loadDocumentScene };
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1' })} />);

  fireEvent.click(screen.getByRole('button', { name: '图层' }));
  await screen.findByRole('button', { name: 'Saved title' });
  fireEvent.click(screen.getByRole('button', { name: '放大' }));
  expect(loadDocumentScene).toHaveBeenCalledOnce();
});

it('selects the real text layer when the text tool is chosen', () => {
  const scene = createScene({
    id: 'tool-scene', width: 1080, height: 1440,
    layers: [{ id: 'real-title', type: 'text', text: 'Real title', fontFamily: 'sans-serif', fontSize: 72, fontWeight: 'bold', align: 'left', color: '#24262B', x: 100, y: 100, width: 880, height: 120, rotation: 0, opacity: 1, visible: true, locked: false }],
  });
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', scene })} />);
  fireEvent.click(screen.getByRole('button', { name: '文本工具' }));
  expect(screen.getByRole('textbox', { name: '文字内容' })).toHaveValue('Real title');
});

it('loads persisted revisions and saves a new version from the history panel', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null }));
  const commitDocumentRevision = vi.fn(async () => ({ revisionId: 'revision-1' }));
  window.designhub = { loadDocumentRevisions, commitDocumentRevision };
  const scene = createScene({ id: 'scene-1', width: 1080, height: 1440, layers: [] });
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', scene })} />);
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  await waitFor(() => expect(loadDocumentRevisions).toHaveBeenCalledWith('workspace-1', 'spring-market', 'doc-1'));
  fireEvent.click(screen.getByRole('button', { name: '保存版本' }));
  await waitFor(() => expect(commitDocumentRevision).toHaveBeenCalledWith(expect.objectContaining({ libraryId: 'workspace-1', projectId: 'spring-market', documentId: 'doc-1', baseRevisionId: null, sceneAssetId: 'scene-1' })));
});

it('records the active designer snapshot as a revision contribution', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null }));
  const commitDocumentRevision = vi.fn(async () => ({ revisionId: 'revision-1' }));
  window.designhub = { loadDocumentRevisions, commitDocumentRevision };
  const scene = createScene({ id: 'scene-1', width: 1080, height: 1440, layers: [] });
  const attributed = { ...project, activeDesignerVersionId: 'designer-v2', designerSnapshot: { name: { zh: '林夏', en: 'Lin Xia' }, version: 'v2.0' } };
  render(<Workbench {...makeProps({ project: attributed, libraryId: 'workspace-1', documentId: 'doc-1', scene })} />);
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  fireEvent.click(screen.getByRole('button', { name: '保存版本' }));
  await waitFor(() => expect(commitDocumentRevision).toHaveBeenCalledWith(expect.objectContaining({
    contributions: [{ designerVersionId: 'designer-v2', role: 'lead', designerName: '林夏' }],
    scene,
  })));
});

it('records additional project contributors with distinct revision roles', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null }));
  const commitDocumentRevision = vi.fn(async () => ({ revisionId: 'revision-team' }));
  window.designhub = { loadDocumentRevisions, commitDocumentRevision };
  const scene = createScene({ id: 'scene-team', width: 1080, height: 1440, layers: [] });
  const attributed = {
    ...project,
    activeDesignerVersionId: 'designer-lead',
    designerSnapshot: { name: { zh: '主设计师', en: 'Lead designer' }, version: 'v2.0' },
    contributorDesignerVersionIds: ['designer-lead', 'designer-direction'],
  };
  render(<Workbench {...makeProps({ project: attributed, libraryId: 'workspace-1', documentId: 'doc-1', scene })} />);
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  fireEvent.click(screen.getByRole('button', { name: '保存版本' }));
  await waitFor(() => expect(commitDocumentRevision).toHaveBeenCalledWith(expect.objectContaining({
    contributions: [
      { designerVersionId: 'designer-lead', role: 'lead', designerName: '主设计师' },
      { designerVersionId: 'designer-direction', role: 'direction' },
    ],
  })));
});

it('shows revision contributors and operator attribution in history', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-attribution', projectId: 'spring-market', documentId: 'doc-1', parentRevisionId: null, operationId: 'op-attribution', sceneAssetId: 'scene-attribution', assetIds: [], contributions: [{ designerVersionId: 'designer-lead', role: 'lead' as const, designerName: '主设计师' }, { designerVersionId: 'designer-direction', role: 'direction' as const, designerName: '方向设计师' }], operatorName: 'Sifan', createdAt: '2026-09-12T00:00:00.000Z' }], timeline: [], finalRevisionId: null }));
  window.designhub = { loadDocumentRevisions };
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1' })} />);
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  await waitFor(() => expect(loadDocumentRevisions).toHaveBeenCalledWith('workspace-1', 'spring-market', 'doc-1'));
  await waitFor(() => expect(screen.getByText(/主设计师/)).toBeInTheDocument());
  expect(screen.getByText(/方向设计师/)).toBeInTheDocument();
  expect(screen.getByText('Sifan')).toBeInTheDocument();
  expect(screen.getByText(/主设计师.*主导/)).toBeInTheDocument();
});

it('can continue from a revision scene snapshot and branches the next save from it', async () => {
  const olderScene = createScene({ id: 'scene-old', width: 1080, height: 1440, layers: [] });
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-old', projectId: 'spring-market', documentId: 'doc-1', parentRevisionId: null, operationId: 'op-old', sceneAssetId: 'scene-old', assetIds: [], contributions: [], createdAt: '2026-09-12T00:00:00.000Z', scene: olderScene }], timeline: [], finalRevisionId: null }));
  const commitDocumentRevision = vi.fn(async () => ({ revisionId: 'revision-new' }));
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { loadDocumentRevisions, commitDocumentRevision, saveDocumentScene };
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', scene: createScene({ id: 'scene-current', width: 1080, height: 1440, layers: [] }) })} />);
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '继续' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '继续' }));
  expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ scene: olderScene }));
  fireEvent.click(screen.getByRole('button', { name: '保存版本' }));
  await waitFor(() => expect(commitDocumentRevision).toHaveBeenCalledWith(expect.objectContaining({ baseRevisionId: 'revision-old' })));
});

it('binds image submissions to the latest document revision and exposes candidate actions', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-current', projectId: 'spring-market', documentId: 'doc-1', parentRevisionId: null, operationId: 'op-current', sceneAssetId: 'scene-current', assetIds: [], contributions: [], createdAt: '2026-09-12T00:00:00.000Z' }], timeline: [], finalRevisionId: null }));
  const listTasks = vi.fn(async () => [{ id: 'task-image', requestId: 'request-image', state: 'completed' as const, cancelRequested: false, attempt: 1, capability: 'image-generation', documentId: 'doc-1', source: { kind: 'project' as const, id: 'spring-market' }, result: { imageCount: 1, candidate: { id: 'candidate-task-image', baseRevisionId: 'revision-current', assetIds: ['asset-candidate'], sceneAssetId: 'asset-candidate', createdAt: '2026-09-13T00:00:00.000Z' } } }]);
  const onSubmitImageGeneration = vi.fn();
  window.designhub = { loadDocumentRevisions, listTasks };
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', onSubmitImageGeneration })} />);
  await waitFor(() => expect(loadDocumentRevisions).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成候选' } });
  fireEvent.click(screen.getByRole('button', { name: '生成' }));
  expect(onSubmitImageGeneration).toHaveBeenCalledWith('生成候选', 'revision-current');
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '查看' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '查看' }));
  fireEvent.click(screen.getByRole('button', { name: '比较' }));
  fireEvent.click(screen.getByRole('button', { name: '继续' }));
});

describe.skip('legacy document finalization flow', () => {
it('applies a finalized image candidate to the active canvas scene', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null }));
  const listTasks = vi.fn(async () => [{
    id: 'task-image', requestId: 'request-image', state: 'completed' as const, cancelRequested: false, attempt: 1,
    capability: 'image-generation', documentId: 'doc-1', source: { kind: 'project' as const, id: 'spring-market' },
    result: { candidate: { id: 'candidate-task-image', baseRevisionId: null, assetIds: ['asset-candidate'], sceneAssetId: 'asset-candidate', createdAt: '2026-09-13T00:00:00.000Z' } },
  }]);
  const commitDocumentRevision = vi.fn(async () => ({ revisionId: 'revision-final' }));
  const setFinalDocumentRevision = vi.fn(async () => true);
  const saveDocumentScene = vi.fn(async () => true);
  const scene = createScene({ id: 'scene-current', width: 1080, height: 1440, layers: [{ id: 'image', type: 'image', assetId: 'asset-old', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false }] });
  window.designhub = { loadDocumentRevisions, listTasks, commitDocumentRevision, setFinalDocumentRevision, saveDocumentScene };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<Workbench {...makeProps({ libraryId: 'workspace-1', documentId: 'doc-1', scene })} />);
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '定稿' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '定稿' }));
  await waitFor(() => expect(commitDocumentRevision).toHaveBeenCalledWith(expect.objectContaining({
    scene: expect.objectContaining({ layers: [expect.objectContaining({ assetId: 'asset-candidate' })] }),
  })));
  expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ scene: expect.objectContaining({ layers: [expect.objectContaining({ assetId: 'asset-candidate' })] }) }));
  confirm.mockRestore();
});

const completedConversationTask = {
  id: 'conversation-finalize', requestId: 'request-conversation-finalize', state: 'completed' as const, cancelRequested: false, attempt: 1,
  capability: 'conversation', analysisThreadId: 'thread-finalize', documentId: 'doc-1', source: { kind: 'project' as const, id: 'spring-market' },
  result: { text: 'Use the selected candidate.' },
};

const completedDesignTask = {
  id: 'design-finalize', requestId: 'request-design-finalize', state: 'completed' as const, cancelRequested: false, attempt: 1,
  capability: 'design-generation', analysisThreadId: 'thread-finalize', documentId: 'doc-1', source: { kind: 'project' as const, id: 'spring-market' },
  result: { candidate: { id: 'candidate-finalize', baseRevisionId: null, assetIds: ['asset-candidate'], sceneAssetId: 'asset-candidate', createdAt: '2026-09-20T00:00:00.000Z' } },
};

const renderFinalizableCandidate = async (overrides: Partial<WorkbenchProps> = {}) => {
  const onSubmitConversation = vi.fn(async () => completedConversationTask);
  const onSubmitDesignGeneration = vi.fn(async () => completedDesignTask);
  const result = render(<Workbench {...makeProps({
    libraryId: 'workspace-1',
    documentId: 'doc-1',
    onSubmitConversation,
    onSubmitDesignGeneration,
    ...overrides,
  })} />);
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成候选' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '生成' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '生成' }));
  await screen.findByRole('button', { name: /候选设计稿/ });
  return result;
};

it('enables the right-toolbar finalization action only after selecting a candidate', async () => {
  window.designhub = {
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
  };
  await renderFinalizableCandidate();

  const contextTools = screen.getByRole('toolbar', { name: '上下文工具' });
  const exportSelected = within(contextTools).getByRole('button', { name: '导出所选候选' });
  const finalize = within(contextTools).getByRole('button', { name: '定稿所选候选' });
  expect(exportSelected).toBeDisabled();
  expect(finalize).toBeDisabled();
  expect(exportSelected.querySelector('.ui-icon')).toHaveAttribute('style', expect.stringContaining('download.svg'));
  expect(finalize.querySelector('.ui-icon')).toHaveAttribute('style', expect.stringContaining('circle-check.svg'));

  fireEvent.click(screen.getByRole('button', { name: /候选设计稿/ }));

  expect(exportSelected).toBeEnabled();
  expect(finalize).toBeEnabled();
  expect(screen.getAllByRole('button', { name: '定稿所选候选' })).toHaveLength(1);
});

it('exports only the selected candidate as a document-sized PNG scene', async () => {
  const exportDocument = vi.fn(async () => ({ path: '/tmp/selected-candidate.png', sha256: 'a'.repeat(64) }));
  window.designhub = {
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
    exportDocument,
  };
  const notify = vi.fn();
  await renderFinalizableCandidate({ notify });

  fireEvent.click(screen.getByRole('button', { name: /候选设计稿/ }));
  fireEvent.click(within(screen.getByRole('toolbar', { name: '上下文工具' })).getByRole('button', { name: '导出所选候选' }));

  await waitFor(() => expect(exportDocument).toHaveBeenCalledWith({
    libraryId: 'workspace-1',
    projectId: 'spring-market',
    documentId: 'doc-1',
    format: 'png',
    scene: expect.objectContaining({
      width: 1080,
      height: 1440,
      layers: [expect.objectContaining({
        type: 'image',
        role: 'content',
        assetId: 'asset-candidate',
        width: 1080,
        height: 1440,
      })],
    }),
  }));
  expect(notify).toHaveBeenCalledWith('已导出到 /tmp/selected-candidate.png');
});

it('preserves reference layers and waits for scene storage before leaving', async () => {
  let resolveSave: ((value: boolean) => void) | undefined;
  const saveDocumentScene = vi.fn((input: { libraryId: string; projectId: string; documentId: string; scene: DesignScene }) => {
    void input;
    return new Promise<boolean>((resolve) => { resolveSave = resolve; });
  });
  const onBack = vi.fn();
  const onCandidateFinalized = vi.fn(async () => undefined);
  const scene = createScene({
    id: 'scene-current',
    width: 1080,
    height: 1440,
    layers: [
      { id: 'reference', type: 'image', role: 'reference', assetId: 'asset-reference', x: 10, y: 10, width: 200, height: 200, rotation: 0, opacity: 0.5, visible: true, locked: false },
      { id: 'content', type: 'image', role: 'content', assetId: 'asset-old', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false },
    ],
  });
  window.designhub = {
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
    commitDocumentRevision: vi.fn(async () => ({ revisionId: 'revision-final' })),
    setFinalDocumentRevision: vi.fn(async () => true),
    saveDocumentScene,
  };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await renderFinalizableCandidate({ scene, onBack });
  fireEvent.click(screen.getByRole('button', { name: /候选设计稿/ }));
  fireEvent.click(within(screen.getByRole('toolbar', { name: '上下文工具' })).getByRole('button', { name: '定稿所选候选' }));

  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalled());
  const savedScene = saveDocumentScene.mock.calls[0]![0].scene;
  expect(savedScene.layers).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'reference', assetId: 'asset-reference', role: 'reference' }),
    expect.objectContaining({ id: 'content', assetId: 'asset-candidate', role: 'content' }),
  ]));
  expect(onBack).not.toHaveBeenCalled();

  resolveSave?.(true);
  await waitFor(() => expect(onCandidateFinalized).toHaveBeenCalledWith({ documentId: 'doc-1', revisionId: 'revision-final', scene: savedScene }));
  expect(onBack).toHaveBeenCalledOnce();
  confirm.mockRestore();
});

it('keeps the selected candidate when scene storage fails', async () => {
  const notify = vi.fn();
  const onBack = vi.fn();
  window.designhub = {
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
    commitDocumentRevision: vi.fn(async () => ({ revisionId: 'revision-final' })),
    setFinalDocumentRevision: vi.fn(async () => true),
    saveDocumentScene: vi.fn(async () => false),
  };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await renderFinalizableCandidate({ onBack, notify });
  fireEvent.click(screen.getByRole('button', { name: /候选设计稿/ }));
  const contextTools = screen.getByRole('toolbar', { name: '上下文工具' });
  fireEvent.click(within(contextTools).getByRole('button', { name: '定稿所选候选' }));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('候选定稿失败'));
  expect(onBack).not.toHaveBeenCalled();
  expect(within(contextTools).getByRole('button', { name: '定稿所选候选' })).toBeEnabled();
  confirm.mockRestore();
});

it('reports a failed finalization when revision commit returns no result', async () => {
  const notify = vi.fn();
  const onBack = vi.fn();
  const setFinalDocumentRevision = vi.fn(async () => true);
  window.designhub = {
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
    commitDocumentRevision: vi.fn(async () => null),
    setFinalDocumentRevision,
    saveDocumentScene: vi.fn(async () => true),
  };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await renderFinalizableCandidate({ onBack, notify });
  fireEvent.click(screen.getByRole('button', { name: /候选设计稿/ }));
  const contextTools = screen.getByRole('toolbar', { name: '上下文工具' });
  fireEvent.click(within(contextTools).getByRole('button', { name: '定稿所选候选' }));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('候选定稿失败'));
  expect(setFinalDocumentRevision).not.toHaveBeenCalled();
  expect(onBack).not.toHaveBeenCalled();
  expect(within(contextTools).getByRole('button', { name: '定稿所选候选' })).toBeEnabled();
  confirm.mockRestore();
});

it('keeps the candidate when selecting the final revision is rejected', async () => {
  const notify = vi.fn();
  const onBack = vi.fn();
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = {
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
    commitDocumentRevision: vi.fn(async () => ({ revisionId: 'revision-final' })),
    setFinalDocumentRevision: vi.fn(async () => false),
    saveDocumentScene,
  };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await renderFinalizableCandidate({ onBack, notify });
  fireEvent.click(screen.getByRole('button', { name: /候选设计稿/ }));
  const contextTools = screen.getByRole('toolbar', { name: '上下文工具' });
  fireEvent.click(within(contextTools).getByRole('button', { name: '定稿所选候选' }));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('候选定稿失败'));
  expect(saveDocumentScene).not.toHaveBeenCalled();
  expect(onBack).not.toHaveBeenCalled();
  expect(within(contextTools).getByRole('button', { name: '定稿所选候选' })).toBeEnabled();
  confirm.mockRestore();
});

it('keeps the candidate when project metadata synchronization fails', async () => {
  const notify = vi.fn();
  const onBack = vi.fn();
  const onCandidateFinalized = vi.fn(async () => { throw new Error('PROJECT_METADATA_UPDATE_FAILED'); });
  window.designhub = {
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    readAsset: vi.fn(async () => new Uint8Array([1])),
    commitDocumentRevision: vi.fn(async () => ({ revisionId: 'revision-final' })),
    setFinalDocumentRevision: vi.fn(async () => true),
    saveDocumentScene: vi.fn(async () => true),
  };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await renderFinalizableCandidate({ onBack, notify });
  fireEvent.click(screen.getByRole('button', { name: /候选设计稿/ }));
  const contextTools = screen.getByRole('toolbar', { name: '上下文工具' });
  fireEvent.click(within(contextTools).getByRole('button', { name: '定稿所选候选' }));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('候选定稿失败'));
  expect(onCandidateFinalized).toHaveBeenCalledOnce();
  expect(onBack).not.toHaveBeenCalled();
  expect(within(contextTools).getByRole('button', { name: '定稿所选候选' })).toBeEnabled();
  confirm.mockRestore();
});
});
