import { expect, it, vi } from 'vitest';

import { openWorkspaceForActivation, recreateWindowOnActivate } from './lifecycle';

it('recreates a window on macOS activation only after all windows are closed', () => {
  const createWindow = vi.fn();

  recreateWindowOnActivate(() => false, createWindow);
  recreateWindowOnActivate(() => true, createWindow);

  expect(createWindow).toHaveBeenCalledOnce();
});

it('reuses the active workspace when a renderer reload restores the same directory', async () => {
  const close = vi.fn();
  const activeWorkspace = {
    workspace: {
      workspaceId: 'workspace-1',
      name: 'Local',
      directory: '/workspaces/local',
      formatVersion: 1,
      openMode: 'writable' as const,
    },
    close,
  };
  const openWorkspace = vi.fn(async () => ({
    workspace: { ...activeWorkspace.workspace, openMode: 'read-only' as const },
    close: vi.fn(),
  }));
  const activateWorkspace = vi.fn((workspace) => workspace);

  const result = await openWorkspaceForActivation(
    '/workspaces/local',
    activeWorkspace,
    async (directory) => directory,
    openWorkspace,
    activateWorkspace,
  );

  expect(result).toBe(activeWorkspace);
  expect(openWorkspace).not.toHaveBeenCalled();
  expect(activateWorkspace).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
