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

it('opens designer creation from the user menu without leaving home', async () => {
  enter();
  navigateFromUserMenu('设计师');

  expect(await screen.findByRole('dialog', { name: '导入作品集分析 · 生成 AI 设计师档案' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '欢迎使用 Design Hub', level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '设计师', level: 1 })).not.toBeInTheDocument();
});

it('explains why designer creation cannot open in a read-only workspace', async () => {
  window.designhub = {
    listActiveProjects: vi.fn(async () => []),
    loadDesignerState: vi.fn(async () => ({ profiles: persistedProfiles, defaultId: '', drafts: {} })),
  };
  render(
    <Studio
      locale="zh-CN"
      theme="system"
      library={{ libraryId: 'workspace-read-only', name: 'Read only', directory: '/tmp/read-only', formatVersion: 1, openMode: 'read-only' }}
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      onExit={() => undefined}
    />,
  );

  navigateFromUserMenu('设计师');

  expect(await screen.findByRole('status')).toHaveTextContent('当前工作区为只读模式，无法创建设计师档案。');
  expect(screen.queryByRole('dialog', { name: '导入作品集分析 · 生成 AI 设计师档案' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '欢迎使用 Design Hub', level: 1 })).toBeInTheDocument();
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
  window.designhub = { readAsset };
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:first-design'), revokeObjectURL: vi.fn() });
  const project = {
    ...exampleProjects[0]!,
    libraryId: 'workspace-1',
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
  expect(readAsset).toHaveBeenCalledWith({ libraryId: 'workspace-1', projectId: 'spring', assetId: 'asset-first-design' });
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

it('keeps project creation on home and omits redundant avatar-menu entries', () => {
  enter();
  expect(screen.queryByRole('banner', { name: '工作区工具栏' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '新建项目' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.queryByRole('menuitem', { name: '首页' })).not.toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: '新建项目' })).not.toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '导入项目包' })).toBeInTheDocument();
});

it('creates a project directly from the home composer using its selected designer', async () => {
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-direct' }));
  const submitConversation = vi.fn(async () => null);
  window.designhub = {
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
      library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }}
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
    libraryId: 'workspace-1',
    activeDesignerVersionId: 'user-paper',
    designerSnapshot: expect.objectContaining({ id: 'user-paper' }),
    designs: [],
  })));
  expect(screen.queryByRole('dialog', { name: '新建项目' })).not.toBeInTheDocument();
  expect(submitConversation).not.toHaveBeenCalled();
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
  fireEvent.click(screen.getByRole('button', { name: '返回项目' }));

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
  expect(screen.getByText('项目图片')).toBeInTheDocument();
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
  fireEvent.click(screen.getByRole('button', { name: '返回项目' }));
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

it('preserves the originating project when opening delivery from project details', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: '日常之物' }));
  expect(screen.getByTestId('project-detail-page')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '导出交付' })).not.toBeInTheDocument();
});

it('hydrates persisted workspace projects and creates through the desktop API', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project' }]);
  const createProjectContainer = vi.fn(async () => ({ projectId: 'project-2' }));
  window.designhub = { listActiveProjects, createProjectContainer };
  render(
    <Studio
      locale="zh-CN"
      theme="system"
      library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }}
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      onExit={() => undefined}
    />,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  expect(listActiveProjects).toHaveBeenCalledWith('workspace-1');
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({ libraryId: 'workspace-1', name: '未命名项目' })));
  expect(screen.getByTestId('project-canvas')).toBeInTheDocument();
});

it('keeps an empty real workspace free of example projects and designers', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const loadDesignerState = vi.fn(async () => ({ profiles: [], defaultId: '', drafts: {} }));
  window.designhub = { listActiveProjects, loadDesignerState };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-empty', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
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
  window.designhub = { listActiveProjects, hasCredential };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-connected', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  await waitFor(() => expect(hasCredential).toHaveBeenCalledWith('openai-compatible:conversation'));
  expect(screen.getByText('对话模型已连接')).toBeInTheDocument();
  expect(document.querySelector('.studio-status')).not.toBeInTheDocument();
});

it('shows a project load failure without falling back to example projects', async () => {
  const listActiveProjects = vi.fn(async () => { throw new Error('PROJECT_LOAD_FAILED'); });
  window.designhub = { listActiveProjects };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-failed', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  expect(await screen.findByText('项目加载失败。')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '春间市集' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(listActiveProjects).toHaveBeenCalledTimes(2);
});

