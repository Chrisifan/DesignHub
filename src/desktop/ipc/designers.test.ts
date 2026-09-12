import { expect, it, vi } from 'vitest';

import { designerLoadChannel, designerSaveChannel, loadDesignerStateHandler, saveDesignerStateHandler } from './designers';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('loads and saves designer state only for the active trusted workspace', async () => {
  const { window, event, trustedUrl } = createFixture();
  const workspace = { workspace: { workspaceId: 'workspace-1' } } as never;
  const state = { profiles: [], defaultId: 'builtin-v1' };
  const load = vi.fn(async () => state);
  const save = vi.fn(async () => true);

  await expect(loadDesignerStateHandler(window as never, trustedUrl, () => workspace, load)(event as never, 'workspace-1')).resolves.toEqual(state);
  await expect(saveDesignerStateHandler(window as never, trustedUrl, () => workspace, save)(event as never, { workspaceId: 'workspace-1', state })).resolves.toBe(true);
  expect(load).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledWith(workspace, state);
  await expect(loadDesignerStateHandler(window as never, trustedUrl, () => workspace, load)(event as never, 'other')).resolves.toBeNull();
  await expect(saveDesignerStateHandler(window as never, trustedUrl, () => workspace, save)(event as never, { workspaceId: 'other', state })).resolves.toBe(false);
});
it('does not expose channel handlers to an untrusted renderer frame', async () => {
  const { window, event, trustedUrl } = createFixture();
  const load = vi.fn(async () => ({ profiles: [], defaultId: 'builtin-v1' }));
  const untrustedEvent = { ...event, senderFrame: { url: 'file:///app/evil.html' } };
  await expect(loadDesignerStateHandler(window as never, trustedUrl, () => ({ workspace: { workspaceId: 'workspace-1' } }) as never, load)(untrustedEvent as never, 'workspace-1')).resolves.toBeNull();
  expect(load).not.toHaveBeenCalled();
  expect(designerLoadChannel).toBe('designer:load-state');
  expect(designerSaveChannel).toBe('designer:save-state');
});
