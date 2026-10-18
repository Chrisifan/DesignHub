import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ToolInspector } from './ToolInspector';

it('renders tool controls from explicit definitions', () => {
  render(<ToolInspector tool="resize" params={{ width: 100, height: 100 }} onToolChange={() => undefined} onParamsChange={() => undefined} />);
  expect(screen.getByRole('spinbutton', { name: /width/i })).toBeTruthy();
  expect(screen.getByRole('spinbutton', { name: /height/i })).toBeTruthy();
});

it('shows a mask editor for regional tools and forwards an applied region', () => {
  const onApply = vi.fn();
  render(<ToolInspector tool="remove-object" params={{}} image={{ width: 100, height: 100 }} onApplyRegion={onApply} onToolChange={() => undefined} onParamsChange={() => undefined} />);
  expect(screen.getByRole('form', { name: /mask editor/i })).toBeTruthy();
  const x = screen.getByLabelText(/x/i);
  expect(x).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: /apply mask/i }));
  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ width: 20, height: 20 }));
});

it('localizes enum values in the parameter controls', () => {
  render(<ToolInspector
    tool="replace-background"
    locale="zh-CN"
    params={{ source: 'description', lighting: 'match-original' }}
    onToolChange={() => undefined}
    onParamsChange={() => undefined}
  />);

  expect(screen.getByLabelText('背景来源')).toHaveAttribute('aria-valuetext', '描述');
  expect(screen.getByLabelText('光线')).toHaveAttribute('aria-valuetext', '匹配原图');
  expect(screen.queryByText('description')).not.toBeInTheDocument();
  expect(screen.queryByText('match-original')).not.toBeInTheDocument();
});

it('localizes expansion and crop modes', () => {
  const { unmount } = render(<ToolInspector
    tool="expand"
    locale="zh-CN"
    params={{ mode: 'original-scene', top: 0, right: 0, bottom: 0, left: 0 }}
    onToolChange={() => undefined}
    onParamsChange={() => undefined}
  />);
  expect(screen.getByLabelText('模式')).toHaveAttribute('aria-valuetext', '保持原场景');
  unmount();

  render(<ToolInspector
    tool="smart-crop"
    locale="zh-CN"
    params={{ width: 100, height: 100, focus: 'subject' }}
    onToolChange={() => undefined}
    onParamsChange={() => undefined}
  />);
  expect(screen.getByLabelText('焦点')).toHaveAttribute('aria-valuetext', '主体');
});

it('marks parameter and mask sections so regional controls can keep a stable layout', () => {
  const { container } = render(<ToolInspector
    tool="remove-object"
    locale="zh-CN"
    params={{ feather: 10 }}
    image={{ width: 100, height: 100 }}
    onToolChange={() => undefined}
    onParamsChange={() => undefined}
  />);

  expect(container.querySelector('.tool-inspector')).toBeInTheDocument();
  expect(container.querySelector('.tool-inspector__fields')).toBeInTheDocument();
  expect(container.querySelector('.canvas-mask-editor')).toHaveClass('tool-inspector__mask-editor');
});

it('marks required parameters and exposes localized help tooltips', () => {
  render(<ToolInspector
    tool="smart-crop"
    locale="zh-CN"
    params={{ width: 100, height: 100, focus: 'subject' }}
    onToolChange={() => undefined}
    onParamsChange={() => undefined}
  />);

  expect(screen.getByLabelText('宽度').closest('.ui-field')).toHaveAttribute('data-required', 'true');
  expect(screen.getByLabelText('高度').closest('.ui-field')).toHaveAttribute('data-required', 'true');
  const help = screen.getByRole('img', { name: '查看宽度帮助' });
  fireEvent.mouseEnter(help);
  expect(document.querySelector('[role="tooltip"]')).toHaveTextContent('输出图片的目标宽度。');
});

it('can render its fields without putting actions into the scrollable content', () => {
  const { container } = render(<ToolInspector
    tool="resize"
    params={{ width: 100, height: 100 }}
    hideActions
    onToolChange={() => undefined}
    onParamsChange={() => undefined}
  />);

  expect(container.querySelector('.tool-inspector .dialog-actions')).not.toBeInTheDocument();
});
