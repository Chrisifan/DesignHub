import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Studio } from './studio/Studio';
import { HomeProjectPanel } from './studio/HomeProjectPanel';
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

const navigateFromUserMenu = (label: string): void => {
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  fireEvent.click(screen.getByRole('menuitem', { name: label }));
};

const openNewProjectDrawer = (): void => {
  navigateFromUserMenu('新建项目');
};

it('opens model connection settings as a dialog without leaving the current page', () => {
  enter();
  expect(screen.queryByRole('navigation', { name: '主导航' })).not.toBeInTheDocument();
  navigateFromUserMenu('模型连接');
  expect(screen.getByRole('heading', { name: '欢迎使用 Design Hub' })).toBeInTheDocument();
  const dialog = screen.getByRole('dialog', { name: '连接配置' });
  expect(dialog).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '欢迎使用 Design Hub' })).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: '图片生成与编辑' }));
  expect(within(dialog).getByLabelText('图片服务地址')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('生成模型')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('编辑模型')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '模型连接' })).not.toBeInTheDocument();
  expect(screen.queryByText('已保存到本地')).not.toBeInTheDocument();
});

it('opens designer creation from the user menu without showing a designer list page', async () => {
  enter();
  navigateFromUserMenu('设计师');

  expect(screen.getByRole('heading', { name: '欢迎使用 Design Hub' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '设计师', level: 1 })).not.toBeInTheDocument();
  expect(await screen.findByRole('dialog', { name: '导入作品集分析 · 生成 AI 设计师档案' })).toBeInTheDocument();
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

  expect(screen.getByRole('heading', { name: '欢迎使用 Design Hub' })).toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: '项目列表' })).toBeNull();
  navigateFromUserMenu('设计师');
  await waitFor(() => expect(screen.queryByRole('button', { name: /纸感排版/ })).not.toBeInTheDocument());
});

it('hides the project panel when the workspace has no projects', () => {
  render(
    <Studio
      locale="zh-CN"
      theme="system"
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      onExit={() => undefined}
    />,
  );

  expect(screen.queryByRole('complementary', { name: '项目列表' })).toBeNull();
});

it('shows project covers in the compact home project list', async () => {
  enter();
  const project = await screen.findByRole('button', { name: '春间市集' });
  expect(project.querySelector('.project-cover__image')).toHaveAttribute('src', '/project-default-cover.png');
  expect(within(project).getByText(/3 份设计稿/)).toBeInTheDocument();
});

it('uses the first design asset as the project list cover', async () => {
  const readAsset = vi.fn(async () => new Uint8Array([1, 2, 3]));
  window.designhub = { chooseWorkspaceDirectory: async () => null, readAsset };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:first-design'), revokeObjectURL: vi.fn() });
  const project = {
    ...exampleProjects[0]!,
    workspaceId: 'workspace-1',
    coverAssetId: 'asset-custom-cover',
    designs: [{
      id: 'design-first',
      assetId: 'asset-first-design',
      sourceTaskId: 'task-1',
      width: 1080,
      height: 1440,
      title: '第一张设计稿',
      createdAt: '2026-09-20T00:00:00.000Z',
    }],
  };
  render(
    <HomeProjectPanel
      locale="zh-CN"
      allProjects={[project]}
      projects={[project]}
      filter="active"
      query=""
      loadFailed={false}
      onFilterChange={() => undefined}
      onQueryChange={() => undefined}
      onOpenProject={() => undefined}
      onRetry={() => undefined}
    />,
  );

  const projectRow = screen.getByRole('button', { name: '春间市集' });
  await waitFor(() => expect(projectRow.querySelector('.project-cover__image')).toHaveAttribute('src', 'blob:first-design'));
  expect(readAsset).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'spring', assetId: 'asset-first-design' });
});

it('keeps long project names in one compact row without rendering briefs', () => {
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

  expect(screen.getByRole('button', { name: '空简介项目' }).querySelector('.studio-home-project-row__copy')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '长简介项目' })).not.toHaveTextContent(longDescription);
});