it('waits for the persisted search index rebuild before querying it', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project' }]);
  let releaseRebuild!: () => void;
  const rebuildSearchIndex = vi.fn(() => new Promise<boolean>((resolve) => { const release = () => resolve(true); releaseRebuild = release; }));
  const searchProjects = vi.fn(async () => [{ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', title: 'Persisted project', contributorIds: [] }]);
  window.designhub = { listActiveProjects, rebuildSearchIndex, searchProjects };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  await waitFor(() => expect(rebuildSearchIndex).toHaveBeenCalledOnce());
  expect(searchProjects).not.toHaveBeenCalled();
  releaseRebuild();
  await waitFor(() => expect(searchProjects).toHaveBeenCalledWith({ libraryId: 'workspace-1', query: '' }));
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
  window.designhub = { listActiveProjects, importProjectPackage, loadDesignerState };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await screen.findByRole('textbox', { name: '设计需求' });
  navigateFromUserMenu('导入项目包');
  await waitFor(() => expect(importProjectPackage).toHaveBeenCalledWith({ libraryId: 'workspace-1' }));
  const imported = await screen.findByRole('button', { name: 'Imported project' });
  fireEvent.click(imported);
  expect(screen.getByTestId('project-canvas')).toBeInTheDocument();
});

it('renames, archives and duplicates a persisted project from its detail view', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const updateProjectMetadata = vi.fn(async ({ patch }: { patch: { name?: string; archived?: boolean } }) => ({ projectId: 'project-1', libraryId: 'workspace-1', name: patch.name ?? 'Persisted project', archived: patch.archived ?? false, documents: [], createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:01.000Z' }));
  const duplicateProject = vi.fn(async () => ({ projectId: 'project-2' }));
  window.designhub = { listActiveProjects, updateProjectMetadata, duplicateProject };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getByRole('button', { name: '项目操作' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '重命名项目' }));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: 'Renamed project' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', patch: { name: 'Renamed project' } })));
  fireEvent.click(screen.getByRole('button', { name: '项目操作' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '复制项目' }));
  await waitFor(() => expect(duplicateProject).toHaveBeenCalledWith(expect.objectContaining({ sourceProjectId: 'project-1' })));
  fireEvent.click(screen.getByRole('button', { name: '项目操作' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '返回首页' }));
  expect(await screen.findByRole('button', { name: /Renamed project copy/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Renamed project' }));
  fireEvent.click(screen.getByRole('button', { name: '项目操作' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '归档项目' }));
  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith(expect.objectContaining({ patch: { archived: true } })));
});

it('submits project conversation through the desktop task bridge', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const submitConversation = vi.fn(async () => ({ id: 'task-1', requestId: 'request-1', state: 'running' as const, cancelRequested: false, attempt: 1 }));
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = { listActiveProjects, submitConversation, hasCredential };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getByRole('button', { name: '打开Main' }));
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '调整标题' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(submitConversation).toHaveBeenCalledWith(expect.objectContaining({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', connectionId: 'openai-compatible', message: '调整标题' })));
});

it('binds design generation to the open document so polling can return the task', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const conversation = {
    id: 'conversation-1', requestId: 'request-1', state: 'completed' as const, cancelRequested: false, attempt: 1,
    capability: 'conversation', source: { kind: 'project' as const, id: 'project-1' }, documentId: 'doc-1', analysisThreadId: 'thread-1',
    visualContextPlan: { version: 1 as const, items: [], clarificationRequired: false }, result: { text: 'Brief' },
  };
  const submitConversation = vi.fn(async () => conversation);
  const submitDesignGeneration = vi.fn(async () => ({
    id: 'design-1', requestId: 'request-2', state: 'running' as const, cancelRequested: false, attempt: 1,
    capability: 'design-generation', source: { kind: 'project' as const, id: 'project-1' }, documentId: 'doc-1', analysisThreadId: 'thread-1',
    generationSlots: [{ id: 'primary' as const, direction: 'primary', state: 'queued' as const, attempt: 1 }],
  }));
  const hasCredential = vi.fn(async () => true);
  window.designhub = { listActiveProjects, submitConversation, submitDesignGeneration, hasCredential };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getByRole('button', { name: '打开Main' }));
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成海报' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '生成单张' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '生成单张' }));

  await waitFor(() => expect(submitDesignGeneration).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    documentId: 'doc-1',
    conversationTaskId: 'conversation-1',
  })));
});

it('generates project candidates without requiring an open document', async () => {
  const conversation = {
    id: 'conversation-project', requestId: 'request-project', state: 'completed' as const,
    cancelRequested: false, attempt: 1, capability: 'conversation' as const,
    source: { kind: 'project' as const, id: 'project-1' }, analysisThreadId: 'thread-project',
    visualContextPlan: { version: 1 as const, items: [], clarificationRequired: false },
    result: { text: '项目级设计简报' },
  };
  const submitDesignGeneration = vi.fn(async (input: unknown) => { void input; return {
    id: 'design-project', requestId: 'request-design', state: 'running' as const,
    cancelRequested: false, attempt: 1, capability: 'design-generation' as const,
    source: { kind: 'project' as const, id: 'project-1' }, analysisThreadId: 'thread-project',
  }; });
  window.designhub = {
    listActiveProjects: async () => [{ projectId: 'project-1', name: '无文档项目', documents: [] }],
    listProjectDesigns: async () => [],
    loadProjectCanvasLayout: async () => null,
    listTasks: async () => [conversation],
    submitDesignGeneration,
    hasCredential: async () => true,
  } as never;

  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '无文档项目' }));
  fireEvent.click(await screen.findByRole('button', { name: '生成单张' }));

  await waitFor(() => expect(submitDesignGeneration).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    conversationTaskId: 'conversation-project',
  })));
  expect(submitDesignGeneration.mock.calls[0]![0]).not.toHaveProperty('documentId');
  expect(screen.queryByText('请先打开文档。')).not.toBeInTheDocument();
});

