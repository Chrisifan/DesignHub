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

it('restores focus to the trigger after close', () => {
  const { rerender } = render(<button>春间标志</button>);
  const trigger = screen.getByRole('button', { name: '春间标志' });
  trigger.focus();

  rerender(<><button>春间标志</button><Drawer open title="素材详情" onClose={vi.fn()}><p>内容</p></Drawer></>);
  rerender(<><button>春间标志</button><Drawer open={false} title="素材详情" onClose={vi.fn()}><p>内容</p></Drawer></>);

  expect(screen.getByRole('button', { name: '春间标志' })).toHaveFocus();
});
