import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Studio } from './studio/Studio';
import type { ProjectMetadata } from '../features/projects/metadata';
import type { UpdateProjectMetadataInput } from '../features/workspace/project-store';
import { createScene } from '../features/canvas/scene';
import { personaProfiles } from '../../tests/fixtures/personas';
import { exampleProjects } from '../../tests/fixtures/examples';
import { previewAssets, previewBrands } from '../../tests/fixtures/libraries';

const persistedProfileIds = {
  'paper-type': 'user-paper',
  'clear-commerce': 'user-commerce',
  'natural-story': 'user-story',
} as const;
const persistedProfiles = personaProfiles
  .filter((profile): profile is typeof personaProfiles[number] => profile.id in persistedProfileIds)
  .map((profile) => ({
    ...profile,
    id: persistedProfileIds[profile.id as keyof typeof persistedProfileIds],
    status: 'published' as const,
  }));

beforeEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(window, 'designhub');
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
});
const enter = () => {
  render(<Studio locale="zh-CN" theme="system" onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} initialProjects={exampleProjects} initialDesignerOptions={personaProfiles} initialAssets={previewAssets as never} initialBrands={previewBrands} />);
};

it('lets an offline user navigate the example workspace without a connection or disk save claim', () => {
  enter();
  const navigation = screen.getByRole('navigation', { name: '主导航' });
  expect(within(navigation).queryByRole('button', { name: '设置' })).not.toBeInTheDocument();
  fireEvent.click(within(navigation).getByRole('button', { name: '设计师' }));
  expect(screen.getByRole('heading', { name: '设计师' })).toBeInTheDocument();
  fireEvent.click(within(navigation).getByRole('button', { name: '模型连接' }));
  expect(screen.getByRole('heading', { name: '模型连接' })).toBeInTheDocument();
  expect(screen.getByText('尚未连接模型')).toBeInTheDocument();
  expect(screen.queryByText('已保存到本地')).not.toBeInTheDocument();
});

it('does not seed an unscoped studio with example projects or designers', async () => {
  render(
    <Studio
      locale="zh-CN"
      theme="system"
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      onExit={() => undefined}
    />,
  );

  expect(screen.getByText('暂无项目')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '设计师' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: /纸感排版/ })).not.toBeInTheDocument());
});

it('wraps an empty project library in the page-level empty-state region', () => {
  render(
    <Studio
      locale="zh-CN"
      theme="system"
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      onExit={() => undefined}
    />,
  );

  expect(
    screen.getByRole('heading', { name: '暂无项目' }).closest('.page-empty-state'),
  ).not.toBeNull();
});

it('shows a design cover with its designer avatar, name, and version', () => {
  enter();
  const project = screen.getByRole('button', { name: '春间市集' });
  expect(within(project).getByRole('img', { name: '春间市集项目封面' })).toHaveAttribute('src', '/project-default-cover.png');
  expect(
    within(project).getByRole('img', { name: '纸感排版的人物形象' }),
  ).toBeInTheDocument();
  expect(within(project).getByText('纸感排版 · v1.4')).toBeInTheDocument();
});

it('keeps a two-line description region for empty and long project briefs', () => {
  const baseProject = exampleProjects[0]!;
  const longDescription = '这是一段足够长的项目简介，用于验证项目卡片在内容超出两行之后仍然保持固定的信息区高度并显示省略号。';
  render(
    <Studio
      locale="zh-CN"
      theme="system"
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      onExit={() => undefined}
      initialProjects={[
        { ...baseProject, id: 'empty-brief', name: '空简介项目', enName: 'Empty brief', description: '', enDescription: '' },
        { ...baseProject, id: 'long-brief', name: '长简介项目', enName: 'Long brief', description: longDescription, enDescription: longDescription },
      ]}
      initialDesignerOptions={personaProfiles}
    />,
  );

  const emptyDescription = screen.getByRole('button', { name: '空简介项目' }).querySelector('.project-card-description');
  const longDescriptionElement = screen.getByRole('button', { name: '长简介项目' }).querySelector('.project-card-description');

  expect(emptyDescription).not.toBeNull();
  expect(emptyDescription).toBeEmptyDOMElement();
  expect(longDescriptionElement).toHaveTextContent(longDescription);
});

