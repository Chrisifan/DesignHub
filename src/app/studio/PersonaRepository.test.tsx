import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { PersonaRepository } from './PersonaRepository';
import { personaProfiles } from './personas';

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
