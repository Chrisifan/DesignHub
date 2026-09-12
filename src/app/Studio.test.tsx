import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { Studio } from './studio/Studio';

beforeEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(window, 'designhub');
});
const enter = () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '浏览示例' }));
};

it('lets an offline user navigate the example workspace without a connection or disk save claim', () => {
  enter();
  const navigation = screen.getByRole('navigation', { name: '主导航' });
  fireEvent.click(within(navigation).getByRole('button', { name: '设计师' }));
  expect(screen.getByRole('heading', { name: '设计师' })).toBeInTheDocument();
  fireEvent.click(within(navigation).getByRole('button', { name: '模型连接' }));
  expect(screen.getByRole('heading', { name: '模型连接' })).toBeInTheDocument();
  expect(screen.getByText('尚未连接模型')).toBeInTheDocument();
  expect(screen.queryByText('已保存到本地')).not.toBeInTheDocument();
});

it('shows a design cover with its designer avatar, name, and version', () => {
  enter();
  const project = screen.getByRole('button', { name: '春间市集' });
  expect(
    within(project).getByRole('img', { name: '纸感排版的人物形象' }),
  ).toBeInTheDocument();
  expect(within(project).getByText('纸感排版 · v1.4')).toBeInTheDocument();
});

it('keeps project actions in the breadcrumb toolbar instead of the page title', () => {
  enter();
  const toolbar = screen.getByRole('banner', { name: '工作区工具栏' });
  expect(within(toolbar).getByRole('button', { name: '新建项目' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: '新建项目' })).toHaveLength(1);
});

it('shows the active persona and working principle when opening a project', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: '春间市集' }));
  expect(screen.getByLabelText('当前设计师')).toHaveTextContent(
    '先建立文字层级',
  );
  expect(
    screen.getByRole('img', { name: '纸感排版的人物形象' }),
  ).toBeInTheDocument();
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

it('opens a project document and returns to that project', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: /春间市集/ }));
  fireEvent.click(screen.getByRole('button', { name: '打开主海报' }));
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回项目' }));
  expect(screen.getByRole('heading', { name: '春间市集' })).toBeInTheDocument();
});

it('creates only a labelled preview draft and keeps project input when dismissing the form', () => {
  enter();
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
    target: { value: '我的测试项目' },
  });
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  expect(screen.getByRole('textbox', { name: '项目名称' })).toHaveValue(
    '我的测试项目',
  );
  fireEvent.click(screen.getByRole('button', { name: '创建预览' }));
  expect(
    screen.getByRole('heading', { name: '我的测试项目' }),
  ).toBeInTheDocument();
  expect(screen.getByText('预览草稿')).toBeInTheDocument();
  expect(screen.queryByText('已保存到本地')).not.toBeInTheDocument();
});

it('keeps the draft when language and theme change and remembers UI preferences', () => {
  enter();
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
    target: { value: '保留输入' },
  });
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  fireEvent.click(screen.getByRole('button', { name: '切换主题' }));
  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'New project' })[0]!);
  expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue(
    '保留输入',
  );
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('designhub.ui.locale')).toBe('en');
  expect(localStorage.getItem('designhub.ui.theme')).toBe('dark');
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

it('imports a project package and refreshes the persisted project list', async () => {
  const listActiveProjects = vi.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ projectId: 'project-imported', name: 'Imported project' }]);
  const importProjectPackage = vi.fn(async () => ({ projectId: 'project-imported' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, importProjectPackage };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('heading', { name: '项目库' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '导入项目包' }));
  await waitFor(() => expect(importProjectPackage).toHaveBeenCalledWith({ workspaceId: 'workspace-1' }));
  expect(await screen.findByRole('button', { name: 'Imported project' })).toBeInTheDocument();
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
  fireEvent.click(screen.getByRole('button', { name: '打开主海报' }));
  fireEvent.click(screen.getByRole('button', { name: '对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '修改说明' }), { target: { value: '调整标题' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(submitConversation).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-1', projectId: 'project-1', connectionId: 'openai-compatible', message: '调整标题' })));
});

it('uses the persisted designer version and lets a writable project switch designers', async () => {
  const listActiveProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'Persisted project', activeDesignerVersionId: 'paper-type', designerSnapshot: { name: { zh: '纸感排版', en: 'Paper & Type' }, version: 'v1.4' }, documents: [{ id: 'doc-1', name: 'Main', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }] }]);
  const loadDesignerState = vi.fn(async () => ({ profiles: [], defaultId: 'paper-type' }));
  const updateProjectMetadata = vi.fn(async ({ patch }: { patch: { activeDesignerVersionId?: string; designerSnapshot?: unknown } }) => ({ projectId: 'project-1', workspaceId: 'workspace-1', name: 'Persisted project', activeDesignerVersionId: patch.activeDesignerVersionId, designerSnapshot: patch.designerSnapshot, archived: false, documents: [], createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:01.000Z' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, loadDesignerState, updateProjectMetadata };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Persisted project' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Persisted project' }));
  const selector = screen.getByRole('combobox', { name: '设计师' });
  fireEvent.change(selector, { target: { value: 'clear-commerce' } });
  await waitFor(() => expect(updateProjectMetadata).toHaveBeenCalledWith(expect.objectContaining({ patch: expect.objectContaining({ activeDesignerVersionId: 'clear-commerce' }) })));
});

it('submits conversation creation as a draft task before any project exists', async () => {
  const listActiveProjects = vi.fn(async () => []);
  const createProjectContainer = vi.fn(async () => ({ projectId: 'should-not-create' }));
  const submitConversation = vi.fn(async () => ({ id: 'task-draft-1', requestId: 'request-1', state: 'running' as const, cancelRequested: false, attempt: 1 }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listActiveProjects, createProjectContainer, submitConversation };
  render(<Studio locale="zh-CN" theme="system" workspace={{ workspaceId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={() => undefined} onThemeChange={() => undefined} onExit={() => undefined} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '项目库' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), { target: { value: 'Drafted project' } });
  fireEvent.click(screen.getByRole('button', { name: '通过对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '创作想法' }), { target: { value: 'Create a spring poster' } });
  fireEvent.click(screen.getByRole('button', { name: '提交简报' }));
  await waitFor(() => expect(submitConversation).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: 'workspace-1',
    source: { kind: 'creation-draft', id: expect.any(String) },
    message: 'Create a spring poster',
  })));
  expect(createProjectContainer).not.toHaveBeenCalled();
});
