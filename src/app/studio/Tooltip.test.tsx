import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { Tooltip } from './Tooltip';

it('shows complete content on hover without a native title', () => {
  render(<Tooltip content="完整规则">省略规则</Tooltip>);
  const trigger = screen.getByText('省略规则');

  expect(trigger).not.toHaveAttribute('title');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

  fireEvent.mouseEnter(trigger);
  const tooltip = screen.getByRole('tooltip', { hidden: true });
  expect(tooltip).toHaveTextContent('完整规则');
  expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);

  fireEvent.mouseLeave(trigger);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('supports keyboard focus and Escape dismissal', () => {
  render(<Tooltip content="完整规则">省略规则</Tooltip>);
  const trigger = screen.getByText('省略规则');

  fireEvent.focus(trigger);
  expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('完整规则');

  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

  fireEvent.focus(trigger);
  fireEvent.blur(trigger);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
