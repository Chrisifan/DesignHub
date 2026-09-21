import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { personaProfiles } from '../../../tests/fixtures/personas';
import { HomeDesignerRail } from './HomeDesignerRail';

it('defaults to no designer and selects one available designer', () => {
  const onChange = vi.fn();
  render(<HomeDesignerRail locale="zh-CN" profiles={personaProfiles} selectedId="" onChange={onChange} onViewAll={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /选择设计师：纸感排版/ }));
  expect(onChange).toHaveBeenCalledWith('paper-type');
});

it('cancels the selected designer and hides archived profiles', () => {
  const onChange = vi.fn();
  render(
    <HomeDesignerRail
      locale="zh-CN"
      profiles={[...personaProfiles, { ...personaProfiles[0]!, id: 'archived', status: 'archived', name: { zh: '已归档', en: 'Archived' } }]}
      selectedId="paper-type"
      onChange={onChange}
      onViewAll={vi.fn()}
    />,
  );
  expect(screen.queryByText('已归档')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /取消设计师：纸感排版/ }));
  expect(onChange).toHaveBeenCalledWith('');
});
