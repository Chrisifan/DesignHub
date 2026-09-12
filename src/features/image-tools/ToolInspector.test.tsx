import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ToolInspector } from './ToolInspector';

it('renders tool controls from explicit definitions', () => {
  render(<ToolInspector tool="resize" params={{ width: 100, height: 100 }} onToolChange={() => undefined} onParamsChange={() => undefined} />);
  expect(screen.getByLabelText(/width/i)).toBeTruthy();
  expect(screen.getByLabelText(/height/i)).toBeTruthy();
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
