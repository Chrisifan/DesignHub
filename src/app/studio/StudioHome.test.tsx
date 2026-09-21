import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { personaProfiles } from '../../../tests/fixtures/personas';
import { StudioHome } from './StudioHome';

it('adds the selected designer to the next home conversation only', async () => {
  const onSubmit = vi.fn(async () => true);
  render(
    <StudioHome
      locale="zh-CN"
      projects={[]}
      visibleProjects={[]}
      profiles={personaProfiles}
      filter="active"
      query=""
      loadFailed={false}
      readOnly={false}
      conversationConnected
      onFilterChange={vi.fn()}
      onQueryChange={vi.fn()}
      onOpenProject={vi.fn()}
      onRetry={vi.fn()}
      onViewAllDesigners={vi.fn()}
      onSubmit={onSubmit}
      notify={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /选择设计师：纸感排版/ }));
  expect(screen.getByRole('form', { name: 'AI 操作坞' })).toHaveTextContent('纸感排版');
  expect(screen.queryByLabelText('提示词建议')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '设计海报' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ message: '设计海报', attachments: [], generationRatio: '3:4', designerId: 'paper-type' }));
  expect(screen.getByRole('button', { name: /选择设计师：纸感排版/ })).toHaveAttribute('aria-pressed', 'false');
});

it('clears the pending designer when the workspace changes', async () => {
  const props = {
    locale: 'zh-CN' as const,
    projects: [],
    visibleProjects: [],
    profiles: personaProfiles,
    filter: 'active' as const,
    query: '',
    loadFailed: false,
    readOnly: false,
    conversationConnected: true,
    onFilterChange: vi.fn(),
    onQueryChange: vi.fn(),
    onOpenProject: vi.fn(),
    onRetry: vi.fn(),
    onViewAllDesigners: vi.fn(),
    onSubmit: vi.fn(async () => true),
    notify: vi.fn(),
  };
  const { rerender } = render(<StudioHome {...props} workspaceId="workspace-a" />);
  const designer = screen.getByRole('button', { name: /选择设计师：纸感排版/ });
  fireEvent.click(designer);
  expect(designer).toHaveAttribute('aria-pressed', 'true');

  rerender(<StudioHome {...props} workspaceId="workspace-b" />);
  await waitFor(() => expect(screen.getByRole('button', { name: /选择设计师：纸感排版/ })).toHaveAttribute('aria-pressed', 'false'));
});

it('moves product identity into the home body and widens the empty-state conversation', () => {
  render(
    <StudioHome
      locale="zh-CN"
      projects={[]}
      visibleProjects={[]}
      profiles={[]}
      filter="active"
      query=""
      loadFailed={false}
      readOnly={false}
      conversationConnected
      onFilterChange={vi.fn()}
      onQueryChange={vi.fn()}
      onOpenProject={vi.fn()}
      onRetry={vi.fn()}
      onViewAllDesigners={vi.fn()}
      onSubmit={vi.fn(async () => true)}
      onNewProject={vi.fn()}
      notify={vi.fn()}
    />,
  );

  expect(screen.getByRole('img', { name: 'Design Hub' })).toBeVisible();
  expect(screen.getByText('Design Hub', { selector: 'strong' })).toBeVisible();
  expect(screen.queryByRole('complementary', { name: '项目列表' })).toBeNull();
  expect(screen.getByRole('heading', { name: '欢迎使用 Design Hub' })).toBeVisible();
  expect(screen.queryByText('从一个想法开始')).toBeNull();
  expect(screen.queryByText('发送你的首个需求，我们会创建项目并在画布中展开分析。')).toBeNull();
  expect(screen.queryByRole('region', { name: '设计师灵感' })).toBeNull();
  expect(screen.getByRole('button', { name: '新建项目' })).toBeVisible();
});

it('hides the designer inspiration rail when no usable designer exists', () => {
  render(
    <StudioHome
      locale="zh-CN"
      projects={[{ id: 'p1', name: '项目', enName: 'Project', description: '', enDescription: '', designers: [], artwork: 'blank', documents: 1 }]}
      visibleProjects={[]}
      profiles={[{ ...personaProfiles[0], status: 'archived' }]}
      filter="active"
      query=""
      loadFailed={false}
      readOnly={false}
      conversationConnected
      onFilterChange={vi.fn()}
      onQueryChange={vi.fn()}
      onOpenProject={vi.fn()}
      onRetry={vi.fn()}
      onViewAllDesigners={vi.fn()}
      onSubmit={vi.fn(async () => true)}
      onNewProject={vi.fn()}
      notify={vi.fn()}
    />,
  );

  expect(screen.queryByRole('region', { name: '设计师灵感' })).toBeNull();
});
