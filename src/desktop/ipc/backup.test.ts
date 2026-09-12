import { expect, it, vi } from 'vitest';

import {
  backupCreateChannel,
  backupRestoreChannel,
  createBackupHandler,
  restoreBackupHandler,
} from './backup';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('keeps backup operations behind the trusted active workspace', async () => {
  expect(backupCreateChannel).toBe('workspace:backup-create');
  expect(backupRestoreChannel).toBe('workspace:backup-restore');
  const { window, event, trustedUrl } = createFixture();
  const workspace = { workspace: { workspaceId: 'workspace-1' } } as never;
  const createBackup = vi.fn(async () => ({ directory: '/tmp/backup', workspaceId: 'workspace-1', createdAt: '2026-09-12T00:00:00.000Z' }));
  const restoreBackup = vi.fn(async () => ({ directory: '/tmp/restored', workspaceId: 'workspace-1' }));

  await expect(createBackupHandler(window as never, trustedUrl, () => workspace, createBackup)(event as never, { workspaceId: 'workspace-1', destinationParentDirectory: '/tmp' })).resolves.toMatchObject({ directory: '/tmp/backup' });
  await expect(restoreBackupHandler(window as never, trustedUrl, restoreBackup)(event as never, { backupDirectory: '/tmp/backup', destinationParentDirectory: '/tmp' })).resolves.toMatchObject({ directory: '/tmp/restored' });
  expect(createBackup).toHaveBeenCalledOnce();
  expect(restoreBackup).toHaveBeenCalledOnce();
});

it('rejects backup paths and untrusted senders', async () => {
  const { window, event, trustedUrl } = createFixture();
  const workspace = { workspace: { workspaceId: 'workspace-1' } } as never;
  const createBackup = vi.fn(async () => ({ directory: '/tmp/backup', workspaceId: 'workspace-1', createdAt: '2026-09-12T00:00:00.000Z' }));
  const untrustedEvent = { ...event, senderFrame: { url: 'file:///app/evil.html' } };

  await expect(createBackupHandler(window as never, trustedUrl, () => workspace, createBackup)(event as never, { workspaceId: 'workspace-1', destinationParentDirectory: '' })).resolves.toBeNull();
  await expect(createBackupHandler(window as never, trustedUrl, () => workspace, createBackup)(untrustedEvent as never, { workspaceId: 'workspace-1', destinationParentDirectory: '/tmp' })).resolves.toBeNull();
  expect(createBackup).not.toHaveBeenCalled();
});
