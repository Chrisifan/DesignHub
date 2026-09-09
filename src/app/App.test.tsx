import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';

import { App } from './App';

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

  fireEvent.change(screen.getByLabelText('主题'), { target: { value: 'dark' } });

  expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByRole('heading', { name: '开始本地创作' })).toBe(welcomeTitle);
  expect(document.activeElement).toBe(openWorkspace);
});