it('runs background removal from a project image without a document field', async () => {
  const design = {
    id: 'design-image-only',
    projectId: 'project-image-only',
    assetId: 'asset-image-only',
    sourceTaskId: 'generation-image-only',
    width: 800,
    height: 600,
    title: '商品图',
    createdAt: '2026-10-10T00:00:00.000Z',
  };
  const submitImageEdit = vi.fn(async (input: Record<string, unknown>) => {
    void input;
    return {
    id: 'task-remove-background',
    requestId: 'request-remove-background',
    state: 'queued' as const,
    cancelRequested: false,
    attempt: 1,
    };
  });
  window.designhub = {
    listActiveProjects: async () => [{ projectId: 'project-image-only', name: '无文档图片项目', documents: [], designs: [design] }],
    listProjectDesigns: async () => [design],
    loadProjectCanvasLayout: async () => null,
    listTasks: async () => [],
    readAsset: async () => new Uint8Array([137, 80, 78, 71]),
    hasCredential: async (account: string) => account === 'openai-compatible:image',
    loadProviderConfigs: async () => ({
      'openai-compatible': {
        conversation: { baseUrl: 'https://text.example.test/v1', models: {} },
        image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'images' as const, models: { 'image-editing': 'image-edit-model' } },
      },
    }),
    submitImageEdit,
  };

  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '无文档图片项目' }));
  fireEvent.click(await screen.findByRole('button', { name: '设计稿 商品图' }));
  fireEvent.click(screen.getByRole('button', { name: '去除背景' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '去除背景' })).getByRole('button', { name: '执行' }));

  await waitFor(() => expect(submitImageEdit).toHaveBeenCalledWith(expect.objectContaining({
    projectId: 'project-image-only',
    sourceAssetId: 'asset-image-only',
    tool: 'remove-background',
    projectDesign: expect.objectContaining({
      sourceTaskId: 'generation-image-only',
      width: 800,
      height: 600,
      title: '商品图（去除背景）',
    }),
  })));
  expect(submitImageEdit.mock.calls[0]![0]).not.toHaveProperty('documentId');
});

