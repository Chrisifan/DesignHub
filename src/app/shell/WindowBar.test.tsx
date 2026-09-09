import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { getMessages } from '../i18n';
import { WindowBar } from './WindowBar';

it('reserves a non-draggable safe area for native window controls', () => {
  const { container } = render(<WindowBar copy={getMessages('zh-CN')} nativeControlSide="left" />);
  const safeArea = container.querySelector('.window-control-safe-area--left');
  const dragRegion = container.querySelector('.window-bar-drag-region');

  expect(safeArea).toHaveAttribute('aria-hidden', 'true');
  expect(safeArea?.compareDocumentPosition(dragRegion as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(screen.queryByLabelText('最小化 最大化 关闭')).toBeNull();
});
