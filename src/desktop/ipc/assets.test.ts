import { expect, it, vi } from 'vitest';

import { assetImportChannel, assetListChannel, assetReadChannel, importAssetsHandler, listAssetsHandler, readAssetHandler } from './assets';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('exposes stable asset channels and gates list/import on the trusted workspace', async () => {
  expect(assetListChannel).toBe('asset:list');
  expect(assetImportChannel).toBe('asset:import');
  expect(assetReadChannel).toBe('asset:read');
  const { window, event, trustedUrl } = createFixture();
  const workspace = { library: { libraryId: 'workspace-1' } } as never;
  const listAssets = vi.fn(async () => []);
  const importAssets = vi.fn(async () => []);
  const readAsset = vi.fn(async () => new Uint8Array([1, 2, 3]));

  await expect(listAssetsHandler(window as never, trustedUrl, () => workspace, listAssets)(event as never, { libraryId: 'workspace-1', projectId: 'project-1' })).resolves.toEqual([]);
  await expect(importAssetsHandler(window as never, trustedUrl, () => workspace, importAssets)(event as never, { libraryId: 'workspace-1', projectId: 'project-1', items: [] })).resolves.toEqual([]);
  await expect(readAssetHandler(window as never, trustedUrl, () => workspace, readAsset)(event as never, { libraryId: 'workspace-1', projectId: 'project-1', assetId: 'asset-1' })).resolves.toEqual(new Uint8Array([1, 2, 3]));
  expect(listAssets).toHaveBeenCalledOnce();
  expect(importAssets).toHaveBeenCalledOnce();
  expect(readAsset).toHaveBeenCalledOnce();

  const untrustedEvent = { ...event, senderFrame: { url: 'file:///app/evil.html' } };
  await expect(listAssetsHandler(window as never, trustedUrl, () => workspace, listAssets)(untrustedEvent as never, { libraryId: 'workspace-1', projectId: 'project-1' })).resolves.toBeNull();
  await expect(importAssetsHandler(window as never, trustedUrl, () => workspace, importAssets)(untrustedEvent as never, { libraryId: 'workspace-1', projectId: 'project-1', items: [] })).resolves.toBeNull();
  await expect(readAssetHandler(window as never, trustedUrl, () => workspace, readAsset)(untrustedEvent as never, { libraryId: 'workspace-1', projectId: 'project-1', assetId: 'asset-1' })).resolves.toBeNull();
});

it('rejects malformed bridge payloads before invoking storage', async () => {
  const { window, event, trustedUrl } = createFixture();
  const workspace = { library: { libraryId: 'workspace-1' } } as never;
  const listAssets = vi.fn(async () => []);
  const importAssets = vi.fn(async () => []);
  const readAsset = vi.fn(async () => null);
  await expect(listAssetsHandler(window as never, trustedUrl, () => workspace, listAssets)(event as never, { libraryId: '', projectId: 'project-1' })).resolves.toBeNull();
  await expect(importAssetsHandler(window as never, trustedUrl, () => workspace, importAssets)(event as never, { libraryId: 'workspace-1', projectId: 'project-1', items: 'nope' })).resolves.toBeNull();
  await expect(readAssetHandler(window as never, trustedUrl, () => workspace, readAsset)(event as never, { libraryId: 'workspace-1', projectId: 'project-1', assetId: '' })).resolves.toBeNull();
  expect(listAssets).not.toHaveBeenCalled();
  expect(importAssets).not.toHaveBeenCalled();
  expect(readAsset).not.toHaveBeenCalled();
});
