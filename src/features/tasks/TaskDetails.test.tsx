import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TaskDetails } from './TaskDetails';

it('shows image result count and known cost without exposing provider secrets', () => {
  render(<TaskDetails task={{ id: 'task-1', requestId: 'request-1', state: 'completed', cancelRequested: false, attempt: 1, capability: 'image-generation', result: { imageCount: 2, cost: 0.04 } }} />);
  expect(screen.getByText('2 images')).toBeInTheDocument();
  expect(screen.getByText('$0.04')).toBeInTheDocument();
  expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
});

it('exposes candidate review actions for completed image tasks', () => {
  const onView = vi.fn();
  const onCompare = vi.fn();
  const onContinue = vi.fn();
  const onFinalize = vi.fn();
  render(<TaskDetails task={{ id: 'task-1', requestId: 'request-1', state: 'completed', cancelRequested: false, attempt: 1, capability: 'image-generation', result: { imageCount: 1, candidate: { id: 'candidate-1', baseRevisionId: null, assetIds: ['asset-1'], createdAt: '2026-09-13T00:00:00.000Z' } } }} onViewCandidate={onView} onCompareCandidate={onCompare} onContinueCandidate={onContinue} onFinalizeCandidate={onFinalize} />);
  screen.getByRole('button', { name: 'View' }).click();
  screen.getByRole('button', { name: 'Compare' }).click();
  screen.getByRole('button', { name: 'Continue' }).click();
  screen.getByRole('button', { name: 'Finalize' }).click();
  expect(onView).toHaveBeenCalledWith('candidate-1');
  expect(onCompare).toHaveBeenCalledWith('candidate-1');
  expect(onContinue).toHaveBeenCalledWith('candidate-1');
  expect(onFinalize).toHaveBeenCalledWith('candidate-1');
});
