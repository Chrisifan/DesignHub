import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { StudioUserMenu } from './StudioUserMenu';

it('omits redundant home and new-project entries from the user menu', () => {
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="本机操作者"
      currentView="projects"
      onNavigate={vi.fn()}
      onImportProject={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));

  expect(screen.queryByRole('menuitem', { name: '首页' })).not.toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: '新建项目' })).not.toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '废纸篓与备份' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: '工作区管理' })).not.toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '导入项目包' })).toBeInTheDocument();
});

it('navigates from grouped menu items and closes after selection', () => {
  const onNavigate = vi.fn();
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="本机操作者"
      currentView="projects"
      onNavigate={onNavigate}
      onImportProject={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '设计师' }));

  expect(onNavigate).toHaveBeenCalledWith('designers');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '打开用户菜单' })).toHaveFocus();
});

it('exposes one menu entry per image batch tool', () => {
  const onNavigate = vi.fn();
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="本机操作者"
      currentView="projects"
      onNavigate={onNavigate}
      onImportProject={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.getByRole('menuitem', { name: '去除背景' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '放大图像' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '尺寸转换' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '格式转换' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: '图像工具' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('menuitem', { name: '放大图像' }));
  expect(onNavigate).toHaveBeenCalledWith('image-tool-upscale');
});

it('does not expose a canvas image tools navigation action', () => {
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="本机操作者"
      currentView="projects"
      onNavigate={vi.fn()}
      onImportProject={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.queryByRole('menuitem', { name: '画布图像工具' })).not.toBeInTheDocument();
});

it('closes on Escape and exposes the project import action', () => {
  const onImportProject = vi.fn();
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName=""
      currentView="projects"
      onNavigate={vi.fn()}
      onImportProject={onImportProject}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
  expect(screen.getByRole('menuitem', { name: '导入项目包' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();

  const trigger = screen.getByRole('button', { name: '打开用户菜单' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitem', { name: '导入项目包' }));
  expect(onImportProject).toHaveBeenCalledOnce();
  expect(trigger).toHaveFocus();
});

it('supports arrow navigation and restores trigger focus on Escape', async () => {
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="S"
      currentView="projects"
      onNavigate={vi.fn()}
      onImportProject={vi.fn()}
    />,
  );
  const trigger = screen.getByRole('button', { name: '打开用户菜单' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const designers = await screen.findByRole('menuitem', { name: '设计师' });
  await waitFor(() => expect(designers).toHaveFocus());
  fireEvent.keyDown(designers, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: '素材库' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menuitem', { name: '素材库' }), { key: 'End' });
  expect(screen.getByRole('menuitem', { name: '导入项目包' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menuitem', { name: '导入项目包' }), { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('disables project import when requested', () => {
  render(
    <StudioUserMenu
      locale="zh-CN"
      operatorName="S"
      currentView="projects"
      onNavigate={vi.fn()}
      onImportProject={vi.fn()}
      importDisabled
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
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
      onImportProject={vi.fn()}
    />,
  );

  expect(screen.getByRole('img', { name: '用户头像' })).toHaveAttribute('src', 'data:image/webp;base64,AA==');
  expect(screen.queryByText('S')).toBeNull();
});
