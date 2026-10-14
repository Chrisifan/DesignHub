import { expect, it, vi } from 'vitest';

import { focusExistingWindow, openProjectLibraryForActivation, recreateWindowOnActivate } from './lifecycle';
import type { ProjectLibraryHandle } from '../features/project-library/open-project-library';

it('recreates a window on macOS activation only after all windows are closed', () => {
  const createWindow = vi.fn();

  recreateWindowOnActivate(() => false, createWindow);
  recreateWindowOnActivate(() => true, createWindow);

  expect(createWindow).toHaveBeenCalledOnce();
});

it('restores and focuses the existing window when another app instance starts', () => {
  const window = {
    isMinimized: vi.fn(() => true),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  };

  focusExistingWindow(window);

  expect(window.restore).toHaveBeenCalledOnce();
  expect(window.show).toHaveBeenCalledOnce();
  expect(window.focus).toHaveBeenCalledOnce();
});

it('does not restore a visible existing window before focusing it', () => {
  const window = {
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  };

  focusExistingWindow(window);

  expect(window.restore).not.toHaveBeenCalled();
  expect(window.show).toHaveBeenCalledOnce();
  expect(window.focus).toHaveBeenCalledOnce();
});

it('reuses the active project library when a renderer reload restores the same directory', async () => {
  const close = vi.fn();
  const activeLibrary: ProjectLibraryHandle = {
    library: {
      libraryId: 'workspace-1',
      name: 'Local',
      directory: '/workspaces/local',
      formatVersion: 1,
      openMode: 'writable' as const,
    },
    close,
  };
  const openLibrary = vi.fn(async () => ({
    library: { ...activeLibrary.library, openMode: 'read-only' as const },
    close: vi.fn(),
  }));
  const activateLibrary = vi.fn((library: ProjectLibraryHandle) => library);

  const result = await openProjectLibraryForActivation(
    '/workspaces/local',
    activeLibrary,
    async (directory) => directory,
    openLibrary,
    activateLibrary,
  );

  expect(result).toBe(activeLibrary);
  expect(openLibrary).not.toHaveBeenCalled();
  expect(activateLibrary).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
