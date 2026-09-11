import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { App } from './App';

beforeEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(window, 'designhub');
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('未连接模型也能进入本地工作区入口', () => {
  render(<App />);

  expect(screen.getByRole('button', { name: '新建工作区' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '打开工作区' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: '必须登录' })).toBeNull();
});

it('cancellation of the typed directory chooser leaves the welcome shell usable', async () => {
  const chooseWorkspaceDirectory = vi.fn(async () => null);
  window.designhub = { chooseWorkspaceDirectory };
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: '打开工作区' }));

  await waitFor(() => expect(chooseWorkspaceDirectory).toHaveBeenCalledOnce());
  expect(screen.getByRole('button', { name: '新建工作区' })).toBeEnabled();
});

it('switches the bundled semantic labels between Chinese and English', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));

  expect(screen.getByRole('button', { name: 'New workspace' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Open workspace' })).toBeEnabled();
});

it('changes only the theme token mode without remounting or moving focus', () => {
  render(<App />);
  const welcomeTitle = screen.getByRole('heading', { name: '开始本地创作' });
  const openWorkspace = screen.getByRole('button', { name: '打开工作区' });
  openWorkspace.focus();

  fireEvent.click(screen.getByRole('button', { name: '切换主题' }));

  expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByRole('heading', { name: '开始本地创作' })).toBe(
    welcomeTitle,
  );
  expect(document.activeElement).toBe(openWorkspace);
});

it('preserves workspace input when the native folder chooser fails', async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => {
      throw new Error('native chooser failed');
    },
  };
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '新建工作区' }));
  fireEvent.change(screen.getByRole('textbox', { name: '工作区名称' }), {
    target: { value: '我的空间' },
  });
  fireEvent.click(screen.getByRole('button', { name: '选择目录' }));
  await screen.findByText('无法打开目录选择器，请重试。输入内容已保留。');
  expect(screen.getByRole('textbox', { name: '工作区名称' })).toHaveValue(
    '我的空间',
  );
});

it('opens the desktop application directly in the workspace shell', () => {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
    'DesignHub Electron/44.3.0',
  );
  window.designhub = { chooseWorkspaceDirectory: async () => null };

  render(<App />);

  expect(screen.getByRole('heading', { name: '项目库' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: '开始本地创作' })).toBeNull();
});

it('creates a real workspace from the welcome form instead of entering example mode', async () => {
  const createWorkspace = vi.fn(async ({ parentDirectory, name }: { parentDirectory: string; name: string }) => ({
    workspaceId: 'workspace-created',
    name,
    directory: `${parentDirectory}/${name}`,
    formatVersion: 1,
    openMode: 'writable' as const,
  }));
  window.designhub = {
    chooseWorkspaceDirectory: async () => '/tmp/designhub-parent',
    createWorkspace,
    openWorkspace: async () => null,
  } as never;
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: '新建工作区' }));
  fireEvent.change(screen.getByRole('textbox', { name: '工作区名称' }), {
    target: { value: '我的真实空间' },
  });
  fireEvent.click(screen.getByRole('button', { name: '选择目录' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '创建' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '创建' }));

  await waitFor(() => expect(createWorkspace).toHaveBeenCalledWith({
    parentDirectory: '/tmp/designhub-parent',
    name: '我的真实空间',
  }));
  expect(await screen.findByRole('button', { name: '切换工作区' })).toHaveTextContent('我的真实空间');
  expect(screen.getByRole('heading', { name: '项目库' })).toBeVisible();
});

it('opens a selected workspace and preserves read-only mode in the shell', async () => {
  const openWorkspace = vi.fn(async (directory: string) => ({
    workspaceId: 'workspace-opened',
    name: '只读空间',
    directory,
    formatVersion: 3,
    openMode: 'read-only' as const,
  }));
  window.designhub = {
    chooseWorkspaceDirectory: async () => '/tmp/designhub-workspace',
    createWorkspace: async () => null,
    openWorkspace,
  } as never;
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: '打开工作区' }));

  await waitFor(() => expect(openWorkspace).toHaveBeenCalledWith('/tmp/designhub-workspace'));
  expect(await screen.findByRole('button', { name: '切换工作区' })).toHaveTextContent('只读空间');
  expect(screen.getByRole('heading', { name: '项目库' })).toBeVisible();
});

it('keeps the create form when workspace storage rejects the request', async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => '/tmp/designhub-parent',
    createWorkspace: async () => {
      throw new Error('WORKSPACE_EXISTS');
    },
  };
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: '新建工作区' }));
  fireEvent.change(screen.getByRole('textbox', { name: '工作区名称' }), {
    target: { value: '重复空间' },
  });
  fireEvent.click(screen.getByRole('button', { name: '选择目录' }));
  const createButton = await screen.findByRole('button', { name: '创建' });
  await waitFor(() => expect(createButton).toBeEnabled());
  fireEvent.click(createButton);

  await screen.findByText('无法创建工作区，请检查名称和目录。');
  expect(screen.getByRole('textbox', { name: '工作区名称' })).toHaveValue('重复空间');
  expect(screen.getByRole('textbox', { name: '本地目录' })).toHaveValue('/tmp/designhub-parent');
  expect(screen.getByRole('heading', { name: '开始本地创作' })).toBeVisible();
});

it('keeps the welcome shell when opening a workspace fails', async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => '/tmp/invalid-workspace',
    openWorkspace: async () => {
      throw new Error('INVALID_WORKSPACE_MANIFEST');
    },
  };
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: '打开工作区' }));

  await screen.findByText('无法打开工作区，请确认目录有效。');
  expect(screen.getByRole('heading', { name: '开始本地创作' })).toBeVisible();
});
