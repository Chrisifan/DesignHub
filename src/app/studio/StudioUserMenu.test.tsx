import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { StudioUserMenu } from './StudioUserMenu';

it('navigates from grouped menu items and closes after selection', () => {
  const onNavigate = vi.fn();
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="本机操作者"
      currentView="projects"
      onNavigate={onNavigate}
      onNewProject={vi.fn()}
      onImportProject={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '设计师' }));

  expect(onNavigate).toHaveBeenCalledWith('designers');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '打开用户菜单' })).toHaveFocus();
});

it('closes on Escape and exposes manual project actions', () => {
  const onNewProject = vi.fn();
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName=""
      currentView="projects"
      onNavigate={vi.fn()}
      onNewProject={onNewProject}
      onImportProject={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.getByRole('menuitem', { name: '新建项目' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();

  const trigger = screen.getByRole('button', { name: '打开用户菜单' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitem', { name: '新建项目' }));
  expect(onNewProject).toHaveBeenCalledOnce();
  expect(trigger).toHaveFocus();
});

it('supports arrow navigation and restores trigger focus on Escape', async () => {
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="S"
      currentView="projects"
      onNavigate={vi.fn()}
      onNewProject={vi.fn()}
      onImportProject={vi.fn()}
    />,
  );
  const trigger = screen.getByRole('button', { name: '打开用户菜单' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const home = await screen.findByRole('menuitem', { name: '首页' });
  await waitFor(() => expect(home).toHaveFocus());
  fireEvent.keyDown(home, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: '设计师' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menuitem', { name: '设计师' }), { key: 'End' });
  expect(screen.getByRole('menuitem', { name: '导入项目包' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menuitem', { name: '导入项目包' }), { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('disables project creation and import when requested', () => {
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="S"
      currentView="projects"
      onNavigate={vi.fn()}
      onNewProject={vi.fn()}
      onImportProject={vi.fn()}
      newProjectDisabled
      importDisabled
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.getByRole('menuitem', { name: '新建项目' })).toBeDisabled();
  expect(screen.getByRole('menuitem', { name: '导入项目包' })).toBeDisabled();
});

it('renders the persisted avatar instead of the initial fallback', () => {
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="Sifan"
      avatarDataUrl="data:image/webp;base64,AA=="
      currentView="projects"
      onNavigate={vi.fn()}
      onNewProject={vi.fn()}
      onImportProject={vi.fn()}
    />,
  );

  expect(screen.getByRole('img', { name: '用户头像' })).toHaveAttribute('src', 'data:image/webp;base64,AA==');
  expect(screen.queryByText('S')).toBeNull();
});
