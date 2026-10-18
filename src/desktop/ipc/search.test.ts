import { expect, it, vi } from 'vitest';

import { rebuildSearchHandler, searchQueryHandler, searchQueryChannel, searchRebuildChannel } from './search';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('keeps search rebuild and query behind the active trusted workspace', async () => {
  expect(searchRebuildChannel).toBe('library:search-rebuild');
  expect(searchQueryChannel).toBe('library:search-query');
  const { window, event, trustedUrl } = createFixture();
  const workspace = { library: { libraryId: 'workspace-1' } } as never;
  const rebuild = vi.fn(async () => undefined);
  const search = vi.fn(async () => [{ libraryId: 'workspace-1', projectId: 'p', title: '春间', contributorIds: [] }]);
  await expect(rebuildSearchHandler(window as never, trustedUrl, () => workspace, rebuild)(event as never, { libraryId: 'workspace-1', records: [] })).resolves.toBe(true);
  await expect(searchQueryHandler(window as never, trustedUrl, () => workspace, search)(event as never, { libraryId: 'workspace-1', query: '春' })).resolves.toHaveLength(1);
  expect(rebuild).toHaveBeenCalledOnce();
  expect(search).toHaveBeenCalledWith(workspace, { libraryId: 'workspace-1', query: '春' });
});

it('rejects malformed and untrusted search requests', async () => {
  const { window, event, trustedUrl } = createFixture();
  const workspace = { library: { libraryId: 'workspace-1' } } as never;
  const rebuild = vi.fn(async () => undefined);
  const search = vi.fn(async () => []);
  const untrustedEvent = { ...event, senderFrame: { url: 'file:///app/evil.html' } };
  await expect(rebuildSearchHandler(window as never, trustedUrl, () => workspace, rebuild)(event as never, { libraryId: 'workspace-1', records: 'bad' })).resolves.toBe(false);
  await expect(rebuildSearchHandler(window as never, trustedUrl, () => workspace, rebuild)(event as never, { libraryId: 'workspace-1', records: [{}] })).resolves.toBe(false);
  await expect(searchQueryHandler(window as never, trustedUrl, () => workspace, search)(untrustedEvent as never, { libraryId: 'workspace-1' })).resolves.toBeNull();
  expect(rebuild).not.toHaveBeenCalled();
  expect(search).not.toHaveBeenCalled();
});