it('keeps project actions in the breadcrumb toolbar instead of the page title', () => {
  enter();
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });
  expect(within(toolbar).getByRole('button', { name: '新建项目' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: '新建项目' })).toHaveLength(1);
});

it('opens one new-project drawer without the duplicate creation callout', () => {
  enter();

  expect(screen.getAllByRole('button', { name: '新建项目' })).toHaveLength(1);
  expect(screen.queryByText('下一次创作，从这里开始')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '开始创作' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));

  const drawer = screen.getByRole('dialog', { name: '新建项目' });
  expect(screen.getByRole('button', { name: '春间市集' })).toBeInTheDocument();
  expect(within(drawer).getByRole('textbox', { name: '项目名称' })).toHaveFocus();
  expect(within(drawer).getByRole('button', { name: '取消' }).closest('.ui-drawer__footer')).toBeInTheDocument();
  expect(within(drawer).getByRole('button', { name: '创建预览' }).closest('.ui-drawer__footer')).toBeInTheDocument();
  expect(within(drawer).queryByLabelText('新建设计的当前设计师')).not.toBeInTheDocument();
});

it('orders project controls in the workspace toolbar', () => {
  enter();
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });

  expect(within(toolbar).getByRole('group', { name: '项目状态' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('searchbox', { name: '搜索项目' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('group', { name: '展示方式' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: '新建项目' })).toBeInTheDocument();
  expect(document.querySelector('.project-controls')).not.toBeInTheDocument();
});

it('orders asset controls in the workspace toolbar', () => {
  enter();
  fireEvent.click(
    within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', {
      name: '素材库',
    }),
  );
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });

  expect(within(toolbar).getByRole('group', { name: '类型' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('searchbox', { name: '搜索素材' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('group', { name: '视图' })).toBeInTheDocument();
  expect(document.querySelector('.asset-toolbar')).not.toBeInTheDocument();
});

it('places designer status before search without adding a view switch', () => {
  enter();
  fireEvent.click(
    within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', {
      name: '设计师',
    }),
  );
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });

  expect(within(toolbar).getByRole('group', { name: '档案状态' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('searchbox', { name: '搜索档案' })).toBeInTheDocument();
  expect(within(toolbar).queryByRole('group', { name: '视图' })).not.toBeInTheDocument();
  expect(document.querySelector('.persona-repository__toolbar')).not.toBeInTheDocument();
});

it('shows the cover-led project detail without the duplicate design brief', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: '春间市集' }));

  expect(screen.getByTestId('project-detail-page')).toBeInTheDocument();
  expect(screen.getByTestId('project-detail-hero')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '春间市集' })).toBeInTheDocument();
  expect(screen.getByText('设计文档')).toBeInTheDocument();
  expect(screen.getByText('项目上下文')).toBeInTheDocument();
  expect(screen.getByText('设计协作')).toBeInTheDocument();
  expect(screen.queryByText('设计简报')).not.toBeInTheDocument();
});

it('preserves project search while visiting another destination and offers an empty-result reset', () => {
  enter();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), {
    target: { value: '不存在的项目' },
  });
  expect(screen.getByText('没有匹配的项目')).toBeInTheDocument();
  const navigation = screen.getByRole('navigation', { name: '主导航' });
  fireEvent.click(within(navigation).getByRole('button', { name: '素材库' }));
  fireEvent.click(within(navigation).getByRole('button', { name: '项目库' }));
  expect(screen.getByRole('searchbox', { name: '搜索项目' })).toHaveValue(
    '不存在的项目',
  );
  fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
  expect(screen.getByRole('button', { name: /春间市集/ })).toBeInTheDocument();
});

it('searches the local index across project briefs and contributor tags', () => {
  enter();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), { target: { value: '纸感排版' } });
  expect(screen.getByRole('button', { name: '春间市集' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), { target: { value: '不存在' } });
  expect(screen.getByText('没有匹配的项目')).toBeInTheDocument();
});

