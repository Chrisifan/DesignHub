import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { PersonaRepository } from './PersonaRepository';
import { personaProfiles } from '../../../tests/fixtures/personas';

it('filters compact profile rows and identifies the selected profile', () => {
  render(
    <PersonaRepository
      locale="zh-CN"
      profiles={personaProfiles}
      selectedId="paper-type"
      sessionDefaultId="paper-type"
      onSelect={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('设计师档案库')).toHaveTextContent('纸感排版');
  expect(screen.getByRole('button', { name: /纸感排版/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索档案' }), { target: { value: '商业' } });
  expect(screen.getByRole('button', { name: /清晰商业/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /纸感排版/ })).not.toBeInTheDocument();
});

it('omits the local repository heading while retaining the repository label', () => {
  render(
    <PersonaRepository
      locale="zh-CN"
      profiles={personaProfiles}
      selectedId="paper-type"
      onSelect={vi.fn()}
    />,
  );

  expect(screen.getByLabelText('设计师档案库')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '设计师档案' })).not.toBeInTheDocument();
  expect(screen.queryByText('PERSONA REPOSITORY')).not.toBeInTheDocument();
});

it('wraps an empty designer repository in the page-level empty-state region', () => {
  render(
    <PersonaRepository locale="zh-CN" profiles={[]} selectedId="" onSelect={vi.fn()} />,
  );

  expect(
    screen.getByRole('heading', { name: '暂无设计师档案' }).closest('.page-empty-state'),
  ).not.toBeNull();
});
