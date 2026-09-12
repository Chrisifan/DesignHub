import { expect, it, vi } from 'vitest';

import { commitRevisionHandler, loadRevisionsHandler, revisionCommitChannel, revisionLoadChannel } from './revisions';

const fixture = () => {
  const frame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame: frame, getURL: () => frame.url } };
  return { window, event: { sender: window.webContents, senderFrame: frame }, trustedUrl: frame.url };
};

it('gates revision IPC on trusted workspace identity', async () => {
  expect(revisionLoadChannel).toBe('revision:load');
  expect(revisionCommitChannel).toBe('revision:commit');
  const { window, event, trustedUrl } = fixture();
  const workspace = { workspace: { workspaceId: 'workspace-1', openMode: 'writable' } } as never;
  const load = vi.fn(async () => ({ revisions: [], timeline: [], finalRevisionId: null }));
  await expect(loadRevisionsHandler(window as never, trustedUrl, () => workspace, load)(event as never, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1' })).resolves.toEqual({ revisions: [], timeline: [], finalRevisionId: null });
  await expect(loadRevisionsHandler(window as never, trustedUrl, () => workspace, load)(event as never, { workspaceId: 'other', projectId: 'project-1', documentId: 'doc-1' })).resolves.toBeNull();
});

it('rejects revision writes in a read-only workspace before invoking storage', async () => {
  const { window, event, trustedUrl } = fixture();
  const commit = vi.fn(async () => ({ revisionId: 'revision-1' }));
  const readOnly = { workspace: { workspaceId: 'workspace-1', openMode: 'read-only' } } as never;
  await expect(commitRevisionHandler(window as never, trustedUrl, () => readOnly, commit)(event as never, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'doc-1', baseRevisionId: null, operationId: 'op-1', sceneAssetId: 'scene-1', assetIds: [], contributions: [] })).resolves.toBeNull();
  expect(commit).not.toHaveBeenCalled();
});