it('opens a project document and returns to that project', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: /春间市集/ }));
  fireEvent.click(screen.getByRole('button', { name: '打开主海报' }));
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
  expect(document.querySelector('.studio')).toHaveClass('studio--compact');
  fireEvent.click(screen.getByRole('button', { name: '返回项目' }));
  expect(screen.getByRole('heading', { name: '春间市集' })).toBeInTheDocument();
});

it('creates only a labelled preview draft and keeps project input when dismissing the form', async () => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview-cover'), revokeObjectURL: vi.fn() });
  enter();
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  fireEvent.change(screen.getByLabelText('选择项目封面'), {
    target: { files: [new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', 'blob:preview-cover'));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
    target: { value: '我的测试项目' },
  });
  fireEvent.click(within(screen.getByRole('dialog', { name: '新建项目' })).getByRole('button', { name: '取消' }));
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  expect(screen.getByRole('textbox', { name: '项目名称' })).toHaveValue(
    '我的测试项目',
  );
  expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', 'blob:preview-cover');
  fireEvent.click(screen.getByRole('button', { name: '创建预览' }));
  expect(
    screen.getByRole('heading', { name: '我的测试项目' }),
  ).toBeInTheDocument();
  expect(screen.getAllByText('未保存草稿').length).toBeGreaterThan(0);
  expect(screen.queryByText('已保存到本地')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '项目库' }));
  expect(within(screen.getByRole('button', { name: '我的测试项目' })).getByRole('img', { name: '我的测试项目项目封面' })).toHaveAttribute('src', 'blob:preview-cover');
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', '/project-default-cover.png');
});

it('keeps the draft while the shell controls are used', () => {
  enter();
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
    target: { value: '保留输入' },
  });
  fireEvent.click(within(screen.getByRole('dialog', { name: '新建项目' })).getByRole('button', { name: '取消' }));
  fireEvent.click(screen.getByRole('button', { name: '切换主题' }));
  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  expect(screen.getByRole('textbox', { name: '项目名称' })).toHaveValue(
    '保留输入',
  );
});

it('preserves the originating project when opening delivery from a document', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: '日常之物' }));
  fireEvent.click(screen.getByRole('button', { name: '打开主海报' }));
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  expect(screen.getByRole('heading', { name: '导出交付' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '日常之物' })).toBeInTheDocument();
});

