import { expect, it, vi } from 'vitest';

import { importProjectPackageHandler, projectPackageImportChannel } from './package';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('gates package import on a trusted writable workspace and forwards archive path', async () => {
  expect(projectPackageImportChannel).toBe('project:package-import');
  const { window, event, trustedUrl } = createFixture();
  const workspace = { library: { libraryId: 'workspace-1', openMode: 'writable' } } as never;
  const importPackage = vi.fn(async () => ({ projectId: 'project-imported' }));
  await expect(importProjectPackageHandler(window as never, trustedUrl, () => workspace, importPackage)(event as never, { libraryId: 'workspace-1' })).resolves.toEqual({ projectId: 'project-imported' });
  await expect(importProjectPackageHandler(window as never, trustedUrl, () => workspace, importPackage)(event as never, { libraryId: 'workspace-1' })).resolves.toEqual({ projectId: 'project-imported' });
  expect(importPackage).toHaveBeenCalledTimes(2);
  await expect(importProjectPackageHandler(window as never, trustedUrl, () => ({ library: { libraryId: 'workspace-1', openMode: 'read-only' } } as never), importPackage)(event as never, { libraryId: 'workspace-1' })).resolves.toBeNull();
});
