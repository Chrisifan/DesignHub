import { expect, it, vi } from 'vitest';

import { createProjectLibraryLifecycleHandlers } from './project-library';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

const descriptor = {
  libraryId: '123e4567-e89b-42d3-a456-426614174000',
  directory: '/tmp/library',
  formatVersion: 1,
  openMode: 'writable' as const,
};

const createHandle = (library = descriptor) => ({ library, close: vi.fn() });

it('reports unselected without consulting legacy workspace preferences', async () => {
  const { window, event, trustedUrl } = createFixture();
  const loadDirectory = vi.fn(async () => null);
  const open = vi.fn();
  const handlers = createProjectLibraryLifecycleHandlers({
    window: window as never, trustedUrl, loadDirectory, saveDirectory: vi.fn(),
    showDirectoryDialog: vi.fn(), open, initialize: vi.fn(),
    getActiveHandle: () => null, activate: vi.fn(),
  });
  await expect(handlers.getStatus(event as never)).resolves.toEqual({ state: 'unselected' });
  expect(loadDirectory).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalled();
});

it('opens only the configured directory and reports a missing location for ENOENT', async () => {
  const { window, event, trustedUrl } = createFixture();
  const open = vi.fn(async () => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); });
  const handlers = createProjectLibraryLifecycleHandlers({
    window: window as never, trustedUrl, loadDirectory: async () => '/tmp/configured-library',
    saveDirectory: vi.fn(), showDirectoryDialog: vi.fn(), open, initialize: vi.fn(),
    getActiveHandle: () => null, activate: vi.fn(),
  });
  await expect(handlers.getStatus(event as never)).resolves.toEqual({
    state: 'needs-location', directory: '/tmp/configured-library', reason: 'missing',
  });
  expect(open).toHaveBeenCalledWith('/tmp/configured-library');
});

it('initializes a chosen empty directory and persists only after opening succeeds', async () => {
  const { window, event, trustedUrl } = createFixture();
  const handle = createHandle({ ...descriptor, directory: '/tmp/new-library' });
  const saveDirectory = vi.fn(async () => undefined);
  const activate = vi.fn();
  const handlers = createProjectLibraryLifecycleHandlers({
    window: window as never, trustedUrl, loadDirectory: async () => null, saveDirectory,
    showDirectoryDialog: async () => ({ canceled: false, filePaths: ['/tmp/new-library'] }),
    open: async () => { throw new Error('NOT_A_PROJECT_LIBRARY'); },
    initialize: vi.fn(async () => handle), getActiveHandle: () => null, activate,
  });
  await expect(handlers.choose(event as never)).resolves.toEqual(handle.library);
  expect(saveDirectory).toHaveBeenCalledWith('/tmp/new-library');
  expect(activate).toHaveBeenCalledWith(handle);
});

it('reopens an existing library, while cancel leaves settings and active handle untouched', async () => {
  const { window, event, trustedUrl } = createFixture();
  const existing = createHandle();
  const saveDirectory = vi.fn(async () => undefined);
  const open = vi.fn(async () => existing);
  const activate = vi.fn();
  const handlers = createProjectLibraryLifecycleHandlers({
    window: window as never, trustedUrl, loadDirectory: async () => null, saveDirectory,
    showDirectoryDialog: vi.fn()
      .mockResolvedValueOnce({ canceled: false, filePaths: ['/tmp/library'] })
      .mockResolvedValueOnce({ canceled: true, filePaths: [] }),
    open, initialize: vi.fn(), getActiveHandle: () => null, activate,
  });
  await expect(handlers.choose(event as never)).resolves.toEqual(existing.library);
  await expect(handlers.choose(event as never)).resolves.toBeNull();
  expect(open).toHaveBeenCalledWith('/tmp/library');
  expect(saveDirectory).toHaveBeenCalledOnce();
  expect(activate).toHaveBeenCalledOnce();
});

it('does not activate or persist an unknown non-empty directory', async () => {
  const { window, event, trustedUrl } = createFixture();
  const saveDirectory = vi.fn(async () => undefined);
  const activate = vi.fn();
  const handlers = createProjectLibraryLifecycleHandlers({
    window: window as never, trustedUrl, loadDirectory: async () => null, saveDirectory,
    showDirectoryDialog: async () => ({ canceled: false, filePaths: ['/tmp/legacy-workspace'] }),
    open: async () => { throw new Error('NOT_A_PROJECT_LIBRARY'); },
    initialize: async () => { throw new Error('PROJECT_LIBRARY_DIRECTORY_NOT_EMPTY'); },
    getActiveHandle: () => null, activate,
  });
  await expect(handlers.choose(event as never)).rejects.toThrow('PROJECT_LIBRARY_DIRECTORY_NOT_EMPTY');
  expect(saveDirectory).not.toHaveBeenCalled();
  expect(activate).not.toHaveBeenCalled();
});

it('requires a trusted main frame for both lifecycle operations', async () => {
  const { window, event, trustedUrl } = createFixture();
  const open = vi.fn();
  const showDirectoryDialog = vi.fn();
  const handlers = createProjectLibraryLifecycleHandlers({
    window: window as never, trustedUrl, loadDirectory: async () => null, saveDirectory: vi.fn(),
    showDirectoryDialog, open, initialize: vi.fn(), getActiveHandle: () => null, activate: vi.fn(),
  });
  const untrusted = { ...event, senderFrame: { url: 'file:///app/evil.html' } };
  await expect(handlers.getStatus(untrusted as never)).resolves.toBeNull();
  await expect(handlers.choose(untrusted as never)).resolves.toBeNull();
  expect(open).not.toHaveBeenCalled();
  expect(showDirectoryDialog).not.toHaveBeenCalled();
});
