import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { PageHeader } from './ui';

it('keeps page identity without creating a second action slot', () => {
  render(
    <PageHeader
      eyebrow="工作区 / 创作"
      title="项目库"
      description="从一个想法，到一组完整的作品。"
    />,
  );

  expect(screen.getByRole('heading', { name: '项目库' }).parentElement).toHaveClass(
    'page-heading__content',
  );
  expect(document.querySelector('.page-heading__actions')).not.toBeInTheDocument();
});
