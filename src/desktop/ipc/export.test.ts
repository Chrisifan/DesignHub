import { expect, it, vi } from 'vitest';

import { exportDocumentHandler } from './export';

const makeFixture = (url: string) => {
  const mainFrame = { url };
  const webContents = { mainFrame, getURL: () => url };
  return { event: { sender: webContents, senderFrame: mainFrame }, window: { webContents } };
};

it('exports only from the active trusted workspace and returns the selected path', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  const exportScene = vi.fn(async () => ({ path: '/tmp/poster.png', sha256: 'abc' }));
  const handler = exportDocumentHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, exportScene);
  await expect(handler(fixture.event, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', format: 'png', scene: { id: 'scene-1' }, archiveCopy: true })).resolves.toEqual({ path: '/tmp/poster.png', sha256: 'abc' });
  expect(exportScene).toHaveBeenCalledWith(workspace, expect.objectContaining({ projectId: 'project-1', documentId: 'doc-1', format: 'png' }));
  expect(exportScene).toHaveBeenCalledWith(workspace, expect.objectContaining({ archiveCopy: true }));
  await expect(handler(fixture.event, { workspaceId: 'workspace-2', projectId: 'project-1', documentId: 'doc-1', format: 'png', scene: { id: 'scene-1' } })).resolves.toBeNull();
});
