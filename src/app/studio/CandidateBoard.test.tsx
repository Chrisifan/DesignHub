import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { CandidateBoard } from './CandidateBoard';
import { createDesignGenerationSlots } from '../../features/tasks/state';

const task = {
  id: 'design-generation-1',
  requestId: 'request-1',
  state: 'completed' as const,
  cancelRequested: false,
  attempt: 1,
  capability: 'design-generation' as const,
  analysisThreadId: 'thread-1',
  source: { kind: 'project' as const, id: 'project-1' },
  documentId: 'document-1',
  result: {
    imageCount: 1,
    candidate: {
      id: 'candidate-1',
      baseRevisionId: null,
      assetIds: ['asset-1'],
      sceneAssetId: 'asset-1',
      createdAt: '2026-09-18T00:00:00.000Z',
    },
  },
};

it('allows a candidate card to move without selecting it as a click', () => {
  const onSelect = vi.fn();
  render(<CandidateBoard locale="zh-CN" tasks={[task]} projectId="project-1" analysisThreadId="thread-1" width={1080} height={1440} selectedCandidateId={null} onSelect={onSelect} />);
  const card = screen.getByRole('button', { name: '候选设计稿' });

  fireEvent.pointerDown(card, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(card, { pointerId: 1, clientX: 142, clientY: 128 });
  fireEvent.pointerUp(card, { pointerId: 1, clientX: 142, clientY: 128 });
  fireEvent.click(card);

  expect(card).toHaveStyle({ transform: 'translate(42px, 28px)' });
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(card);
  expect(onSelect).toHaveBeenCalledWith('candidate-1', 'asset-1');
});

it('requests focus for the latest completed draft when the board is restored', () => {
  const onRequestFocus = vi.fn();
  render(<CandidateBoard locale="zh-CN" tasks={[task]} projectId="project-1" analysisThreadId="thread-1" width={1080} height={1440} selectedCandidateId={null} onSelect={vi.fn()} onRequestFocus={onRequestFocus} />);

  const candidate = screen.getByRole('button', { name: '候选设计稿' });
  expect(onRequestFocus).toHaveBeenCalledOnce();
  expect(onRequestFocus).toHaveBeenCalledWith(candidate);
});

it('renders one proportionate placeholder per running generation and requests focus for the newest one', () => {
  const runningTask = {
    ...task,
    id: 'design-generation-2',
    requestId: 'request-2',
    state: 'running' as const,
    createdAt: '2026-09-18T00:01:00.000Z',
    result: undefined,
  };
  const queuedTask = {
    ...runningTask,
    id: 'design-generation-3',
    requestId: 'request-3',
    state: 'queued' as const,
    createdAt: '2026-09-18T00:02:00.000Z',
  };

  const onRequestFocus = vi.fn();
  render(<CandidateBoard locale="zh-CN" tasks={[task, runningTask, queuedTask]} projectId="project-1" analysisThreadId="thread-1" width={1080} height={1440} displayWidth={340} selectedCandidateId={null} onSelect={vi.fn()} onRequestFocus={onRequestFocus} />);

  const placeholders = screen.getAllByLabelText('正在生成设计稿');
  expect(placeholders).toHaveLength(2);
  expect(placeholders[0]).toHaveStyle({ aspectRatio: '1080 / 1440' });
  expect(placeholders[1]).toHaveStyle({ aspectRatio: '1080 / 1440' });
  expect(placeholders[1]).toHaveAttribute('data-task-id', 'design-generation-3');
  expect(placeholders[1].closest('.workbench-candidate-card')).toHaveStyle({ width: '340px', flexBasis: '340px' });
  expect(screen.getByRole('button', { name: '候选设计稿' })).toHaveStyle({ width: '340px', flexBasis: '340px' });
  expect(onRequestFocus).toHaveBeenCalledOnce();
  expect(onRequestFocus.mock.calls[0]?.[0]).toBe(placeholders[1].closest('.workbench-candidate-card'));
});

it('renders three stable batch slots and retries only a failed slot', () => {
  const generationSlots = createDesignGenerationSlots();
  const batch = {
    ...task,
    id: 'design-batch-1',
    requestId: 'request-batch-1',
    state: 'running' as const,
    result: undefined,
    generationSlots,
  };
  const onRetrySlot = vi.fn();
  const onRequestFocus = vi.fn();
  const view = render(<CandidateBoard locale="zh-CN" tasks={[batch]} projectId="project-1" analysisThreadId="thread-1" width={1080} height={1440} selectedCandidateId={null} onSelect={vi.fn()} onRetrySlot={onRetrySlot} onRequestFocus={onRequestFocus} />);

  expect(screen.getAllByLabelText('正在生成设计稿')).toHaveLength(3);
  const initialSlots = screen.getAllByTestId(/generation-slot-/u);
  expect(initialSlots.map((slot) => slot.getAttribute('data-testid'))).toEqual([
    'generation-slot-primary', 'generation-slot-composition', 'generation-slot-expressive',
  ]);
  expect(onRequestFocus).toHaveBeenCalledOnce();
  expect(onRequestFocus.mock.calls[0]?.[0]).toHaveAttribute('data-generation-batch-id', 'design-batch-1');

  const completedCandidate = {
    id: 'candidate-design-batch-1-primary',
    baseRevisionId: null,
    assetIds: ['asset-primary'],
    sceneAssetId: 'asset-primary',
    createdAt: '2026-09-20T00:00:00.000Z',
  };
  view.rerender(<CandidateBoard locale="zh-CN" tasks={[{
    ...batch,
    generationSlots: generationSlots.map((slot) => slot.id === 'primary'
      ? { ...slot, state: 'completed' as const, assetId: 'asset-primary', candidateId: completedCandidate.id }
      : slot.id === 'composition'
        ? { ...slot, state: 'failed' as const, errorCode: 'PROVIDER_REQUEST_FAILED' }
        : slot),
    result: { imageCount: 1, candidates: [completedCandidate] },
  }]} projectId="project-1" analysisThreadId="thread-1" width={1080} height={1440} selectedCandidateId={null} onSelect={vi.fn()} onRetrySlot={onRetrySlot} onRequestFocus={onRequestFocus} />);

  expect(screen.getByRole('button', { name: '主方案' })).toBeVisible();
  expect(screen.getAllByLabelText('正在生成设计稿')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: '重新生成构图探索' })).not.toBeInTheDocument();
  view.rerender(<CandidateBoard locale="zh-CN" tasks={[{
    ...batch,
    state: 'completed',
    generationSlots: generationSlots.map((slot) => slot.id === 'primary'
      ? { ...slot, state: 'completed' as const, assetId: 'asset-primary', candidateId: completedCandidate.id }
      : slot.id === 'composition'
        ? { ...slot, state: 'failed' as const, errorCode: 'PROVIDER_REQUEST_FAILED' }
        : { ...slot, state: 'failed' as const, errorCode: 'PROVIDER_REQUEST_FAILED' }),
    result: { imageCount: 1, candidates: [completedCandidate] },
  }]} projectId="project-1" analysisThreadId="thread-1" width={1080} height={1440} selectedCandidateId={null} onSelect={vi.fn()} onRetrySlot={onRetrySlot} onRequestFocus={onRequestFocus} />);
  fireEvent.click(screen.getByRole('button', { name: '重新生成构图探索' }));
  expect(onRetrySlot).toHaveBeenCalledWith('design-batch-1', 'composition');
  expect(onRequestFocus).toHaveBeenCalledOnce();
});
