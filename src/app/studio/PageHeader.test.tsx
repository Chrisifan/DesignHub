import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { PageHeader } from './ui';

it('keeps title content and actions in stable layout slots', () => {
  render(
    <PageHeader
      eyebrow="工作区 / 创作"
      title="项目库"
      description="从一个想法，到一组完整的作品。"
    >
      <button type="button">新建</button>
    </PageHeader>,
  );

  expect(screen.getByRole('heading', { name: '项目库' }).parentElement).toHaveClass(
    'page-heading__content',
  );
  expect(screen.getByRole('button', { name: '新建' }).parentElement).toHaveClass(
    'page-heading__actions',
  );
});
