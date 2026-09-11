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
