import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { HomeProjectPanel } from './HomeProjectPanel';
import type { Project } from './types';

it.each(['active', 'archived', 'all'] as const)('sorts %s projects by latest update and reorders after an update', (filter) => {
  const project = (id: string, updatedAt?: string): Project => ({
    id, name: id, enName: id, description: '', enDescription: '', designers: [], artwork: 'blank', updatedAt,
  });
  const projects = [
    project('A older', '2026-10-19T00:00:00.000Z'),
    project('B missing date'),
    project('C latest', '2026-10-20T10:00:00+08:00'),
    project('D earlier today', '2026-10-20T01:00:00.000Z'),
    project('E same time', '2026-10-20T01:00:00.000Z'),
  ];
  const props = {
    locale: 'en' as const, allProjects: projects, projects, filter, query: '', loadFailed: false,
    onFilterChange: vi.fn(), onQueryChange: vi.fn(), onOpenProject: vi.fn(), onRetry: vi.fn(),
  };
  const { container, rerender } = render(<HomeProjectPanel {...props} />);
  const rowNames = (): (string | null)[] => Array.from(container.querySelectorAll('.studio-home-project-row')).map((row) => row.getAttribute('aria-label'));
  expect(rowNames()).toEqual(['C latest', 'D earlier today', 'E same time', 'A older', 'B missing date']);
  expect(projects.map((entry) => entry.id)).toEqual(['A older', 'B missing date', 'C latest', 'D earlier today', 'E same time']);

  rerender(<HomeProjectPanel {...props} projects={projects.map((entry) => entry.id === 'A older' ? { ...entry, updatedAt: '2026-10-21T00:00:00.000Z' } : entry)} />);
  expect(rowNames()).toEqual(['A older', 'C latest', 'D earlier today', 'E same time', 'B missing date']);
});

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