it('opens a persisted project document in the workbench', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-finalize', name: '定稿项目', documents: [{ id: 'doc-1', name: '主海报', width: 1080, height: 1440, updatedAt: '2026-09-20T00:00:00.000Z' }] }]);
  const loadDocumentScene = vi.fn(async () => null);
  window.designhub = { listActiveProjects, loadDocumentScene };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  fireEvent.click(await screen.findByRole('button', { name: '定稿项目' }));
  fireEvent.click(screen.getByRole('button', { name: '打开主海报' }));
  expect(await screen.findByRole('region', { name: '设计画布' })).toBeInTheDocument();
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
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:image');
  window.designhub = { listActiveProjects, loadProviderConfigs, submitImageGeneration, hasCredential };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  await screen.findByRole('button', { name: 'Persisted project' });
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getByRole('button', { name: '打开Main' }));
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成项目主视觉' } });
  fireEvent.click(screen.getByRole('button', { name: '生成' }));

  await waitFor(() => expect(submitImageGeneration).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    connectionId: 'openai-compatible',
    prompt: '生成项目主视觉',
    count: 1,
  })));
});

it('keeps two-image generation when no provider transport is saved', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const submitImageGeneration = vi.fn(async () => ({ id: 'task-image-1', requestId: 'request-image-1', state: 'running' as const, cancelRequested: false, attempt: 1 }));
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:image');
  window.designhub = { listActiveProjects, submitImageGeneration, hasCredential };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  await screen.findByRole('button', { name: 'Persisted project' });
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getByRole('button', { name: '打开Main' }));
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '生成项目主视觉' } });
  fireEvent.click(screen.getByRole('button', { name: '生成' }));

  await waitFor(() => expect(submitImageGeneration).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    connectionId: 'openai-compatible',
    prompt: '生成项目主视觉',
    count: 2,
  })));
});

it('keeps a configured image connection usable when its latest health check failed', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const providerConfigs = {
    'openai-compatible': {
      conversation: { baseUrl: 'https://text.example.test/v1', models: {} },
      image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'images' as const, models: { 'image-generation': 'image-model' } },
    },
  };
  const submitImageGeneration = vi.fn(async () => ({ id: 'task-image-1', requestId: 'request-image-1', state: 'running' as const, cancelRequested: false, attempt: 1 }));
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:image');
  window.designhub = {
    listActiveProjects,
    loadProviderConfigs: async () => providerConfigs,
    loadProviderConnectionStatuses: async () => ({
      'openai-compatible': {
        image: {
          status: 'error' as const,
          testedAt: '2026-10-08T00:00:00.000Z',
          configFingerprint: JSON.stringify(providerConfigs['openai-compatible'].image),
        },
      },
    }),
    submitImageGeneration,
    hasCredential,
  };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Persisted project' }));
  fireEvent.click(screen.getByRole('button', { name: '打开Main' }));
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '再次尝试生成主视觉' } });
  fireEvent.click(screen.getByRole('button', { name: '生成' }));

  await waitFor(() => expect(submitImageGeneration).toHaveBeenCalledWith(expect.objectContaining({
    connectionId: 'openai-compatible',
    model: 'image-model',
    prompt: '再次尝试生成主视觉',
  })));
  expect(screen.queryByText('请先配置图片生成连接。')).not.toBeInTheDocument();
});

it('uses the persisted designer version without embedding project editor controls', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', activeDesignerVersionId: 'user-paper', designerSnapshot: { name: { zh: '纸感排版', en: 'Paper & Type' }, version: 'v1.4' }, documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const loadDesignerState = vi.fn(async () => ({ profiles: persistedProfiles.filter((profile) => ['user-paper', 'user-commerce'].includes(profile.id)), defaultId: 'user-paper' }));
  window.designhub = { listActiveProjects, loadDesignerState };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  expect(screen.getByTestId('project-canvas')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: '设计师' })).toBeInTheDocument();
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
  window.designhub = { listActiveProjects, loadDesignerState };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'read-only' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  const card = await screen.findByRole('button', { name: '协作项目' });
  expect(screen.getByRole('button', { name: '新建项目' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.queryByRole('menuitem', { name: '新建项目' })).not.toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(card);
  expect(screen.getByTestId('project-canvas')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: '设计师' })).toBeInTheDocument();
});

it('opens each persisted document with its own size and scene target', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: '多尺寸项目', documents: [{ id: 'doc-main', name: '主海报', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }, { id: 'doc-square', name: '方图', width: 720, height: 720, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const loadDocumentScene = vi.fn(async () => null);
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { listActiveProjects, loadDocumentScene, saveDocumentScene };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '多尺寸项目' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '多尺寸项目' }));
  expect(screen.getByRole('button', { name: '打开方图' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '打开方图' }));
  await waitFor(() => expect(loadDocumentScene).toHaveBeenCalledWith('workspace-1', 'project-1', 'doc-square'));
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
});

