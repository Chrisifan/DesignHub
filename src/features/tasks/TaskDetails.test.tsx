import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TaskDetails } from './TaskDetails';

it('shows image result count and known cost without exposing provider secrets', () => {
  render(<TaskDetails task={{ id: 'task-1', requestId: 'request-1', state: 'completed', cancelRequested: false, attempt: 1, capability: 'image-generation', result: { imageCount: 2, cost: 0.04 } }} />);
  expect(screen.getByText('2 images')).toBeInTheDocument();
  expect(screen.getByText('$0.04')).toBeInTheDocument();
  expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
});
