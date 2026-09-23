import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { personaProfiles } from '../../../tests/fixtures/personas';
import { HomeDesignerRail } from './HomeDesignerRail';

it('opens a designer profile when an available designer is clicked', () => {
  const onInspect = vi.fn();
  render(<HomeDesignerRail locale="zh-CN" profiles={personaProfiles} selectedId="" onInspect={onInspect} />);
  fireEvent.click(screen.getByRole('button', { name: /查看设计师档案：纸感排版/ }));
  expect(onInspect).toHaveBeenCalledWith(personaProfiles[0]);
});

it('marks the composer designer and hides archived profiles', () => {
  const onInspect = vi.fn();
  render(
    <HomeDesignerRail
      locale="zh-CN"
      profiles={[...personaProfiles, { ...personaProfiles[0]!, id: 'archived', status: 'archived', name: { zh: '已归档', en: 'Archived' } }]}
      selectedId="paper-type"
      onInspect={onInspect}
    />,
  );
  expect(screen.queryByText('已归档')).not.toBeInTheDocument();
  const card = screen.getByRole('button', { name: /查看设计师档案：纸感排版/ });
  expect(card).toHaveClass('is-selected');
  fireEvent.click(card);
  expect(onInspect).toHaveBeenCalledWith(personaProfiles[0]);
});