it('hydrates persisted workspace projects and creates through the desktop API', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project' }]);
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-2' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer };
  render(
    <Studio
      locale="zh-CN"
      theme="system"
      workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }}
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      onExit={() => undefined}
    />,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  expect(listActiveProjects).toHaveBeenCalledWith('workspace-1');
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: 'Created project' } });
  fireEvent.click(screen.getByRole('button', { name: '创建项目' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-1', name: 'Created project' })));
  expect(await screen.findByRole('heading', { name: 'Created project' })).toBeInTheDocument();
});

it('imports a selected cover and records only its managed asset id', async () => {
  const now = '2026-09-19T00:00:00.000Z';
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-created' }));
  const importAssets = vi.fn(async () => [{
    status: 'success' as const,
    asset: { id: 'asset-0123456789abcdef', name: 'cover.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: '0'.repeat(64), managed: true },
  }]);
  const updateProjectMetadata = vi.fn(async () => ({
    projectId: 'project-created', workspaceId: 'workspace-1', name: '封面项目', coverAssetId: 'asset-0123456789abcdef', documents: [], archived: false, createdAt: now, updatedAt: now,
  }));
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listActiveProjects: vi.fn(async () => []),
    createProjectContainer,
    importAssets,
    updateProjectMetadata,
  };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:selected-cover'), revokeObjectURL: vi.fn() });
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('heading', { name: '项目库' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  fireEvent.change(screen.getByLabelText('选择项目封面'), {
    target: { files: [new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', 'blob:selected-cover'));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: '封面项目' } });
  fireEvent.click(screen.getByRole('button', { name: '创建项目' }));

  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith({
    workspaceId: 'workspace-1',
    projectId: 'project-created',
    patch: { coverAssetId: 'asset-0123456789abcdef' },
  }));
  expect(createProjectContainer.mock.invocationCallOrder[0]).toBeLessThan(importAssets.mock.invocationCallOrder[0]!);
  expect(importAssets).toHaveBeenCalledWith({
    workspaceId: 'workspace-1',
    projectId: 'project-created',
    items: [{ name: 'cover.png', mimeType: 'image/png', data: new Uint8Array([1, 2, 3]), metadata: { purpose: 'project-cover' } }],
  });
});

it('keeps the created project and falls back to the default cover when cover import fails', async () => {
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-cover-failed' }));
  const updateProjectMetadata = vi.fn();
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listActiveProjects: vi.fn(async () => []),
    createProjectContainer,
    importAssets: vi.fn(async () => [{ status: 'error' as const, error: 'DECODE_FAILED', item: { name: 'cover.png' } }]),
    updateProjectMetadata,
  };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:failed-cover'), revokeObjectURL: vi.fn() });
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('heading', { name: '项目库' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  fireEvent.change(screen.getByLabelText('选择项目封面'), {
    target: { files: [new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', 'blob:failed-cover'));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: '降级封面项目' } });
  fireEvent.click(screen.getByRole('button', { name: '创建项目' }));

  expect(await screen.findByRole('heading', { name: '降级封面项目' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('项目已创建，但封面保存失败，已使用默认封面。');
  expect(updateProjectMetadata).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '项目库' }));
  expect(within(screen.getByRole('button', { name: '降级封面项目' })).getByRole('img', { name: '降级封面项目项目封面' })).toHaveAttribute('src', '/project-default-cover.png');
});

it('keeps an empty real workspace free of example projects and designers', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const loadDesignerState = vi.fn(async () => ({ profiles: [], defaultId: '', drafts: {} }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadDesignerState };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-empty', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(listActiveProjects).toHaveBeenCalledWith('workspace-empty'));
  expect(screen.getByText('暂无项目')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '春间市集' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '设计师' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: /纸感排版/ })).not.toBeInTheDocument());
});

it('reports a connected model in the studio status bar when a provider credential exists', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, hasCredential };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-connected', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  await waitFor(() => expect(hasCredential).toHaveBeenCalledWith('openai-compatible:image'));
  expect(document.querySelector('.studio-status')).toHaveTextContent('模型已连接');
  expect(document.querySelector('.studio-status')).not.toHaveTextContent('模型未连接');
});

it('shows a project load failure without falling back to example projects', async () => {
  const listActiveProjects = vi.fn(async () => { throw new Error('PROJECT_LOAD_FAILED'); });
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-failed', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  expect(await screen.findByText('项目读取失败')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '春间市集' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(listActiveProjects).toHaveBeenCalledTimes(2);
});

it('uses the selected document size when creating a project', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-square' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('heading', { name: '项目库' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: '方图项目' } });
  fireEvent.change(screen.getByRole('combobox', { name: '文档尺寸' }), { target: { value: '1080 × 1080' } });
  fireEvent.click(screen.getByRole('button', { name: '创建项目' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({ documents: [expect.objectContaining({ width: 1080, height: 1080 })] })));
});

it('waits for the persisted search index rebuild before querying it', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project' }]);
  let releaseRebuild!: () => void;
  const rebuildSearchIndex = vi.fn(() => new Promise<boolean>((resolve) => { const release = () => resolve(true); releaseRebuild = release; }));
  const searchProjects = vi.fn(async () => [{ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', title: 'Persisted project', contributorIds: [] }]);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, rebuildSearchIndex, searchProjects };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  await waitFor(() => expect(rebuildSearchIndex).toHaveBeenCalledOnce());
  expect(searchProjects).not.toHaveBeenCalled();
  releaseRebuild();
  await waitFor(() => expect(searchProjects).toHaveBeenCalledWith({ workspaceId: 'workspace-1', query: '' }));
});

it('imports a project package and refreshes the persisted project list', async () => {
  const listActiveProjects = vi.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{
      projectId: 'project-imported',
      name: 'Imported project',
      activeDesignerVersionId: 'user-paper',
      contributorDesignerVersionIds: ['user-paper', 'user-story'],
      designerSnapshot: { name: { zh: '纸感排版', en: 'Paper & Type' }, version: 'v1.4' },
      documents: [{ id: 'doc-imported', name: '导入方图', width: 720, height: 720, updatedAt: '2026-09-12T00:00:00.000Z' }],
    }]);
  const importProjectPackage = vi.fn(async () => ({ projectId: 'project-imported' }));
  const loadDesignerState = vi.fn(async () => ({ profiles: persistedProfiles, defaultId: 'user-paper', drafts: {} }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, importProjectPackage, loadDesignerState };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('heading', { name: '项目库' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '导入项目包' }));
  await waitFor(() => expect(importProjectPackage).toHaveBeenCalledWith({ workspaceId: 'workspace-1' }));
  const imported = await screen.findByRole('button', { name: 'Imported project' });
  expect(within(imported).getByLabelText('版本署名')).toHaveTextContent('自然叙事');
  fireEvent.click(imported);
  expect(screen.getByRole('button', { name: '打开导入方图' })).toBeInTheDocument();
  expect(screen.getAllByText(/720 × 720/).length).toBeGreaterThan(0);
});

it('renames, archives and duplicates a persisted project from its detail view', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const updateProjectMetadata = vi.fn(async ({ patch }: { patch: { name?: string; archived?: boolean } }) => ({ projectId: 'project-1', workspaceId: 'workspace-1', name: patch.name ?? 'Persisted project', archived: patch.archived ?? false, documents: [], createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:01.000Z' }));
  const duplicateProject = vi.fn(async () => ({ projectId: 'project-2' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, updateProjectMetadata, duplicateProject };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getByRole('button', { name: '重命名' }));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: 'Renamed project' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', patch: { name: 'Renamed project' } })));
  fireEvent.click(screen.getByRole('button', { name: '复制' }));
  await waitFor(() => expect(duplicateProject).toHaveBeenCalledWith(expect.objectContaining({ sourceProjectId: 'project-1' })));
  fireEvent.click(screen.getByRole('button', { name: '项目库' }));
  expect(await screen.findByRole('button', { name: /Renamed project copy/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Renamed project' }));
  fireEvent.click(screen.getByRole('button', { name: '归档' }));
  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith(expect.objectContaining({ patch: { archived: true } })));
});

it('submits project conversation through the desktop task bridge', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const submitConversation = vi.fn(async () => ({ id: 'task-1', requestId: 'request-1', state: 'running' as const, cancelRequested: false, attempt: 1 }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, submitConversation };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getAllByRole('button', { name: '打开画布' })[0]!);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '调整标题' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(submitConversation).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-1', projectId: 'project-1', connectionId: 'openai-compatible', message: '调整标题' })));
});

it('submits one image when the saved provider uses the Responses image transport', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const loadProviderConfigs = vi.fn(async () => ({
    'openai-compatible': {
      conversation: { baseUrl: 'https://text.example.test/v1', models: {} },
      image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'responses' as const, models: {} },
    },
  }));
  const submitImageGeneration = vi.fn(async () => ({ id: 'task-image-1', requestId: 'request-image-1', state: 'running' as const, cancelRequested: false, attempt: 1 }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadProviderConfigs, submitImageGeneration };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  await screen.findByRole('button', { name: 'Persisted project' });
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getAllByRole('button', { name: '打开画布' })[0]!);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成项目主视觉' } });
  fireEvent.click(screen.getByRole('button', { name: '生成' }));

  await waitFor(() => expect(submitImageGeneration).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    connectionId: 'openai-compatible',
    prompt: '生成项目主视觉',
    count: 1,
  })));
});

it('keeps two-image generation when no provider transport is saved', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const submitImageGeneration = vi.fn(async () => ({ id: 'task-image-1', requestId: 'request-image-1', state: 'running' as const, cancelRequested: false, attempt: 1 }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, submitImageGeneration };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  await screen.findByRole('button', { name: 'Persisted project' });
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getAllByRole('button', { name: '打开画布' })[0]!);
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成项目主视觉' } });
  fireEvent.click(screen.getByRole('button', { name: '生成' }));

  await waitFor(() => expect(submitImageGeneration).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    connectionId: 'openai-compatible',
    prompt: '生成项目主视觉',
    count: 2,
  })));
});

it('uses the persisted designer version and lets a writable project switch designers', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', activeDesignerVersionId: 'user-paper', designerSnapshot: { name: { zh: '纸感排版', en: 'Paper & Type' }, version: 'v1.4' }, documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const loadDesignerState = vi.fn(async () => ({ profiles: persistedProfiles.filter((profile) => ['user-paper', 'user-commerce'].includes(profile.id)), defaultId: 'user-paper' }));
  const updateProjectMetadata = vi.fn(async ({ patch }: { patch: { activeDesignerVersionId?: string; designerSnapshot?: unknown } }) => ({ projectId: 'project-1', workspaceId: 'workspace-1', name: 'Persisted project', activeDesignerVersionId: patch.activeDesignerVersionId, designerSnapshot: patch.designerSnapshot, archived: false, documents: [], createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:01.000Z' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadDesignerState, updateProjectMetadata };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  const selector = screen.getByRole('combobox', { name: '设计师' });
  fireEvent.change(selector, { target: { value: 'user-commerce' } });
  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith(expect.objectContaining({ patch: expect.objectContaining({ activeDesignerVersionId: 'user-commerce' }) })));
});

it('shows every project contributor in the card and detail view', async () => {
  const listActiveProjects = vi.fn(async () => [{
    projectId: 'project-team',
    name: '协作项目',
    activeDesignerVersionId: 'user-paper',
    contributorDesignerVersionIds: ['user-paper', 'user-story'],
    designerSnapshot: { name: { zh: '纸感排版', en: 'Paper & Type' }, version: 'v1.4' },
    documents: [{ id: 'doc-1', name: '主海报', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }],
  }]);
  const loadDesignerState = vi.fn(async () => ({ profiles: persistedProfiles.filter((profile) => ['user-paper', 'user-story'].includes(profile.id)), defaultId: 'user-paper' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadDesignerState };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'read-only' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  const card = await screen.findByRole('button', { name: '协作项目' });
  expect(within(card).getByLabelText('版本署名')).toHaveTextContent('纸感排版');
  expect(within(card).getByLabelText('版本署名')).toHaveTextContent('自然叙事');
  fireEvent.click(card);
  expect(screen.getByLabelText('版本署名')).toHaveTextContent('纸感排版');
  expect(screen.getByLabelText('版本署名')).toHaveTextContent('自然叙事');
});

it('opens each persisted document with its own size and scene target', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: '多尺寸项目', documents: [{ id: 'doc-main', name: '主海报', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }, { id: 'doc-square', name: '方图', width: 720, height: 720, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const loadDocumentScene = vi.fn(async () => null);
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadDocumentScene, saveDocumentScene };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '多尺寸项目' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '多尺寸项目' }));
  expect(screen.getByRole('heading', { name: '方图' })).toBeInTheDocument();
  expect(screen.getByText('720 × 720 px')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '打开方图' }));
  await waitFor(() => expect(loadDocumentScene).toHaveBeenCalledWith('workspace-1', 'project-1', 'doc-square'));
  expect(screen.getByText('方图')).toBeInTheDocument();
  expect(screen.getByText('720 × 720 px')).toBeInTheDocument();
});

