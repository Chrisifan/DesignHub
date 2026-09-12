import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

import { Workbench, type WorkbenchProps } from './Workbench';
import type { Project } from './types';
import { createScene } from '../../features/canvas/scene';

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
  onExport: vi.fn(),
  onConnections: vi.fn(),
  notify: vi.fn(),
  ...overrides,
});

it('exposes the design canvas and routes project and export actions', () => {
  const props = makeProps();
  render(<Workbench {...props} />);

  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
  expect(screen.getByText('预览未保存')).toBeInTheDocument();
  expect(screen.getByText('1080 × 1440 px')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '标题文字' })).toHaveValue(
    '春间市集',
  );
  fireEvent.click(screen.getByRole('button', { name: '返回项目' }));
  fireEvent.click(screen.getByRole('button', { name: '导出' }));

  expect(props.onBack).toHaveBeenCalledOnce();
  expect(props.onExport).toHaveBeenCalledOnce();
});

it('bootstraps an empty document with its persisted dimensions', () => {
  const sizedProject: Project = {
    ...project,
    documentEntries: [{ id: 'square-doc', name: '方图', width: 1080, height: 1080 }],
  };
  render(<Workbench {...makeProps({ project: sizedProject, documentId: 'square-doc' })} />);
  expect(screen.getByText('1080 × 1080 px')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  expect(screen.getByRole('spinbutton', { name: '高度' })).toHaveValue(1080);
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

  expect(
    screen.getByRole('complementary', { name: '属性' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '图层' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

it('keeps one context panel open and preserves a prompt when connection setup is required', () => {
  const props = makeProps();
  render(<Workbench {...props} />);

  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  const panel = screen.getByRole('complementary', { name: '对话' });
  const prompt = within(panel).getByRole('textbox', { name: '修改说明' });
  fireEvent.change(prompt, { target: { value: '保留标题，只调整背景层次' } });
  fireEvent.click(within(panel).getByRole('button', { name: '发送' }));

  expect(props.onConnections).toHaveBeenCalledOnce();
  expect(prompt).toHaveValue('保留标题，只调整背景层次');
  expect(within(panel).getByText('尚未连接模型')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  expect(
    screen.queryByRole('complementary', { name: '对话' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('complementary', { name: '历史' }),
  ).toBeInTheDocument();
});

it('submits a conversation through the active project service when provided', () => {
  const onSubmitConversation = vi.fn();
  render(<Workbench {...makeProps({ onSubmitConversation })} />);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  const panel = screen.getByRole('complementary', { name: '对话' });
  const prompt = within(panel).getByRole('textbox', { name: '修改说明' });
  fireEvent.change(prompt, { target: { value: '调整标题间距' } });
  fireEvent.click(within(panel).getByRole('button', { name: '发送' }));
  expect(onSubmitConversation).toHaveBeenCalledWith('调整标题间距');
  expect(prompt).toHaveValue('');
});

it('submits a generation request through the active project service', async () => {
  const onSubmitImageGeneration = vi.fn(async () => undefined);
  render(<Workbench {...makeProps({ onSubmitImageGeneration })} />);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  const panel = screen.getByRole('complementary', { name: '对话' });
  fireEvent.change(within(panel).getByRole('textbox', { name: '修改说明' }), { target: { value: '生成春季市集主视觉' } });
  fireEvent.click(within(panel).getByRole('button', { name: '生成' }));
  await waitFor(() => expect(onSubmitImageGeneration).toHaveBeenCalledWith('生成春季市集主视觉', null));
});

it('shows a connected model state when the host confirms a credential', () => {
  render(<Workbench {...makeProps({ modelConnected: true })} />);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  expect(screen.getByText('模型已连接')).toBeInTheDocument();
});

it('updates preview zoom and grid without changing the document', () => {
  render(<Workbench {...makeProps()} />);
  const canvas = screen.getByRole('region', { name: '设计画布' });

  fireEvent.click(screen.getByRole('button', { name: '放大' }));
  expect(screen.getByText('76%')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '网格' }));
  expect(canvas).toHaveAttribute('data-grid-visible', 'true');
  fireEvent.click(screen.getByRole('button', { name: '重置缩放' }));
  expect(screen.getByText('68%')).toBeInTheDocument();
});

it('applies an offline canvas resize through the tools panel', () => {
  const notify = vi.fn();
  render(<Workbench locale="zh-CN" project={project} onBack={() => undefined} onExport={() => undefined} onConnections={() => undefined} notify={notify} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: '宽度' }), { target: { value: '540' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '高度' }), { target: { value: '720' } });
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(notify).toHaveBeenCalledWith('尺寸已更新');
});

it('exposes background editing tools with an explicit connection handoff', () => {
  const onConnections = vi.fn();
  render(<Workbench {...makeProps({ onConnections })} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  expect(screen.getByText('去除背景')).toBeInTheDocument();
  expect(screen.getByText('替换背景')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: '连接' })[0]!);
  expect(onConnections).toHaveBeenCalled();
});

it('submits provider-backed background tools through the active project callback', async () => {
  const onSubmitImageTask = vi.fn(async () => undefined);
  render(<Workbench {...makeProps({ onSubmitImageTask })} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  fireEvent.click(screen.getAllByRole('button', { name: '去除背景' })[0]!);
  await waitFor(() => expect(onSubmitImageTask).toHaveBeenCalledWith(expect.objectContaining({ tool: 'remove-background' })));
});

it('exposes the complete provider-backed image tool set from the tools panel', async () => {
  const onSubmitImageTask = vi.fn(async () => undefined);
  render(<Workbench {...makeProps({ onSubmitImageTask })} />);
  fireEvent.click(screen.getByRole('button', { name: '工具' }));
  for (const label of ['移除对象', '局部重绘', '扩展画布', '放大图像']) expect(screen.getByText(label)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '移除对象' }));
  fireEvent.click(screen.getByRole('button', { name: '局部重绘' }));
  fireEvent.click(screen.getByRole('button', { name: '扩展画布' }));
  fireEvent.click(screen.getByRole('button', { name: '放大图像' }));
  await waitFor(() => expect(onSubmitImageTask).toHaveBeenCalledWith(expect.objectContaining({ tool: 'upscale' })));
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

it('renders the persisted canvas workspace for a real project document', () => {
  const scene = createScene({ id: 'scene-1', width: 1080, height: 1440, layers: [] });
  render(<Workbench {...makeProps({ workspaceId: 'workspace-1', documentId: 'doc-1', scene })} />);

  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
  expect(screen.getByRole('complementary', { name: '图层' })).toBeInTheDocument();
  expect(screen.getByRole('complementary', { name: '检查器' })).toBeInTheDocument();
});

it('persists property edits into the active document scene', async () => {
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, saveDocumentScene };
  const scene = createScene({
    id: 'scene-1', width: 1080, height: 1440,
    layers: [{ id: 'title', type: 'text', text: '春间市集', fontFamily: 'Inter', fontSize: 96, fontWeight: 'bold', align: 'center', color: '#24262B', x: 120, y: 520, width: 840, height: 140, rotation: 0, opacity: 1, visible: true, locked: false }],
  });
  render(<Workbench {...makeProps({ workspaceId: 'workspace-1', documentId: 'doc-1', scene })} />);
  fireEvent.change(screen.getByRole('textbox', { name: '标题文字' }), { target: { value: '新的标题' } });
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-1', projectId: 'spring-market', documentId: 'doc-1',
    scene: expect.objectContaining({ layers: [expect.objectContaining({ text: '新的标题' })] }),
  })));
});