it('routes asset actions from the library into the selected project canvas', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-assets', name: '素材项目', documents: [{ id: 'doc-main', name: '主海报', width: 800, height: 600, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const listAssets = vi.fn(async () => [{ id: 'asset-action', name: '原图', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true }]);
  const loadDocumentScene = vi.fn(async () => null);
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { listActiveProjects, listAssets, loadDocumentScene, saveDocumentScene };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
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
    libraryId: 'workspace-1',
    name: '空白设计稿项目',
    documents: (patch.documents ?? []).map((document) => ({ ...document, updatedAt: '2026-09-13T00:00:00.000Z' })),
    archived: false,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
  }));
  window.designhub = { listActiveProjects, updateProjectMetadata };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  fireEvent.click(await screen.findByRole('button', { name: '空白设计稿项目' }));
  expect(screen.getByTestId('project-canvas')).toBeInTheDocument();
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
    libraryId: 'workspace-1',
    name: '关联尺寸项目',
    documents: (patch.documents ?? []).map((document) => ({
      ...document,
      updatedAt: '2026-09-13T00:00:00.000Z',
    })) ?? [],
    archived: false,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
  }));
  window.designhub = { listActiveProjects, updateProjectMetadata };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '关联尺寸项目' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '关联尺寸项目' }));
  expect(screen.getByTestId('project-canvas')).toBeInTheDocument();
});

it('copies and scales the finalized source scene into a related-size document', async () => {
  const listActiveProjects = vi.fn(async () => [{
    projectId: 'project-related-scene',
    name: '场景关联项目',
    documents: [{ id: 'doc-main', name: '主海报', width: 1000, height: 500, finalizedRevisionId: 'revision-final', updatedAt: '2026-09-12T00:00:00.000Z' }],
  }]);
  const sourceScene = createScene({ id: 'scene-final', width: 1000, height: 500, layers: [{ id: 'title', type: 'text', text: '标题', fontFamily: 'Inter', fontSize: 40, fontWeight: 'bold', align: 'left', color: '#000', x: 100, y: 50, width: 400, height: 60, rotation: 0, opacity: 1, visible: true, locked: false }] });
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-final', projectId: 'project-related-scene', documentId: 'doc-main', parentRevisionId: null, operationId: 'op-final', sceneAssetId: 'scene-final', assetIds: [], contributions: [], createdAt: '2026-09-12T00:00:00.000Z', scene: sourceScene }], timeline: [], finalRevisionId: 'revision-final' }));
  const updateProjectMetadata = vi.fn(async ({ patch }: UpdateProjectMetadataInput): Promise<ProjectMetadata> => ({ projectId: 'project-related-scene', libraryId: 'workspace-1', name: '场景关联项目', documents: (patch.documents ?? []).map((document) => ({ ...document, updatedAt: '2026-09-13T00:00:00.000Z' })), archived: false, createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-13T00:00:00.000Z' }));
  const saveDocumentScene = vi.fn(async () => true);
  window.designhub = { listActiveProjects, loadDocumentRevisions, updateProjectMetadata, saveDocumentScene };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '场景关联项目' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '场景关联项目' }));
  expect(screen.getByTestId('project-canvas')).toBeInTheDocument();
});

