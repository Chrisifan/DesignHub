import { expect, it, vi } from 'vitest';

import { createRevisionStore } from '../revisions/model';
import { applyToolResult } from './result-application';

it('commits a completed tool result as a candidate revision with asset references', async () => {
  const store = createRevisionStore();
  const result = await applyToolResult({
    status: 'completed', projectId: 'project-1', documentId: 'doc-1', baseRevisionId: null,
    operationId: 'tool-1', sceneAssetId: 'scene-result', assetIds: ['asset-result'], revisionStore: store,
  });
  expect(result?.revisionId).toBeTruthy();
  expect(store.listRevisions('doc-1')[0]).toMatchObject({ sceneAssetId: 'scene-result', assetIds: ['asset-result'] });
});

it('does not create a revision when a tool is cancelled or failed', async () => {
  const store = createRevisionStore();
  const commit = vi.spyOn(store, 'commitRevision');
  await expect(applyToolResult({ status: 'cancelled', projectId: 'project-1', documentId: 'doc-1', baseRevisionId: null, operationId: 'tool-cancelled', sceneAssetId: 'late-scene', revisionStore: store })).resolves.toBeNull();
  await expect(applyToolResult({ status: 'failed', projectId: 'project-1', documentId: 'doc-1', baseRevisionId: null, operationId: 'tool-failed', sceneAssetId: 'late-scene', revisionStore: store })).resolves.toBeNull();
  expect(commit).not.toHaveBeenCalled();
});
