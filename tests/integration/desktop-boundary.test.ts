import { expect, it, vi } from 'vitest';

import { chooseDirectory, createWorkspaceHandler, isTrustedWorkspaceRequest } from '../../src/desktop/ipc/workspace';

it('rejects requests from an external frame or origin', () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => 'file:///app/index.html' } };
  const trusted = { sender: window.webContents, senderFrame: mainFrame };
  const external = { sender: window.webContents, senderFrame: { url: 'https://example.com' } };
  const malformed = { sender: window.webContents, senderFrame: { url: 'not a URL' } };

  expect(isTrustedWorkspaceRequest(trusted, window, 'file:///app/index.html')).toBe(true);
  expect(isTrustedWorkspaceRequest(external, window, 'file:///app/index.html')).toBe(false);
  expect(isTrustedWorkspaceRequest(malformed, window, 'file:///app/index.html')).toBe(false);
  expect(isTrustedWorkspaceRequest({ sender: window.webContents, senderFrame: mainFrame }, window, 'file:///app/other.html')).toBe(false);
  vi.restoreAllMocks();
});

it('does not reach the dialog adapter after the trusted frame navigates', async () => {
  const mainFrame = { url: 'file:///app/other.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const showOpenDialog = vi.fn(async () => ({ canceled: false, filePaths: ['/private/workspace'] }));
  const handler = createWorkspaceHandler(window, 'file:///app/index.html', showOpenDialog);

  await expect(handler({ sender: window.webContents, senderFrame: mainFrame })).resolves.toBeNull();
  expect(showOpenDialog).not.toHaveBeenCalled();
});

it('returns null after a directory dialog is cancelled without accepting renderer input', async () => {
  const showOpenDialog = vi.fn(async () => ({ canceled: true, filePaths: [] }));
  const directory = await chooseDirectory({} as never, showOpenDialog);

  expect(directory).toBeNull();
  expect(showOpenDialog).toHaveBeenCalledOnce();
  expect(showOpenDialog).toHaveBeenCalledWith({});
});