it('keeps a created size variant and reports when its scene conversion cannot be saved', async () => {
  const listActiveProjects = vi.fn(async () => [{
    projectId: 'project-variant-save-failure',
    name: '变体保存失败项目',
    documents: [{ id: 'doc-main', name: '主海报', width: 1000, height: 500, finalizedRevisionId: 'revision-final', updatedAt: '2026-09-12T00:00:00.000Z' }],
  }]);
  const sourceScene = createScene({ id: 'scene-final', width: 1000, height: 500, layers: [] });
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-final', projectId: 'project-variant-save-failure', documentId: 'doc-main', parentRevisionId: null, operationId: 'op-final', sceneAssetId: 'scene-final', assetIds: [], contributions: [], createdAt: '2026-09-12T00:00:00.000Z', scene: sourceScene }], timeline: [], finalRevisionId: 'revision-final' }));
  const updateProjectMetadata = vi.fn(async ({ patch }: UpdateProjectMetadataInput): Promise<ProjectMetadata> => ({ projectId: 'project-variant-save-failure', libraryId: 'workspace-1', name: '变体保存失败项目', documents: (patch.documents ?? []).map((document) => ({ ...document, updatedAt: '2026-09-13T00:00:00.000Z' })), archived: false, createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-13T00:00:00.000Z' }));
  const saveDocumentScene = vi.fn(async () => { throw new Error('disk full'); });
  window.designhub = { listActiveProjects, loadDocumentRevisions, updateProjectMetadata, saveDocumentScene };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);

  fireEvent.click(await screen.findByRole('button', { name: '变体保存失败项目' }));
  expect(screen.getByTestId('project-canvas')).toBeInTheDocument();
});

it('keeps conversation and direct project creation on home', async () => {
  const listActiveProjects = vi.fn(async () => []);
  window.designhub = { listActiveProjects };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  expect(await screen.findByRole('textbox', { name: '设计需求' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '新建项目' })).toBeInTheDocument();
  expect(document.querySelector('.studio-sidebar')).not.toBeInTheDocument();
  expect(document.querySelector('.studio-status')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.queryByRole('menuitem', { name: '新建项目' })).not.toBeInTheDocument();
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
  window.designhub = { listActiveProjects, createProjectContainer, submitConversation, hasCredential };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  await screen.findByText('对话模型已连接');
  fireEvent.change(await screen.findByRole('textbox', { name: '设计需求' }), { target: { value: '设计一张发布海报' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));

  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-1',
    name: '未命名项目',
    designs: [],
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
  window.designhub = { listActiveProjects, createProjectContainer, hasCredential };
  render(<Studio locale="en" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  await waitFor(() => expect(hasCredential).toHaveBeenCalledWith('openai-compatible:conversation'));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Design request' }), { target: { value: 'Make a poster' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send and create project' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({ name: 'Untitled project (1)' })));
});

it('keeps project-library identity fixed during automatic project creation', async () => {
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
    listActiveProjects: vi.fn(async () => []),
    createProjectContainer,
    submitConversation,
    hasCredential: vi.fn(async (account: string) => account === 'openai-compatible:conversation'),
  };
  const workspaceA = { libraryId: 'workspace-a', name: 'A', directory: '/tmp/a', formatVersion: 1, openMode: 'writable' as const };
  const props = { locale: 'zh-CN' as const, theme: 'system' as const, onLocaleChange: vi.fn(), onThemeChange: vi.fn(), onExit: vi.fn() };
  render(<Studio {...props} library={workspaceA} />);
  await screen.findByText('对话模型已连接');
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '工作区切换测试' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledOnce());
  resolveCreation?.({ projectId: 'project-from-a' });
  await waitFor(() => expect(submitConversation).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-a',
    projectId: 'project-from-a',
    message: '工作区切换测试',
  })));

  expect(screen.queryByRole('button', { name: '切换工作区' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
});

it('does not create a project when the conversation model is disconnected', async () => {
  const createProjectContainer = vi.fn();
  window.designhub = {
    listActiveProjects: vi.fn(async () => []),
    createProjectContainer,
    hasCredential: vi.fn(async () => false),
  };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  fireEvent.change(await screen.findByRole('textbox', { name: '设计需求' }), { target: { value: '不会创建' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  expect(await screen.findByText('请先连接对话模型。')).toBeInTheDocument();
  expect(createProjectContainer).not.toHaveBeenCalled();
});

it('persists a selected designer snapshot on the next automatic project', async () => {
  const createProjectContainer = vi.fn(async (input: unknown) => { void input; return { projectId: 'project-styled' }; });
  window.designhub = {
    listActiveProjects: vi.fn(async () => []),
    loadDesignerState: vi.fn(async () => ({ profiles: persistedProfiles, defaultId: '', drafts: {} })),
    createProjectContainer,
    hasCredential: vi.fn(async (account: string) => account === 'openai-compatible:conversation'),
  };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

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
    listActiveProjects: vi.fn(async () => []),
    createProjectContainer,
    hasCredential: vi.fn(async (account: string) => account === 'openai-compatible:conversation'),
  };
  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);

  const input = await screen.findByRole('textbox', { name: '设计需求' });
  fireEvent.change(input, { target: { value: '创建失败也保留' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(createProjectContainer).toHaveBeenCalledOnce());
  expect(input).toHaveValue('创建失败也保留');
});
