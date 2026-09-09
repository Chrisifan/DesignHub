import { expect, it, vi } from 'vitest';

import { recreateWindowOnActivate } from './lifecycle';

it('recreates a window on macOS activation only after all windows are closed', () => {
  const createWindow = vi.fn();

  recreateWindowOnActivate(() => false, createWindow);
  recreateWindowOnActivate(() => true, createWindow);

  expect(createWindow).toHaveBeenCalledOnce();
});
