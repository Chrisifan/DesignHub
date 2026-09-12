import { expect, it, vi } from 'vitest';

import { exportProjectPackageHandler, projectPackageExportChannel } from './package';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('gates project package export on the active trusted workspace', async () => {
  expect(projectPackageExportChannel).toBe('project:package-export');
  const { window, event, trustedUrl } = createFixture();
  const workspace = { workspace: { workspaceId: 'workspace-1' } } as never;
  const exportPackage = vi.fn(async () => ({ path: '/tmp/project.designhub.zip', sha256: 'a'.repeat(64) }));
  await expect(exportProjectPackageHandler(window as never, trustedUrl, () => workspace, exportPackage)(event as never, { workspaceId: 'workspace-1', projectId: 'project-1' })).resolves.toMatchObject({ path: '/tmp/project.designhub.zip' });
  await expect(exportProjectPackageHandler(window as never, trustedUrl, () => workspace, exportPackage)(event as never, { workspaceId: 'other', projectId: 'project-1' })).resolves.toBeNull();
  expect(exportPackage).toHaveBeenCalledOnce();
});