it('moves project creation from the home toolbar into the avatar menu', () => {
  enter();
  expect(screen.queryByRole('banner', { name: '工作区工具栏' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.getByRole('menuitem', { name: '新建项目' })).toBeInTheDocument();
});

it('creates a project directly from the home composer using its selected designer', async () => {
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-direct' }));
  const submitConversation = vi.fn(async () => null);
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listActiveProjects: vi.fn(async () => []),
    loadDesignerState: vi.fn(async () => ({ profiles: persistedProfiles, defaultId: '', drafts: {} })),
    hasCredential: vi.fn(async () => false),
    createProjectContainer,
    submitConversation,
  };
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

  const designerSelect = await screen.findByRole('combobox', { name: '设计师' });
  await waitFor(() => expect(designerSelect).not.toBeDisabled());
  fireEvent.click(designerSelect);
  fireEvent.click(screen.getByRole('option', { name: /纸感排版/ }));
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));

  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-1',
    activeDesignerVersionId: 'user-paper',
    designerSnapshot: expect.objectContaining({ id: 'user-paper' }),
    designs: [],
  })));
  expect(screen.queryByRole('dialog', { name: '新建项目' })).not.toBeInTheDocument();
  expect(submitConversation).not.toHaveBeenCalled();
});

it('opens one new-project drawer without the duplicate creation callout', () => {
  enter();

  expect(screen.queryByText('下一次创作，从这里开始')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '开始创作' })).not.toBeInTheDocument();

  openNewProjectDrawer();

  const drawer = screen.getByRole('dialog', { name: '新建项目' });
  expect(screen.getByRole('button', { name: '春间市集' })).toBeInTheDocument();
  expect(within(drawer).getByRole('textbox', { name: '项目名称' })).toHaveFocus();
  expect(within(drawer).getByRole('button', { name: '取消' }).closest('.ui-drawer__footer')).toBeInTheDocument();
  expect(within(drawer).getByRole('button', { name: '创建预览' }).closest('.ui-drawer__footer')).toBeInTheDocument();
  expect(within(drawer).queryByLabelText('新建设计的当前设计师')).not.toBeInTheDocument();
});

it('orders project controls in the workspace toolbar', () => {
  enter();
  const panel = screen.getByRole('complementary', { name: '项目列表' });
  expect(within(panel).getByRole('group', { name: '项目状态' })).toBeInTheDocument();
  expect(within(panel).getByRole('searchbox', { name: '搜索项目' })).toBeInTheDocument();
  expect(within(panel).queryByRole('group', { name: '展示方式' })).not.toBeInTheDocument();
});

it('animates the home project list in the direction of filter changes', () => {
  enter();
  const panel = screen.getByRole('complementary', { name: '项目列表' });

  fireEvent.click(within(panel).getByRole('button', { name: '全部项目' }));
  expect(panel.querySelector('.studio-home-projects__list')).toHaveClass('studio-project-list-enter-forward');

  fireEvent.click(within(panel).getByRole('button', { name: '进行中' }));
  expect(panel.querySelector('.studio-home-projects__list')).toHaveClass('studio-project-list-enter-backward');
});

