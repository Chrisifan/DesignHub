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
      onSubmit={onSubmit}
      notify={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('combobox', { name: '设计师' }));
  fireEvent.click(screen.getByRole('option', { name: /纸感排版/ }));
  expect(screen.getByRole('form', { name: 'AI 操作坞' })).toHaveTextContent('纸感排版');
  expect(screen.queryByLabelText('提示词建议')).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '设计海报' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ message: '设计海报', attachments: [], generationRatio: 'original', designerId: 'paper-type' }));
  expect(screen.getByRole('combobox', { name: '设计师' })).toHaveValue('');
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
    onSubmit: vi.fn(async () => true),
    notify: vi.fn(),
  };
  const { rerender } = render(<StudioHome {...props} libraryId="workspace-a" />);
  fireEvent.click(screen.getByRole('combobox', { name: '设计师' }));
  fireEvent.click(screen.getByRole('option', { name: /纸感排版/ }));
  expect(screen.getByRole('combobox', { name: '设计师' })).toHaveValue('paper-type');

  rerender(<StudioHome {...props} libraryId="workspace-b" />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: '设计师' })).toHaveValue(''));
});

it('opens a designer profile from the home rail without selecting it for the conversation', () => {
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
      onSubmit={vi.fn(async () => true)}
      notify={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /查看设计师档案：纸感排版/ }));

  const dialog = screen.getByRole('dialog', { name: '设计师信息' });
  expect(dialog).toHaveTextContent('纸感排版');
  expect(dialog).toHaveTextContent('Style DNA');
  expect(screen.getByRole('combobox', { name: '设计师' })).toHaveValue('');
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
      projects={[{ id: 'p1', name: '项目', enName: 'Project', description: '', enDescription: '', designers: [], artwork: 'blank' }]}
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
      onSubmit={vi.fn(async () => true)}
      onNewProject={vi.fn()}
      notify={vi.fn()}
    />,
  );

  expect(screen.queryByRole('region', { name: '设计师灵感' })).toBeNull();
});
