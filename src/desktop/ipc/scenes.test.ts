import { expect, it, vi } from 'vitest';

import { createScene } from '../../features/canvas/scene';
import { sceneLoadChannel, sceneSaveChannel, loadDocumentSceneHandler, saveDocumentSceneHandler } from './scenes';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

const scene = createScene({ id: 'scene-1', width: 1080, height: 1440, layers: [] });

it('loads and saves a scene only for the active trusted workspace and exact document target', async () => {
  const { window, event, trustedUrl } = createFixture();
  const workspace = { workspace: { workspaceId: 'workspace-1' } } as never;
  const load = vi.fn(async () => scene);
  const save = vi.fn(async () => true);

  await expect(loadDocumentSceneHandler(window as never, trustedUrl, () => workspace, load)(event as never, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1' })).resolves.toEqual(scene);
  await expect(saveDocumentSceneHandler(window as never, trustedUrl, () => workspace, save)(event as never, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', scene })).resolves.toBe(true);
  expect(load).toHaveBeenCalledWith(workspace, 'project-1', 'doc-1');
  expect(save).toHaveBeenCalledWith(workspace, 'project-1', 'doc-1', scene);
  await expect(loadDocumentSceneHandler(window as never, trustedUrl, () => workspace, load)(event as never, { workspaceId: 'other', projectId: 'project-1', documentId: 'doc-1' })).resolves.toBeNull();
  await expect(saveDocumentSceneHandler(window as never, trustedUrl, () => workspace, save)(event as never, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: '../escape', scene })).resolves.toBe(false);
});

it('does not expose scene channels to an untrusted renderer frame', async () => {
  const { window, event, trustedUrl } = createFixture();
  const load = vi.fn(async () => scene);
  const untrustedEvent = { ...event, senderFrame: { url: 'file:///app/evil.html' } };

  await expect(loadDocumentSceneHandler(window as never, trustedUrl, () => ({ workspace: { workspaceId: 'workspace-1' } }) as never, load)(untrustedEvent as never, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1' })).resolves.toBeNull();
  expect(load).not.toHaveBeenCalled();
  expect(sceneLoadChannel).toBe('scene:load-document');
  expect(sceneSaveChannel).toBe('scene:save-document');
});