it('routes asset actions from the library into the selected project canvas', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-assets', name: '素材项目', documents: [{ id: 'doc-main', name: '主海报', width: 800, height: 600, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const listAssets = vi.fn(async () => [{ id: 'asset-action', name: '原图', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true }]);
  const loadDocumentScene = vi.fn(async () => null);
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, listAssets, loadDocumentScene, saveDocumentScene };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '素材项目' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '素材库' }));
  fireEvent.click(await screen.findByRole('button', { name: /原图/ }));
  const details = await screen.findByRole('dialog', { name: '素材详情' });
  fireEvent.click(within(details).getByRole('button', { name: '放入画布' }));
  await waitFor(() => expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument());
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-assets', documentId: 'doc-main', scene: expect.objectContaining({ layers: expect.arrayContaining([expect.objectContaining({ assetId: 'asset-action' })]) }) })));
});

it('creates a related-size document from a finalized source revision', async () => {
  const listActiveProjects = vi.fn(async () => [{
    projectId: 'project-related',
    name: '关联尺寸项目',
    documents: [{
      id: 'doc-main',
      name: '主海报',
      width: 1080,
      height: 1440,
      finalizedRevisionId: 'revision-final',
      updatedAt: '2026-09-12T00:00:00.000Z',
    }],
  }]);
  const updateProjectMetadata = vi.fn(async ({ patch }: UpdateProjectMetadataInput): Promise<ProjectMetadata> => ({
    projectId: 'project-related',
    workspaceId: 'workspace-1',
    name: '关联尺寸项目',
    documents: (patch.documents ?? []).map((document) => ({
      ...document,
      updatedAt: '2026-09-13T00:00:00.000Z',
    })) ?? [],
    archived: false,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
  }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, updateProjectMetadata };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '关联尺寸项目' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '关联尺寸项目' }));
  fireEvent.click(screen.getByRole('button', { name: '新建尺寸' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文档名称' }), { target: { value: '社媒方图' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '宽度' }), { target: { value: '1080' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '高度' }), { target: { value: '1080' } });
  fireEvent.click(screen.getByRole('button', { name: '创建尺寸' }));
  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith(expect.objectContaining({
    projectId: 'project-related',
    patch: expect.objectContaining({
      documents: expect.arrayContaining([
        expect.objectContaining({ id: expect.stringMatching(/^doc-/), name: '社媒方图', width: 1080, height: 1080, sourceDocumentId: 'doc-main', sourceRevisionId: 'revision-final' }),
      ]),
    }),
  })));
  expect((await screen.findAllByText('社媒方图')).length).toBeGreaterThan(0);
});

