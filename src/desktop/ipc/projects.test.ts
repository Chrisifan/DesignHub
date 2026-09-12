import { expect, it, vi } from 'vitest';

import {
  listTrashedProjectsHandler,
  duplicateProjectHandler,
  moveProjectToTrashHandler,
  purgeProjectFromTrashHandler,
  projectListTrashChannel,
  projectDuplicateChannel,
  projectPurgeTrashChannel,
  projectRestoreTrashChannel,
  projectTrashChannel,
  restoreProjectFromTrashHandler,
} from './projects';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('exposes trusted trash list, move, restore and purge channels', async () => {
  expect(projectListTrashChannel).toBe('project:list-trash');
  expect(projectTrashChannel).toBe('project:trash');
  expect(projectRestoreTrashChannel).toBe('project:restore-trash');
  expect(projectPurgeTrashChannel).toBe('project:purge-trash');
  const { window, event, trustedUrl } = createFixture();
  const workspace = { workspace: { workspaceId: 'workspace-1' } } as never;
  const list = vi.fn(async () => [{ projectId: 'project-1', originalRelativePath: 'projects/project-1', deletedAt: '2026-09-12T00:00:00.000Z' }]);
  const move = vi.fn(async () => ({ projectId: 'project-1', originalRelativePath: 'projects/project-1', deletedAt: '2026-09-12T00:00:00.000Z' }));
  const restore = vi.fn(async () => ({ projectId: 'project-1', restoredRelativePath: 'projects/project-1' }));
  const purge = vi.fn(async () => undefined);

  await expect(listTrashedProjectsHandler(window as never, trustedUrl, () => workspace, list)(event as never, 'workspace-1')).resolves.toHaveLength(1);
  await expect(moveProjectToTrashHandler(window as never, trustedUrl, () => workspace, move)(event as never, { workspaceId: 'workspace-1', projectId: 'project-1' })).resolves.toMatchObject({ projectId: 'project-1' });
  await expect(restoreProjectFromTrashHandler(window as never, trustedUrl, () => workspace, restore)(event as never, { workspaceId: 'workspace-1', projectId: 'project-1' })).resolves.toMatchObject({ projectId: 'project-1' });
  await expect(purgeProjectFromTrashHandler(window as never, trustedUrl, () => workspace, purge)(event as never, { workspaceId: 'workspace-1', projectId: 'project-1' })).resolves.toBe(true);
  expect(list).toHaveBeenCalledOnce();
  expect(move).toHaveBeenCalledOnce();
  expect(restore).toHaveBeenCalledOnce();
  expect(purge).toHaveBeenCalledOnce();
});

it('gates project duplication on the active trusted workspace', async () => {
  expect(projectDuplicateChannel).toBe('project:duplicate');
  const { window, event, trustedUrl } = createFixture();
  const workspace = { workspace: { workspaceId: 'workspace-1' } } as never;
  const duplicate = vi.fn(async () => ({ projectId: 'project-copy' }));
  await expect(duplicateProjectHandler(window as never, trustedUrl, () => workspace, duplicate)(event as never, {
    workspaceId: 'workspace-1', sourceProjectId: 'project-1', operationId: 'copy-1', name: 'Copy',
  })).resolves.toEqual({ projectId: 'project-copy' });
  await expect(duplicateProjectHandler(window as never, trustedUrl, () => workspace, duplicate)(event as never, {
    workspaceId: 'workspace-1', sourceProjectId: 'project-1', operationId: '',
  })).resolves.toBeNull();
  expect(duplicate).toHaveBeenCalledOnce();
});

it('rejects malformed or untrusted trash requests before storage', async () => {
  const { window, event, trustedUrl } = createFixture();
  const workspace = { workspace: { workspaceId: 'workspace-1' } } as never;
  const list = vi.fn(async () => []);
  const move = vi.fn(async () => ({ projectId: 'project-1', originalRelativePath: 'projects/project-1', deletedAt: '2026-09-12T00:00:00.000Z' }));
  const untrustedEvent = { ...event, senderFrame: { url: 'file:///app/evil.html' } };

  await expect(listTrashedProjectsHandler(window as never, trustedUrl, () => workspace, list)(event as never, '')).resolves.toBeNull();
  await expect(moveProjectToTrashHandler(window as never, trustedUrl, () => workspace, move)(event as never, { workspaceId: 'workspace-1', projectId: '' })).resolves.toBeNull();
  await expect(moveProjectToTrashHandler(window as never, trustedUrl, () => workspace, move)(untrustedEvent as never, { workspaceId: 'workspace-1', projectId: 'project-1' })).resolves.toBeNull();
  expect(list).not.toHaveBeenCalled();
  expect(move).not.toHaveBeenCalled();
});
