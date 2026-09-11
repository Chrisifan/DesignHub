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

it('keeps the product identity and workspace switch in the top bar', () => {
  render(
    <WindowBar
      copy={getMessages('zh-CN')}
      nativeControlSide="left"
      workspace={{
        name: '我的设计空间',
        detail: '示例工作区',
        label: '切换工作区',
        onClick: () => undefined,
      }}
    />,
  );

  const bar = document.querySelector('.window-bar');
  expect(bar?.querySelector('.window-brand-mark')).toHaveTextContent('D');
  expect(bar).toContainElement(screen.getByText('DesignHub'));
  expect(bar).toContainElement(
    screen.getByRole('button', { name: '切换工作区' }),
  );
});
