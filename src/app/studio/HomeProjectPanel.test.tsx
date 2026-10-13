import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { HomeProjectPanel } from './HomeProjectPanel';
import type { Project } from './types';

it('keeps existing project categories and opens a compact project row', () => {
  const onFilterChange = vi.fn();
  const onOpenProject = vi.fn();
  const projects: Project[] = [{
    id: 'p1',
    name: '春间市集',
    enName: 'Spring Market',
    description: '',
    enDescription: '',
    designers: [],
    artwork: 'blank',
    updatedAt: '2026-09-20T00:00:00.000Z',
  }];
  render(
    <HomeProjectPanel
      locale="zh-CN"
      allProjects={projects}
      projects={projects}
      filter="active"
      query=""
      loadFailed={false}
      onFilterChange={onFilterChange}
      onQueryChange={vi.fn()}
      onOpenProject={onOpenProject}
      onRetry={vi.fn()}
    />,
  );

  expect(screen.getByRole('group', { name: '项目状态' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '全部项目' }));
  expect(onFilterChange).toHaveBeenCalledWith('all');
  fireEvent.click(screen.getByRole('button', { name: '春间市集' }));
  expect(onOpenProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
});

it('clears a search that has no matching projects', () => {
  const onQueryChange = vi.fn();
  render(
    <HomeProjectPanel
      locale="zh-CN"
      allProjects={[]}
      projects={[]}
      filter="active"
      query="不存在"
      loadFailed={false}
      onFilterChange={vi.fn()}
      onQueryChange={onQueryChange}
      onOpenProject={vi.fn()}
      onRetry={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
  expect(onQueryChange).toHaveBeenCalledWith('');
});
