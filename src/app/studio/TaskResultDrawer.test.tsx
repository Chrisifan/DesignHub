import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import type { TaskRecord } from '../../features/tasks/state';
import { TaskResultDrawer } from './TaskResultDrawer';

const resultTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'design-task-1',
  requestId: 'request-1',
  state: 'completed',
  cancelRequested: false,
  attempt: 1,
  source: { kind: 'project', id: 'project-1' },
  capability: 'design-generation',
  generationSlots: [
    { id: 'primary', direction: 'primary', state: 'completed', attempt: 1, assetId: 'asset-primary', candidateId: 'candidate-primary' },
  ],
  result: {
    candidates: [{
      id: 'candidate-primary',
      baseRevisionId: null,
      assetIds: ['asset-primary'],
      createdAt: '2026-10-13T06:30:00.000Z',
    }],
  },
  ...overrides,
});

it('loads a completed candidate preview from the managed project asset', async () => {
  const readAsset = vi.fn(async () => new Uint8Array([137, 80, 78, 71]));
  window.designhub = { readAsset };

  render(<TaskResultDrawer
    locale="zh-CN"
    libraryId="workspace-1"
    task={resultTask()}
    onClose={() => undefined}
    onRetrySlot={() => undefined}
  />);

  const drawer = screen.getByRole('dialog', { name: '任务结果' });
  expect(within(drawer).getByText('主方案')).toBeInTheDocument();
  expect(within(drawer).getByText('已完成')).toBeInTheDocument();
  expect(await within(drawer).findByRole('img', { name: '生成候选稿' })).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/));
  expect(readAsset).toHaveBeenCalledWith({ libraryId: 'workspace-1', projectId: 'project-1', assetId: 'asset-primary' });
});

it('keeps unavailable previews and active generation states inside stable result cards', async () => {
  const readAsset = vi.fn(async () => { throw new Error('read failed'); });
  window.designhub = { readAsset };
  const task = resultTask({
    state: 'running',
    generationSlots: [
      { id: 'primary', direction: 'primary', state: 'completed', attempt: 1, assetId: 'asset-primary', candidateId: 'candidate-primary' },
      { id: 'composition', direction: 'composition', state: 'running', attempt: 1 },
      { id: 'expressive', direction: 'expressive', state: 'failed', attempt: 1, errorCode: 'PROVIDER_REQUEST_FAILED' },
    ],
  });

  render(<TaskResultDrawer
    locale="zh-CN"
    libraryId="workspace-1"
    task={task}
    onClose={() => undefined}
    onRetrySlot={() => undefined}
  />);

  await waitFor(() => expect(screen.getByText('预览不可用')).toBeInTheDocument());
  expect(screen.getByText('处理中')).toBeInTheDocument();
  expect(screen.getByText('失败')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重试视觉突破' })).not.toBeInTheDocument();
});

it('retries failed and cancelled slots only after the generation batch settles', () => {
  const onRetrySlot = vi.fn();
  const task = resultTask({
    state: 'failed',
    generationSlots: [
      { id: 'primary', direction: 'primary', state: 'completed', attempt: 1, assetId: 'asset-primary', candidateId: 'candidate-primary' },
      { id: 'composition', direction: 'composition', state: 'failed', attempt: 1, errorCode: 'PROVIDER_REQUEST_FAILED' },
      { id: 'expressive', direction: 'expressive', state: 'cancelled', attempt: 1 },
    ],
  });
  window.designhub = { readAsset: vi.fn(async () => null) };

  render(<TaskResultDrawer
    locale="zh-CN"
    libraryId="workspace-1"
    task={task}
    onClose={() => undefined}
    onRetrySlot={onRetrySlot}
  />);

  fireEvent.click(screen.getByRole('button', { name: '重试构图探索' }));
  fireEvent.click(screen.getByRole('button', { name: '重试视觉突破' }));
  expect(onRetrySlot).toHaveBeenNthCalledWith(1, 'design-task-1', 'composition');
  expect(onRetrySlot).toHaveBeenNthCalledWith(2, 'design-task-1', 'expressive');
});

it('closes the result drawer through its close control', () => {
  const onClose = vi.fn();
  window.designhub = { readAsset: vi.fn(async () => null) };
  render(<TaskResultDrawer
    locale="zh-CN"
    libraryId="workspace-1"
    task={resultTask()}
    onClose={onClose}
    onRetrySlot={() => undefined}
  />);

  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(onClose).toHaveBeenCalledOnce();
});
