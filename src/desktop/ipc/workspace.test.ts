import { expect, it, vi } from 'vitest';

import {
  createWorkspaceFromParentHandler,
  isTrustedWorkspaceRequest,
  openWorkspaceHandler,
} from './workspace';
import { createProjectContainerHandler, listActiveProjectsHandler } from './projects';

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

it('lists and creates projects only for the active trusted workspace', async () => {
  const { window, event, trustedUrl } = createFixture();
  const workspace = { workspace: { workspaceId: 'workspace-1' } } as never;
  const listProjects = vi.fn(async () => [{ projectId: 'project-1', name: 'A project' }]);
  await expect(listActiveProjectsHandler(window as never, trustedUrl, () => workspace, listProjects)(event as never, 'workspace-1')).resolves.toEqual([
    { projectId: 'project-1', name: 'A project' },
  ]);
  const createProject = vi.fn(async (_workspace, input) => ({ projectId: `created-${input.name}` }));
  await expect(createProjectContainerHandler(window as never, trustedUrl, () => workspace, createProject)(event as never, {
    workspaceId: 'workspace-1',
    operationId: 'op-1',
    name: 'New project',
  })).resolves.toEqual({ projectId: 'created-New project' });
  expect(createProject).toHaveBeenCalledOnce();
  await expect(listActiveProjectsHandler(window as never, trustedUrl, () => workspace, listProjects)(event as never, 'other')).resolves.toBeNull();
});
