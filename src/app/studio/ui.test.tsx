import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { IconButton } from './ui';

it('keeps the base icon button appearance when a custom class is provided', () => {
  render(<IconButton name="copy" label="Copy" className="custom-control" />);

  expect(screen.getByRole('button', { name: 'Copy' })).toHaveClass('icon-button', 'custom-control');
});
