import { expect, it, vi } from 'vitest';

import { loadSettingsHandler, saveSettingsHandler, settingsLoadChannel, settingsSaveChannel } from './settings';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('keeps workspace settings behind the trusted active workspace', async () => {
  expect(settingsLoadChannel).toBe('workspace:settings-load');
  expect(settingsSaveChannel).toBe('workspace:settings-save');
  const { window, event, trustedUrl } = createFixture();
  const workspace = { library: { libraryId: 'workspace-1' } } as never;
  const settings = { formatVersion: 1, backup: { destinationParentDirectory: '/tmp', schedule: 'daily', lastRunAt: null, lastArtifactPath: null } } as const;
  const load = vi.fn(async () => settings);
  const save = vi.fn(async () => true);

  await expect(loadSettingsHandler(window as never, trustedUrl, () => workspace, load)(event as never, 'workspace-1')).resolves.toEqual(settings);
  await expect(saveSettingsHandler(window as never, trustedUrl, () => workspace, save)(event as never, { libraryId: 'workspace-1', settings })).resolves.toBe(true);
  expect(load).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledOnce();
});

it('rejects malformed input and untrusted senders', async () => {
  const { window, event, trustedUrl } = createFixture();
  const workspace = { library: { libraryId: 'workspace-1' } } as never;
  const load = vi.fn(async () => null);
  const save = vi.fn(async () => true);
  const untrustedEvent = { ...event, senderFrame: { url: 'file:///app/evil.html' } };

  await expect(loadSettingsHandler(window as never, trustedUrl, () => workspace, load)(event as never, '')).resolves.toBeNull();
  await expect(loadSettingsHandler(window as never, trustedUrl, () => workspace, load)(untrustedEvent as never, 'workspace-1')).resolves.toBeNull();
  await expect(saveSettingsHandler(window as never, trustedUrl, () => workspace, save)(event as never, { libraryId: 'workspace-1', settings: {} })).resolves.toBe(false);
  expect(load).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
