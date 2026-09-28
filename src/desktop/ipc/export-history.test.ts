import { expect, it, vi } from 'vitest';

import { listExportHistoryHandler } from './export-history';

const mainFrame = { url: 'http://localhost:5173/?preview=1' };
const sender = { mainFrame, getURL: () => mainFrame.url };
const event = { sender, senderFrame: mainFrame };
const window = { webContents: sender };
const workspace = { library: { libraryId: 'workspace-1' } } as never;

it('lists history only for the trusted active workspace and project', async () => {
  const load = vi.fn(async () => []);
  const handler = listExportHistoryHandler(window, 'http://localhost:5173/?preview=1', () => workspace, load);
  await expect(handler(event, { libraryId: 'workspace-1', projectId: 'project-1' })).resolves.toEqual([]);
  expect(load).toHaveBeenCalledWith(workspace, 'workspace-1', 'project-1');
  await expect(handler(event, { libraryId: 'workspace-2', projectId: 'project-1' })).resolves.toBeNull();
});
