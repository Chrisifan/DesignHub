import { expect, it, vi } from 'vitest';

import type { Brand } from '../../features/brands/constraints';
import { brandLoadChannel, brandSaveChannel, loadBrandStateHandler, saveBrandStateHandler } from './brands';

const workspace = { library: { libraryId: 'workspace-1', directory: '/tmp/studio', formatVersion: 1, openMode: 'writable' as const }, close: vi.fn() };
const sender = { mainFrame: { url: 'http://localhost:5173/' }, getURL: () => 'http://localhost:5173/' };
const event = { sender, senderFrame: sender.mainFrame };
const window = { webContents: event.sender };
const brand: Brand = { id: 'spring', version: 'v1', logo: 'mark', colorPalette: ['#fff'], fonts: ['Geist'], tone: 'Calm', fixedCopy: 'Hello', sizes: ['1080x1440'] };

it('exposes trusted load/save channels and blocks untrusted requests', async () => {
  expect(brandLoadChannel).toBe('brand:load-state');
  expect(brandSaveChannel).toBe('brand:save-state');
  const load = vi.fn(async () => ({ brands: [brand] }));
  await expect(loadBrandStateHandler(window, 'http://localhost:5173/', () => workspace, load)(event, 'workspace-1')).resolves.toEqual({ brands: [brand] });
  const untrusted = { ...event, senderFrame: { url: 'https://evil.test' } };
  await expect(loadBrandStateHandler(window, 'http://localhost:5173/', () => workspace, load)(untrusted, 'workspace-1')).resolves.toBeNull();
});

it('rejects malformed saves and read-only writes before storage', async () => {
  const save = vi.fn(async () => true);
  const handler = saveBrandStateHandler(window, 'http://localhost:5173/', () => workspace, save);
  await expect(handler(event, { workspaceId: 'workspace-1', state: { brands: [brand] } })).resolves.toBe(true);
  await expect(handler(event, { workspaceId: 'workspace-1', state: { brands: [{ id: '' }] } })).resolves.toBe(false);
  const readOnly = { ...workspace, library: { ...workspace.library, openMode: 'read-only' as const } };
  await expect(saveBrandStateHandler(window, 'http://localhost:5173/', () => readOnly, save)(event, { workspaceId: 'workspace-1', state: { brands: [brand] } })).resolves.toBe(false);
  expect(save).toHaveBeenCalledTimes(1);
});