it('copies and scales the finalized source scene into a related-size document', async () => {
  const listActiveProjects = vi.fn(async () => [{
    projectId: 'project-related-scene',
    name: '场景关联项目',
    documents: [{ id: 'doc-main', name: '主海报', width: 1000, height: 500, finalizedRevisionId: 'revision-final', updatedAt: '2026-09-12T00:00:00.000Z' }],
  }]);
  const sourceScene = createScene({ id: 'scene-final', width: 1000, height: 500, layers: [{ id: 'title', type: 'text', text: '标题', fontFamily: 'Inter', fontSize: 40, fontWeight: 'bold', align: 'left', color: '#000', x: 100, y: 50, width: 400, height: 60, rotation: 0, opacity: 1, visible: true, locked: false }] });
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-final', projectId: 'project-related-scene', documentId: 'doc-main', parentRevisionId: null, operationId: 'op-final', sceneAssetId: 'scene-final', assetIds: [], contributions: [], createdAt: '2026-09-12T00:00:00.000Z', scene: sourceScene }], timeline: [], finalRevisionId: 'revision-final' }));
  const updateProjectMetadata = vi.fn(async ({ patch }: UpdateProjectMetadataInput): Promise<ProjectMetadata> => ({ projectId: 'project-related-scene', workspaceId: 'workspace-1', name: '场景关联项目', documents: (patch.documents ?? []).map((document) => ({ ...document, updatedAt: '2026-09-13T00:00:00.000Z' })), archived: false, createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-13T00:00:00.000Z' }));
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadDocumentRevisions, updateProjectMetadata, saveDocumentScene };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '场景关联项目' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '场景关联项目' }));
  fireEvent.click(screen.getByRole('button', { name: '新建尺寸' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文档名称' }), { target: { value: '方图' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '宽度' }), { target: { value: '500' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '高度' }), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: '创建尺寸' }));
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-related-scene', documentId: expect.stringMatching(/^doc-/), scene: expect.objectContaining({ width: 500, height: 500, layers: [expect.objectContaining({ x: 50, y: 50, width: 200, height: 60 })] }) })));
});

it('exposes only manual project creation from the projects page', async () => {
  const listActiveProjects = vi.fn(async () => []);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '项目库' })).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: '对话创建' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  expect(screen.getByRole('textbox', { name: '设计目标' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '通过对话' })).not.toBeInTheDocument();
});