it('orders asset controls in the workspace toolbar', () => {
  enter();
  navigateFromUserMenu('素材库');
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });

  expect(document.querySelectorAll('.destination--active')).toHaveLength(1);
  expect(document.querySelector('.destination--active')).toHaveClass('studio-view-enter-forward');
  expect(within(toolbar).getByRole('button', { name: '返回项目' })).toBeInTheDocument();
  expect(within(toolbar).getByText('素材库', { selector: '.toolbar-page-title' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('group', { name: '类型' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('searchbox', { name: '搜索素材' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('group', { name: '视图' })).toBeInTheDocument();
  expect(document.querySelector('.asset-toolbar')).not.toBeInTheDocument();
});

it('reverses the page transition when returning to the project home', () => {
  enter();
  navigateFromUserMenu('素材库');
  navigateFromUserMenu('首页');

  expect(document.querySelector('.studio-home')).toHaveClass('studio-view-enter-backward');
});

it('keeps the project home ready for the shared page entrance transition', () => {
  enter();
  expect(document.querySelector('.studio-home')).toHaveClass('studio-view-enter');
});

it('returns from a settings destination to the project home', () => {
  enter();
  navigateFromUserMenu('设置');
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });

  expect(within(toolbar).getByText('设置', { selector: '.toolbar-page-title' })).toBeInTheDocument();
  fireEvent.click(within(toolbar).getByRole('button', { name: '返回项目' }));
  expect(screen.getByRole('heading', { name: '欢迎使用 Design Hub' })).toBeInTheDocument();
});

it('shows the cover-led project detail as a full-width design list', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: '春间市集' }));

  const header = screen.getByTestId('project-detail-header');
  expect(screen.getByTestId('project-detail-page')).toBeInTheDocument();
  expect(header).toContainElement(screen.getByTestId('project-detail-hero'));
  expect(header).toContainElement(screen.getByRole('heading', { name: '春间市集' }));
  expect(within(header).queryByRole('button', { name: '打开画布' })).not.toBeInTheDocument();
  expect(within(header).queryByRole('button', { name: '导出交付' })).not.toBeInTheDocument();
  expect(screen.getByText('设计文档')).toBeInTheDocument();
  expect(screen.queryByText('项目上下文')).not.toBeInTheDocument();
  expect(screen.queryByText('设计协作')).not.toBeInTheDocument();
  expect(screen.queryByText('设计简报')).not.toBeInTheDocument();
});

it('preserves project search while visiting another destination and offers an empty-result reset', () => {
  enter();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), {
    target: { value: '不存在的项目' },
  });
  expect(screen.getByText('没有匹配的项目。')).toBeInTheDocument();
  navigateFromUserMenu('素材库');
  navigateFromUserMenu('首页');
  expect(screen.getByRole('searchbox', { name: '搜索项目' })).toHaveValue(
    '不存在的项目',
  );
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), { target: { value: '' } });
  expect(screen.getByRole('button', { name: /春间市集/ })).toBeInTheDocument();
});

it('searches the local index across project briefs and contributor tags', () => {
  enter();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), { target: { value: '纸感排版' } });
  expect(screen.getByRole('button', { name: '春间市集' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), { target: { value: '不存在' } });
  expect(screen.getByText('没有匹配的项目。')).toBeInTheDocument();
});

it('opens a project document and returns to that project', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: /春间市集/ }));
  fireEvent.click(screen.getByRole('button', { name: '打开主海报' }));
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
  expect(document.querySelector('.studio-sidebar')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回项目' }));
  expect(screen.getByRole('heading', { name: '春间市集' })).toBeInTheDocument();
});

it('creates only a labelled preview draft and keeps project input when dismissing the form', async () => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview-cover'), revokeObjectURL: vi.fn() });
  enter();
  openNewProjectDrawer();
  fireEvent.change(screen.getByLabelText('选择项目封面'), {
    target: { files: [new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', 'blob:preview-cover'));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
    target: { value: '我的测试项目' },
  });
  fireEvent.click(within(screen.getByRole('dialog', { name: '新建项目' })).getByRole('button', { name: '取消' }));
  openNewProjectDrawer();
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
  navigateFromUserMenu('首页');
  expect(screen.getByRole('button', { name: '我的测试项目' }).querySelector('.project-cover__image')).toHaveAttribute('src', '/project-default-cover.png');
  openNewProjectDrawer();
  expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', '/project-default-cover.png');
});

it('keeps the draft while the shell controls are used', () => {
  enter();
  openNewProjectDrawer();
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
    target: { value: '保留输入' },
  });
  fireEvent.click(within(screen.getByRole('dialog', { name: '新建项目' })).getByRole('button', { name: '取消' }));
  fireEvent.click(screen.getByRole('button', { name: '切换主题' }));
  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
  openNewProjectDrawer();
  expect(screen.getByRole('textbox', { name: '项目名称' })).toHaveValue(
    '保留输入',
  );
});

