import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { getMessages } from '../i18n';
import { WindowBar } from './WindowBar';

it('reserves a non-draggable safe area for native window controls', () => {
  const { container } = render(
    <WindowBar
      copy={getMessages('zh-CN')}
      locale="zh-CN"
      theme="system"
      nativeControlSide="left"
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      themeLabel="切换主题"
    />,
  );
  const safeArea = container.querySelector('.window-control-safe-area--left');
  const dragRegion = container.querySelector('.window-bar-drag-region');

  expect(safeArea).toHaveAttribute('aria-hidden', 'true');
  expect(safeArea?.compareDocumentPosition(dragRegion as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(screen.queryByLabelText('最小化 最大化 关闭')).toBeNull();
});

it('keeps appearance controls in the top bar without workspace lifecycle controls', () => {
  render(
    <WindowBar
      copy={getMessages('zh-CN')}
      locale="zh-CN"
      theme="system"
      nativeControlSide="left"
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      themeLabel="切换主题"
      workspace={{
        name: '我的设计空间',
        detail: '示例工作区',
        label: '切换工作区',
        onClick: () => undefined,
      }}
    />,
  );

  const bar = document.querySelector('.window-bar');
  expect(bar?.querySelector('.window-brand-mark')).toBeNull();
  expect(bar).not.toContainElement(screen.queryByText('DesignHub'));
  expect(screen.queryByRole('button', { name: '切换工作区' })).not.toBeInTheDocument();
  expect(bar).toContainElement(
    screen.getByRole('button', { name: '切换主题' }),
  );
  expect(bar).toContainElement(
    screen.getByRole('button', { name: 'Switch to English' }),
  );
  expect(screen.queryByText('我的设计空间')).not.toBeInTheDocument();
});

it('keeps direct appearance controls and hosts the user menu beside them', () => {
  render(
    <WindowBar
      copy={getMessages('zh-CN')}
      locale="zh-CN"
      theme="system"
      nativeControlSide="left"
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      themeLabel="切换主题"
      userMenu={<button type="button">用户菜单</button>}
    />,
  );

  expect(screen.queryByRole('button', { name: '返回首页' })).toBeNull();
  expect(screen.getByRole('button', { name: '切换主题' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Switch to English' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '用户菜单' })).toBeInTheDocument();
});

it('does not expose workspace switching controls', () => {
  render(
    <WindowBar
      copy={getMessages('zh-CN')}
      locale="zh-CN"
      theme="system"
      nativeControlSide="left"
      onLocaleChange={() => undefined}
      onThemeChange={() => undefined}
      themeLabel="切换主题"
      workspace={{
        name: '工作区 A',
        detail: '本地工作区',
        label: '切换工作区',
        disabled: true,
        onClick: vi.fn(),
      }}
    />,
  );

  expect(screen.queryByRole('button', { name: '切换工作区' })).not.toBeInTheDocument();
});
