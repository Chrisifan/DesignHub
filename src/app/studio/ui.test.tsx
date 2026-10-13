import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Field, IconButton, Modal } from './ui';

it('keeps the base icon button appearance when a custom class is provided', () => {
  render(<IconButton name="copy" label="Copy" className="custom-control" />);

  expect(screen.getByRole('button', { name: 'Copy' })).toHaveClass('icon-button', 'custom-control');
});

it('keeps modal content and actions inside the dedicated scroll surface', () => {
  render(
    <Modal title="Tool" locale="en" onClose={vi.fn()} footer={<div className="dialog-actions"><button type="button">Run</button></div>}>
      <div data-testid="long-content">Content</div>
    </Modal>,
  );

  const dialog = screen.getByRole('dialog');
  const content = dialog.querySelector('.dialog-content');
  expect(dialog).toHaveClass('ui-dialog');
  expect(content).toContainElement(screen.getByTestId('long-content'));
  expect(content?.querySelector('.dialog-actions')).not.toBeInTheDocument();
  expect(dialog.querySelector('.dialog-footer .dialog-actions')).toBeInTheDocument();
  expect(dialog.querySelector('.dialog-heading')).toBeInTheDocument();
});

it('renders required markers and help triggers for reusable fields', () => {
  render(<Field label="Width" required help="Target width" helpLabel="Show width help"><input aria-label="Width" /></Field>);

  expect(screen.getByText('Width').closest('.ui-field')).toHaveAttribute('data-required', 'true');
  expect(screen.getByRole('img', { name: 'Show width help' })).toBeInTheDocument();
});