it('preserves the originating project when opening delivery from project details', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: '日常之物' }));
  fireEvent.click(screen.getAllByRole('button', { name: '导出交付' }).at(-1)!);
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
  openNewProjectDrawer();
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
  await screen.findByRole('textbox', { name: '设计需求' });
  openNewProjectDrawer();
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
  await screen.findByRole('textbox', { name: '设计需求' });
  openNewProjectDrawer();
  fireEvent.change(screen.getByLabelText('选择项目封面'), {
    target: { files: [new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', 'blob:failed-cover'));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: '降级封面项目' } });
  fireEvent.click(screen.getByRole('button', { name: '创建项目' }));

  expect(await screen.findByRole('heading', { name: '降级封面项目' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('项目已创建，但封面保存失败，已使用默认封面。');
  expect(updateProjectMetadata).not.toHaveBeenCalled();
  navigateFromUserMenu('首页');
  expect(screen.getByRole('button', { name: '降级封面项目' }).querySelector('.project-cover__image')).toHaveAttribute('src', '/project-default-cover.png');
});

it('keeps an empty real workspace free of example projects and designers', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const loadDesignerState = vi.fn(async () => ({ profiles: [], defaultId: '', drafts: {} }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadDesignerState };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-empty', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(listActiveProjects).toHaveBeenCalledWith('workspace-empty'));
  expect(screen.getByRole('heading', { name: '欢迎使用 Design Hub' })).toBeInTheDocument();
  expect(screen.queryByRole('complementary', { name: '项目列表' })).toBeNull();
  expect(screen.queryByRole('button', { name: '春间市集' })).not.toBeInTheDocument();
  navigateFromUserMenu('设计师');
  await waitFor(() => expect(screen.queryByRole('button', { name: /纸感排版/ })).not.toBeInTheDocument());
});

it('reports a connected conversation model in the home composer', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, hasCredential };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-connected', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  await waitFor(() => expect(hasCredential).toHaveBeenCalledWith('openai-compatible:conversation'));
  expect(screen.getByText('对话模型已连接')).toBeInTheDocument();
  expect(document.querySelector('.studio-status')).not.toBeInTheDocument();
});

it('shows a project load failure without falling back to example projects', async () => {
  const listActiveProjects = vi.fn(async () => { throw new Error('PROJECT_LOAD_FAILED'); });
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-failed', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  expect(await screen.findByText('项目加载失败。')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '春间市集' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(listActiveProjects).toHaveBeenCalledTimes(2);
});

it('uses the selected document size when creating a project', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-square' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await screen.findByRole('textbox', { name: '设计需求' });
  openNewProjectDrawer();
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
  await screen.findByRole('textbox', { name: '设计需求' });
  navigateFromUserMenu('导入项目包');
  await waitFor(() => expect(importProjectPackage).toHaveBeenCalledWith({ workspaceId: 'workspace-1' }));
  const imported = await screen.findByRole('button', { name: 'Imported project' });
  fireEvent.click(imported);
  expect(screen.getByLabelText('版本署名')).toHaveTextContent('自然叙事');
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
  navigateFromUserMenu('首页');
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
  fireEvent.click(screen.getByRole('button', { name: '打开Main' }));
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '调整标题' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(submitConversation).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-1', projectId: 'project-1', connectionId: 'openai-compatible', message: '调整标题' })));
});

it('stores the finalized revision id before returning to project details', async () => {
  const now = '2026-09-20T00:00:00.000Z';
  const document = { id: 'doc-1', name: '主海报', width: 1080, height: 1440, updatedAt: now };
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-finalize', name: '定稿项目', documents: [document] }]);
  const conversationTask = {
    id: 'conversation-finalize', requestId: 'request-conversation-finalize', state: 'completed' as const, cancelRequested: false, attempt: 1,
    capability: 'conversation', analysisThreadId: 'thread-finalize', documentId: 'doc-1', source: { kind: 'project' as const, id: 'project-finalize' },
    result: { text: 'Use the selected candidate.' },
  };
  const designTask = {
    id: 'design-finalize', requestId: 'request-design-finalize', state: 'completed' as const, cancelRequested: false, attempt: 1,
    capability: 'design-generation', analysisThreadId: 'thread-finalize', documentId: 'doc-1', source: { kind: 'project' as const, id: 'project-finalize' },
    result: { candidate: { id: 'candidate-finalize', baseRevisionId: null, assetIds: ['asset-final'], sceneAssetId: 'asset-final', createdAt: now } },
  };
  const updateProjectMetadata = vi.fn(async ({ patch }: UpdateProjectMetadataInput): Promise<ProjectMetadata> => ({
    projectId: 'project-finalize',
    workspaceId: 'workspace-1',
    name: '定稿项目',
    documents: (patch.documents ?? []).map((entry) => ({ ...entry, updatedAt: now })),
    archived: false,
    createdAt: now,
    updatedAt: now,
  }));
  let persistedScene = createScene({ id: 'doc-1', width: 1080, height: 1440, layers: [] });
  const loadDocumentScene = vi.fn(async () => persistedScene);
  const saveDocumentScene = vi.fn(async ({ scene }: { scene: typeof persistedScene }) => {
    persistedScene = scene;
    return true;
  });
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listActiveProjects,
    updateProjectMetadata,
    submitConversation: vi.fn(async () => conversationTask),
    submitDesignGeneration: vi.fn(async () => designTask),
    loadDocumentRevisions: vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null })),
    commitDocumentRevision: vi.fn(async () => ({ revisionId: 'revision-final' })),
    setFinalDocumentRevision: vi.fn(async () => true),
    loadDocumentScene,
    saveDocumentScene,
    readAsset: vi.fn(async () => new Uint8Array([1])),
  };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  fireEvent.click(await screen.findByRole('button', { name: '定稿项目' }));
  fireEvent.click(screen.getByRole('button', { name: '打开主海报' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成候选' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '生成' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '生成' }));
  fireEvent.click(await screen.findByRole('button', { name: /候选设计稿/ }));
  fireEvent.click(within(screen.getByRole('toolbar', { name: '上下文工具' })).getByRole('button', { name: '定稿所选候选' }));

  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith({
    workspaceId: 'workspace-1',
    projectId: 'project-finalize',
    patch: { documents: [expect.objectContaining({ id: 'doc-1', finalizedRevisionId: 'revision-final' })] },
  }));
  expect(await screen.findByText('已定稿')).toBeInTheDocument();
  expect(await screen.findByRole('img', { name: '主海报定稿预览' })).toBeInTheDocument();
  confirm.mockRestore();
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
  fireEvent.click(screen.getByRole('button', { name: '打开Main' }));
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
  fireEvent.click(screen.getByRole('button', { name: '打开Main' }));
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

it('uses the persisted designer version without embedding project editor controls', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', activeDesignerVersionId: 'user-paper', designerSnapshot: { name: { zh: '纸感排版', en: 'Paper & Type' }, version: 'v1.4' }, documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const loadDesignerState = vi.fn(async () => ({ profiles: persistedProfiles.filter((profile) => ['user-paper', 'user-commerce'].includes(profile.id)), defaultId: 'user-paper' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadDesignerState };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  expect(screen.getByLabelText('版本署名')).toHaveTextContent('纸感排版 · v1.4');
  expect(screen.queryByRole('combobox', { name: '设计师' })).not.toBeInTheDocument();
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
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.getByRole('menuitem', { name: '新建项目' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(card);
  expect(screen.getByLabelText('版本署名')).toHaveTextContent('纸感排版');
  expect(screen.getByLabelText('版本署名')).toHaveTextContent('自然叙事');
  expect(within(screen.getByRole('banner', { name: '工作区工具栏' })).queryByRole('button', { name: '新建设计稿' })).not.toBeInTheDocument();
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
  navigateFromUserMenu('素材库');
  fireEvent.click(await screen.findByRole('button', { name: /原图/ }));
  const details = await screen.findByRole('dialog', { name: '素材详情' });
  fireEvent.click(within(details).getByRole('button', { name: '放入画布' }));
  await waitFor(() => expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument());
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-assets', documentId: 'doc-main', scene: expect.objectContaining({ layers: expect.arrayContaining([expect.objectContaining({ assetId: 'asset-action' })]) }) })));
});

it('creates an independent blank design document without a finalized source', async () => {
  const listActiveProjects = vi.fn(async () => [{
    projectId: 'project-blank-document',
    name: '空白设计稿项目',
    documents: [{ id: 'doc-main', name: '主海报', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }],
  }]);
  const updateProjectMetadata = vi.fn(async ({ patch }: UpdateProjectMetadataInput): Promise<ProjectMetadata> => ({
    projectId: 'project-blank-document',
    workspaceId: 'workspace-1',
    name: '空白设计稿项目',
    documents: (patch.documents ?? []).map((document) => ({ ...document, updatedAt: '2026-09-13T00:00:00.000Z' })),
    archived: false,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
  }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, updateProjectMetadata };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  fireEvent.click(await screen.findByRole('button', { name: '空白设计稿项目' }));
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });
  fireEvent.click(within(toolbar).getByRole('button', { name: '新建设计稿' }));
  expect(screen.getByRole('button', { name: '空白设计稿' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '尺寸变体' })).toBeDisabled();
  expect(screen.getByText('项目中还没有已定稿的设计稿，暂时不能创建尺寸变体。')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '文档名称' }), { target: { value: '发布会邀请函' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '宽度' }), { target: { value: '1600' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '高度' }), { target: { value: '900' } });
  fireEvent.click(screen.getByRole('button', { name: '创建设计稿' }));

  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledOnce());
  const documents = updateProjectMetadata.mock.calls[0]?.[0].patch.documents ?? [];
  const created = documents.find((document) => document.name === '发布会邀请函');
  expect(created).toMatchObject({ id: expect.stringMatching(/^doc-/), width: 1600, height: 900, finalizedRevisionId: null });
  expect(created).not.toHaveProperty('sourceDocumentId');
  expect(created).not.toHaveProperty('sourceRevisionId');
  expect((await screen.findAllByText('发布会邀请函')).length).toBeGreaterThan(0);
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
  fireEvent.click(screen.getByRole('button', { name: '新建设计稿' }));
  fireEvent.click(screen.getByRole('button', { name: '尺寸变体' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文档名称' }), { target: { value: '社媒方图' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '宽度' }), { target: { value: '1080' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '高度' }), { target: { value: '1080' } });
  fireEvent.click(screen.getByRole('button', { name: '创建设计稿' }));
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
  fireEvent.click(screen.getByRole('button', { name: '新建设计稿' }));
  fireEvent.click(screen.getByRole('button', { name: '尺寸变体' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文档名称' }), { target: { value: '方图' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '宽度' }), { target: { value: '500' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: '高度' }), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: '创建设计稿' }));
  await waitFor(() => expect(saveDocumentScene).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-related-scene', documentId: expect.stringMatching(/^doc-/), scene: expect.objectContaining({ width: 500, height: 500, layers: [expect.objectContaining({ x: 50, y: 50, width: 200, height: 60 })] }) })));
});

it('keeps a created size variant and reports when its scene conversion cannot be saved', async () => {
  const listActiveProjects = vi.fn(async () => [{
    projectId: 'project-variant-save-failure',
    name: '变体保存失败项目',
    documents: [{ id: 'doc-main', name: '主海报', width: 1000, height: 500, finalizedRevisionId: 'revision-final', updatedAt: '2026-09-12T00:00:00.000Z' }],
  }]);
  const sourceScene = createScene({ id: 'scene-final', width: 1000, height: 500, layers: [] });
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-final', projectId: 'project-variant-save-failure', documentId: 'doc-main', parentRevisionId: null, operationId: 'op-final', sceneAssetId: 'scene-final', assetIds: [], contributions: [], createdAt: '2026-09-12T00:00:00.000Z', scene: sourceScene }], timeline: [], finalRevisionId: 'revision-final' }));
  const updateProjectMetadata = vi.fn(async ({ patch }: UpdateProjectMetadataInput): Promise<ProjectMetadata> => ({ projectId: 'project-variant-save-failure', workspaceId: 'workspace-1', name: '变体保存失败项目', documents: (patch.documents ?? []).map((document) => ({ ...document, updatedAt: '2026-09-13T00:00:00.000Z' })), archived: false, createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-13T00:00:00.000Z' }));
  const saveDocumentScene = vi.fn(async () => { throw new Error('disk full'); });
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadDocumentRevisions, updateProjectMetadata, saveDocumentScene };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  fireEvent.click(await screen.findByRole('button', { name: '变体保存失败项目' }));
  fireEvent.click(screen.getByRole('button', { name: '新建设计稿' }));
  fireEvent.click(screen.getByRole('button', { name: '尺寸变体' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文档名称' }), { target: { value: '空白回退稿' } });
  fireEvent.click(screen.getByRole('button', { name: '创建设计稿' }));

  expect(await screen.findByText('布局转换失败，已创建空白尺寸稿')).toBeInTheDocument();
  expect((await screen.findAllByText('空白回退稿')).length).toBeGreaterThan(0);
});

it('keeps conversation creation on home and manual creation in the avatar menu', async () => {
  const listActiveProjects = vi.fn(async () => []);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  expect(await screen.findByRole('textbox', { name: '设计需求' })).toBeInTheDocument();
  expect(document.querySelector('.studio-sidebar')).not.toBeInTheDocument();
  expect(document.querySelector('.studio-status')).not.toBeInTheDocument();
  openNewProjectDrawer();
  expect(screen.getByRole('textbox', { name: '设计目标' })).toBeInTheDocument();
  expect(screen.queryByLabelText('品牌包')).not.toBeInTheDocument();
});

it('creates a localized project and opens its workbench from the first home prompt', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const createProjectContainer = vi.fn(async (input: unknown) => { void input; return { projectId: 'project-home' }; });
  const submitConversation = vi.fn(async () => ({
    id: 'conversation-home',
    requestId: 'request-home',
    state: 'queued' as const,
    cancelRequested: false,
    attempt: 1,
    capability: 'conversation' as const,
    documentId: 'doc-home',
    source: { kind: 'project' as const, id: 'project-home' },
  }));
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer, submitConversation, hasCredential };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  fireEvent.change(await screen.findByRole('textbox', { name: '设计需求' }), { target: { value: '设计一张发布海报' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));

  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-1',
    name: '未命名项目',
    documents: [expect.objectContaining({ name: '主海报', width: 1080, height: 1440 })],
  })));
  const automaticInput = createProjectContainer.mock.calls[0]![0];
  expect(automaticInput).not.toHaveProperty('activeDesignerVersionId');
  expect(automaticInput).not.toHaveProperty('designerSnapshot');
  await waitFor(() => expect(submitConversation).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-home', message: '设计一张发布海报' })));
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
});

it('uses the first free localized suffix for automatic projects', async () => {
  const listActiveProjects = vi.fn(async () => [
    { projectId: 'existing-0', name: 'Untitled project' },
    { projectId: 'existing-2', name: 'Untitled project (2)' },
  ]);
  const createProjectContainer = vi.fn(async (input: unknown) => { void input; return { projectId: 'project-home-en' }; });
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer, hasCredential };
  render(<Studio locale="en" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  fireEvent.change(await screen.findByRole('textbox', { name: 'Design request' }), { target: { value: 'Make a poster' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send and create project' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Untitled project (1)' })));
});

it('prevents workspace switching until automatic project handoff begins', async () => {
  let resolveCreation: ((value: { projectId: string }) => void) | undefined;
  const createProjectContainer = vi.fn(() => new Promise<{ projectId: string }>((resolve) => {
    resolveCreation = resolve;
  }));
  const submitConversation = vi.fn(async () => ({
    id: 'conversation-delayed',
    requestId: 'request-delayed',
    state: 'queued' as const,
    cancelRequested: false,
    attempt: 1,
  }));
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listActiveProjects: vi.fn(async () => []),
    createProjectContainer,
    submitConversation,
    hasCredential: vi.fn(async (account: string) => account === 'openai-compatible:conversation'),
  };
  const workspaceA = { workspaceId: 'workspace-a', name: 'A', directory: '/tmp/a', formatVersion: 1, openMode: 'writable' as const };
  const props = { locale: 'zh-CN' as const, theme: 'system' as const, onLocaleChange: vi.fn(), onThemeChange: vi.fn(), onExit: vi.fn() };
  render(<Studio {...props} workspace={workspaceA} />);
  await screen.findByText('对话模型已连接');
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '工作区切换测试' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledOnce());
  const workspaceSwitch = screen.getByRole('button', { name: '切换工作区' });
  expect(workspaceSwitch).toBeDisabled();
  fireEvent.click(workspaceSwitch);
  expect(screen.queryByRole('dialog', { name: '切换工作区' })).not.toBeInTheDocument();

  resolveCreation?.({ projectId: 'project-from-a' });
  await waitFor(() => expect(submitConversation).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-a',
    projectId: 'project-from-a',
    message: '工作区切换测试',
  })));

  expect(screen.getByRole('button', { name: '切换工作区' })).toBeEnabled();
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
});

it('does not create a project when the conversation model is disconnected', async () => {
  const createProjectContainer = vi.fn();
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listActiveProjects: vi.fn(async () => []),
    createProjectContainer,
    hasCredential: vi.fn(async () => false),
  };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  fireEvent.change(await screen.findByRole('textbox', { name: '设计需求' }), { target: { value: '不会创建' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  expect(await screen.findByText('请先连接对话模型。')).toBeInTheDocument();
  expect(createProjectContainer).not.toHaveBeenCalled();
});

it('persists a selected designer snapshot on the next automatic project', async () => {
  const createProjectContainer = vi.fn(async (input: unknown) => { void input; return { projectId: 'project-styled' }; });
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listActiveProjects: vi.fn(async () => []),
    loadDesignerState: vi.fn(async () => ({ profiles: persistedProfiles, defaultId: '', drafts: {} })),
    createProjectContainer,
    hasCredential: vi.fn(async (account: string) => account === 'openai-compatible:conversation'),
  };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  fireEvent.click(await screen.findByRole('combobox', { name: '设计师' }));
  fireEvent.click(screen.getByRole('option', { name: /纸感排版/ }));
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '带风格项目' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));

  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({
    activeDesignerVersionId: 'user-paper',
    designerSnapshot: expect.objectContaining({
      id: 'user-paper',
      styleDna: expect.any(Object),
      negativeRules: expect.any(Array),
    }),
  })));
  expect(createProjectContainer.mock.calls[0]![0]).not.toHaveProperty('brandSnapshot');
});

it('retains the home draft when automatic project creation fails', async () => {
  const createProjectContainer = vi.fn(async (input: unknown) => { void input; return null; });
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listActiveProjects: vi.fn(async () => []),
    createProjectContainer,
    hasCredential: vi.fn(async (account: string) => account === 'openai-compatible:conversation'),
  };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  const input = await screen.findByRole('textbox', { name: '设计需求' });
  fireEvent.change(input, { target: { value: '创建失败也保留' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledOnce());
  expect(input).toHaveValue('创建失败也保留');
});
