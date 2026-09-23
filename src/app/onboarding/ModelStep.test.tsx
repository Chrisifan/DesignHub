import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ModelStep } from './ModelStep';

it('allows the model step to be skipped without touching provider credentials', async () => {
  const onSkip = vi.fn(async () => undefined);
  const onComplete = vi.fn(async () => undefined);
  render(<ModelStep locale="zh-CN" onComplete={onComplete} onSkip={onSkip} />);

  fireEvent.click(screen.getByRole('button', { name: '跳过，稍后设置' }));

  await waitFor(() => expect(onSkip).toHaveBeenCalledOnce());
  expect(onComplete).not.toHaveBeenCalled();
});

it('completes after the user chooses to enter the home page', async () => {
  const onComplete = vi.fn(async () => undefined);
  render(<ModelStep locale="zh-CN" onComplete={onComplete} onSkip={vi.fn(async () => undefined)} />);

  fireEvent.click(screen.getByRole('button', { name: '完成并进入首页' }));

  await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
});