it('loads persisted revisions and saves a new version from the history panel', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null }));
  const commitDocumentRevision = vi.fn(async () => ({ revisionId: 'revision-1' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentRevisions, commitDocumentRevision };
  const scene = createScene({ id: 'scene-1', width: 1080, height: 1440, layers: [] });
  render(<Workbench {...makeProps({ workspaceId: 'workspace-1', documentId: 'doc-1', scene })} />);
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  await waitFor(() => expect(loadDocumentRevisions).toHaveBeenCalledWith('workspace-1', 'spring-market', 'doc-1'));
  fireEvent.click(screen.getByRole('button', { name: '保存版本' }));
  await waitFor(() => expect(commitDocumentRevision).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-1', projectId: 'spring-market', documentId: 'doc-1', baseRevisionId: null, sceneAssetId: 'scene-1' })));
});

it('records the active designer snapshot as a revision contribution', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null }));
  const commitDocumentRevision = vi.fn(async () => ({ revisionId: 'revision-1' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentRevisions, commitDocumentRevision };
  const scene = createScene({ id: 'scene-1', width: 1080, height: 1440, layers: [] });
  const attributed = { ...project, activeDesignerVersionId: 'designer-v2', designerSnapshot: { name: { zh: '林夏', en: 'Lin Xia' }, version: 'v2.0' } };
  render(<Workbench {...makeProps({ project: attributed, workspaceId: 'workspace-1', documentId: 'doc-1', scene })} />);
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
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentRevisions, commitDocumentRevision };
  const scene = createScene({ id: 'scene-team', width: 1080, height: 1440, layers: [] });
  const attributed = {
    ...project,
    activeDesignerVersionId: 'designer-lead',
    designerSnapshot: { name: { zh: '主设计师', en: 'Lead designer' }, version: 'v2.0' },
    contributorDesignerVersionIds: ['designer-lead', 'designer-direction'],
  };
  render(<Workbench {...makeProps({ project: attributed, workspaceId: 'workspace-1', documentId: 'doc-1', scene })} />);
  fireEvent.click(screen.getByRole('button', { name: '历史' }));
  fireEvent.click(screen.getByRole('button', { name: '保存版本' }));
  await waitFor(() => expect(commitDocumentRevision).toHaveBeenCalledWith(expect.objectContaining({
    contributions: [
      { designerVersionId: 'designer-lead', role: 'lead', designerName: '主设计师' },
      { designerVersionId: 'designer-direction', role: 'direction' },
    ],
  })));
});

it('can continue from a revision scene snapshot and branches the next save from it', async () => {
  const olderScene = createScene({ id: 'scene-old', width: 1080, height: 1440, layers: [] });
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-old', projectId: 'spring-market', documentId: 'doc-1', parentRevisionId: null, operationId: 'op-old', sceneAssetId: 'scene-old', assetIds: [], contributions: [], createdAt: '2026-09-12T00:00:00.000Z', scene: olderScene }], timeline: [], finalRevisionId: null }));
  const commitDocumentRevision = vi.fn(async () => ({ revisionId: 'revision-new' }));
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentRevisions, commitDocumentRevision, saveDocumentScene };
  render(<Workbench {...makeProps({ workspaceId: 'workspace-1', documentId: 'doc-1', scene: createScene({ id: 'scene-current', width: 1080, height: 1440, layers: [] }) })} />);
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
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentRevisions, listTasks };
  render(<Workbench {...makeProps({ workspaceId: 'workspace-1', documentId: 'doc-1', onSubmitImageGeneration })} />);
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
  fireEvent.click(screen.getAllByRole('button', { name: '定稿' }).at(-1)!);
});
