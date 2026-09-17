import { fireEvent, render, screen, within } from '@testing-library/react';
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

it('renders selectable Avatar-led dossier cards', () => {
  const onSelect = vi.fn();
  render(
    <PersonaRepository
      locale="zh-CN"
      profiles={personaProfiles}
      selectedId="paper-type"
      sessionDefaultId="paper-type"
      onSelect={onSelect}
    />,
  );

  const card = screen.getByRole('button', { name: /纸感排版/ });
  expect(card).toHaveAttribute('aria-pressed', 'true');
  expect(within(card).getByText('默认')).toBeInTheDocument();
  expect(within(card).getByText('留白占比')).toBeInTheDocument();
  expect(within(card).getByText('漫反射率')).toBeInTheDocument();
  expect(card.querySelector('.designer-profile-card--library')).not.toBeNull();
  fireEvent.click(card);
  expect(onSelect).toHaveBeenCalledWith('paper-type');
});

it('retains complete long identity text on a stable card', () => {
  const longName = '一位名称非常非常长的设计师档案用于验证卡片截断';
  const longSignature = '这是一条同样很长并且不应该撑开档案卡片的设计师署名';
  const profile = {
    ...personaProfiles[0]!,
    id: 'long-profile',
    name: { zh: longName, en: 'Long profile name' },
    signature: { zh: longSignature, en: 'Long profile signature' },
  };
  render(
    <PersonaRepository
      locale="zh-CN"
      profiles={[profile]}
      selectedId=""
      onSelect={vi.fn()}
    />,
  );

  const card = screen.getByRole('button', { name: new RegExp(longName) });
  expect(within(card).getByText(longName)).toHaveAttribute('title', longName);
  expect(within(card).getByText(longSignature)).toHaveAttribute('title', longSignature);
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
