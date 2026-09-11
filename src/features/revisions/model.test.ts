import { expect, it } from 'vitest';

import { branchRevision, createRevisionStore, type CommitRevisionInput } from './model';

it('branches from a base revision without mutating the base', () => {
  const base = { id: 'r1', documentId: 'd1' };

  expect(branchRevision(base, 'r3')).toEqual({ id: 'r3', documentId: 'd1', parentId: 'r1' });
  expect(base).toEqual({ id: 'r1', documentId: 'd1' });
});

it('commits an immutable snapshot and reuses the revision for duplicate operation ids', async () => {
  const store = createRevisionStore();
  const contributions = [{ designerVersionId: 'designer-v1', role: 'lead' as const, designerName: 'Mina' }];
  const input: CommitRevisionInput = {
    projectId: 'p1',
    documentId: 'd1',
    baseRevisionId: null,
    operationId: 'op-1',
    sceneAssetId: 'scene-1',
    assetIds: ['asset-1'],
    contributions,
    operatorName: 'Alex',
  };

  const first = await store.commitRevision(input);
  input.assetIds.push('asset-2');
  contributions[0].designerName = 'Renamed';
  const retry = await store.commitRevision({
    ...input,
    assetIds: ['asset-1'],
    contributions: [{ designerVersionId: 'designer-v1', role: 'lead', designerName: 'Mina' }],
  });
  const stored = store.getRevision(first.revisionId);

  expect(retry).toEqual(first);
  expect(stored).toMatchObject({
    revisionId: first.revisionId,
    assetIds: ['asset-1'],
    contributions: [{ designerVersionId: 'designer-v1', role: 'lead', designerName: 'Mina' }],
    operatorName: 'Alex',
  });
});

it('rejects an operation id reused for another document or payload', async () => {
  const store = createRevisionStore();
  await store.commitRevision({
    projectId: 'p1', documentId: 'd1', baseRevisionId: null, operationId: 'op-conflict',
    sceneAssetId: 'scene-1', assetIds: ['asset-1'], contributions: [],
  });

  await expect(store.commitRevision({
    projectId: 'p2', documentId: 'd2', baseRevisionId: null, operationId: 'op-conflict',
    sceneAssetId: 'scene-2', assetIds: ['asset-2'], contributions: [],
  })).rejects.toThrow('OPERATION_CONFLICT');
});

it('rejects a parent revision from another document', async () => {
  const store = createRevisionStore();
  const parent = await store.commitRevision({
    projectId: 'p1', documentId: 'd1', baseRevisionId: null, operationId: 'op-parent',
    sceneAssetId: 'scene-1', assetIds: [], contributions: [],
  });

  await expect(store.commitRevision({
    projectId: 'p1', documentId: 'd2', baseRevisionId: parent.revisionId, operationId: 'op-child',
    sceneAssetId: 'scene-2', assetIds: [], contributions: [],
  })).rejects.toThrow('DOCUMENT_MISMATCH');
});

it('finalizes only a revision belonging to the document and keeps the pointer stable until changed', async () => {
  const store = createRevisionStore();
  const first = await store.commitRevision({
    projectId: 'p1', documentId: 'd1', baseRevisionId: null, operationId: 'op-final-1',
    sceneAssetId: 'scene-1', assetIds: [], contributions: [],
  });
  const second = await store.commitRevision({
    projectId: 'p1', documentId: 'd1', baseRevisionId: first.revisionId, operationId: 'op-final-2',
    sceneAssetId: 'scene-2', assetIds: [], contributions: [],
  });

  await store.setFinalRevision('d1', first.revisionId);
  expect(store.getFinalRevision('d1')).toBe(first.revisionId);
  expect(store.listTimeline('d1')).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'finalized', revisionId: first.revisionId }),
  ]));
  await store.setFinalRevision('d1', second.revisionId);
  expect(store.getFinalRevision('d1')).toBe(second.revisionId);

  const foreign = await store.commitRevision({
    projectId: 'p1', documentId: 'd2', baseRevisionId: null, operationId: 'op-foreign',
    sceneAssetId: 'scene-foreign', assetIds: [], contributions: [],
  });
  await expect(store.setFinalRevision('d1', foreign.revisionId)).rejects.toThrow('DOCUMENT_MISMATCH');
});

it('does not add designer attribution when a direct tool supplies no contributions', async () => {
  const store = createRevisionStore();
  const result = await store.commitRevision({
    projectId: 'p1', documentId: 'd1', baseRevisionId: null, operationId: 'op-tool',
    sceneAssetId: 'scene-tool', assetIds: ['asset-tool'], contributions: [], operatorName: 'Tool operator',
  });

  expect(store.getRevision(result.revisionId)?.contributions).toEqual([]);
});

it('gives repeated finalization events unique ids even in the same millisecond', async () => {
  const store = createRevisionStore();
  const revision = await store.commitRevision({
    projectId: 'p1', documentId: 'd1', baseRevisionId: null, operationId: 'op-repeat-final',
    sceneAssetId: 'scene-1', assetIds: [], contributions: [],
  });

  const originalNow = Date.now;
  Date.now = () => 1234567890;
  try {
    await store.setFinalRevision('d1', revision.revisionId);
    await store.setFinalRevision('d1', revision.revisionId);
  } finally {
    Date.now = originalNow;
  }

  const finalizedEvents = store.listTimeline('d1').filter((event) => event.kind === 'finalized');
  expect(new Set(finalizedEvents.map((event) => event.id)).size).toBe(2);
});
