import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { Drawer } from './Drawer';

it('closes a labelled drawer by button, backdrop, and Escape', () => {
  const onClose = vi.fn();
  render(<Drawer open title="素材详情" onClose={onClose}><p>内容</p></Drawer>);

  expect(screen.getByRole('dialog', { name: '素材详情' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByTestId('drawer-backdrop'));
  fireEvent.keyDown(document, { key: 'Escape' });

  expect(onClose).toHaveBeenCalledTimes(3);
});

it('mounts the open drawer inside the studio work-area host', () => {
  const { container } = render(
    <div data-drawer-host>
      <Drawer open title="连接配置" onClose={() => undefined}>
        <p>内容</p>
      </Drawer>
    </div>,
  );

  const host = container.firstElementChild;
  expect(host).toHaveAttribute('data-drawer-host');
  expect(host?.querySelector('.ui-drawer-root')).toBeInTheDocument();
  expect(document.body.querySelector(':scope > .ui-drawer-root')).not.toBeInTheDocument();
});

it('renders footer actions outside the independently scrolling content region', () => {
  render(
    <Drawer
      open
      title="连接配置"
      onClose={() => undefined}
      footer={<button type="button">保存配置</button>}
    >
      <p>长内容</p>
    </Drawer>,
  );

  const dialog = screen.getByRole('dialog', { name: '连接配置' });
  const footer = screen.getByRole('button', { name: '保存配置' }).closest('.ui-drawer__footer');
  expect(footer).toBeInTheDocument();
  expect(footer?.parentElement).toBe(dialog);
  expect(footer).not.toBe(dialog.querySelector('.ui-drawer__content'));
});

it('does not render an empty footer when no actions are provided', () => {
  render(<Drawer open title="素材详情" onClose={() => undefined}><p>内容</p></Drawer>);
  expect(screen.getByRole('dialog', { name: '素材详情' }).querySelector('.ui-drawer__footer')).not.toBeInTheDocument();
});

it('applies a content width class to the drawer panel', () => {
  render(<Drawer open title="作品集分析" className="ui-drawer--wide" onClose={() => undefined}><p>内容</p></Drawer>);
  expect(screen.getByRole('dialog', { name: '作品集分析' })).toHaveClass('ui-drawer--wide');
});

it('restores focus to the trigger after close', () => {
  const { rerender } = render(<button>春间标志</button>);
  const trigger = screen.getByRole('button', { name: '春间标志' });
  trigger.focus();

  rerender(<><button>春间标志</button><Drawer open title="素材详情" onClose={vi.fn()}><p>内容</p></Drawer></>);
  rerender(<><button>春间标志</button><Drawer open={false} title="素材详情" onClose={vi.fn()}><p>内容</p></Drawer></>);

  expect(screen.getByRole('button', { name: '春间标志' })).toHaveFocus();
});
