import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ImageToolsPage } from './ImageToolsPage';

it('uses the shared page container and centered empty-state region', () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  expect(screen.getByRole('region', { name: '图像工具' })).toHaveClass('page-content', 'library-page', 'image-tools-page');
  expect(screen.getByRole('heading', { name: '暂无图像作业' }).closest('.page-empty-state')).not.toBeNull();
});
