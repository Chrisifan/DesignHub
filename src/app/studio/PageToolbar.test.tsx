import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { PageToolbarHost, PageToolbarSlot } from './PageToolbar';

it('mounts active page controls inside the shared toolbar host', () => {
  render(
    <header role="banner">
      <PageToolbarHost>
        <PageToolbarSlot active>
          <input aria-label="搜索素材" type="search" />
        </PageToolbarSlot>
      </PageToolbarHost>
    </header>,
  );

  expect(screen.getByRole('banner')).toContainElement(
    screen.getByRole('searchbox', { name: '搜索素材' }),
  );
});

it('does not mount controls from an inactive destination', () => {
  render(
    <header role="banner">
      <PageToolbarHost>
        <PageToolbarSlot active={false}>
          <button type="button">导入</button>
        </PageToolbarSlot>
      </PageToolbarHost>
    </header>,
  );

  expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument();
});
