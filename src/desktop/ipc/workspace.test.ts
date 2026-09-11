import { expect, it, vi } from 'vitest';

import {
  createWorkspaceFromParentHandler,
  isTrustedWorkspaceRequest,
  openWorkspaceHandler,
} from './workspace';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('creates a workspace only for a trusted main frame', async () => {
  const { window, event, trustedUrl } = createFixture();
  const createWorkspace = vi.fn(async (input: { parentDirectory: string; name: string }) => ({
    workspaceId: 'workspace-1',
    name: input.name,
    directory: `${input.parentDirectory}/${input.name}`,
    formatVersion: 1,
    openMode: 'writable' as const,
  }));

  await expect(
    createWorkspaceFromParentHandler(window as never, trustedUrl, createWorkspace)(event as never, {
      parentDirectory: '/tmp',
      name: 'My workspace',
    }),
  ).resolves.toMatchObject({ workspaceId: 'workspace-1' });
  expect(createWorkspace).toHaveBeenCalledWith({ parentDirectory: '/tmp', name: 'My workspace' });

  const untrustedEvent = { ...event, senderFrame: { url: 'file:///app/evil.html' } };
  await expect(
    createWorkspaceFromParentHandler(window as never, trustedUrl, createWorkspace)(untrustedEvent as never, {
      parentDirectory: '/tmp',
      name: 'Nope',
    }),
  ).resolves.toBeNull();
  expect(createWorkspace).toHaveBeenCalledOnce();
});

it('opens a selected workspace through the same trusted-frame gate', async () => {
  const { window, event, trustedUrl } = createFixture();
  const openWorkspace = vi.fn(async (directory: string) => ({
    workspaceId: 'workspace-2',
    name: 'Opened workspace',
    directory,
    formatVersion: 1,
    openMode: 'read-only' as const,
  }));

  await expect(
    openWorkspaceHandler(window as never, trustedUrl, openWorkspace)(event as never, '/tmp/workspace'),
  ).resolves.toMatchObject({ workspaceId: 'workspace-2', openMode: 'read-only' });
  expect(openWorkspace).toHaveBeenCalledWith('/tmp/workspace');
  expect(isTrustedWorkspaceRequest(event as never, window as never, trustedUrl)).toBe(true);
});
