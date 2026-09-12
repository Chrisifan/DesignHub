import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ToolInspector } from './ToolInspector';

it('renders tool controls from explicit definitions', () => {
  render(<ToolInspector tool="resize" params={{ width: 100, height: 100 }} onToolChange={() => undefined} onParamsChange={() => undefined} />);
  expect(screen.getByLabelText(/width/i)).toBeTruthy();
  expect(screen.getByLabelText(/height/i)).toBeTruthy();
});
