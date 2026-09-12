import { expect, it } from 'vitest';

import { createEditSession } from '../../src/features/canvas/EditSession';

const base = { id: 'scene-1', value: 0 };

it('keeps a draft separate from committed revisions until a batch is committed', async () => {
  const session = createEditSession(base, { projectId: 'p1', documentId: 'd1', sceneAssetId: 'scene-1' });
  session.update({ value: 1 });
  expect(session.getDraft()).toEqual({ id: 'scene-1', value: 1 });
  expect(session.getCommittedRevisionId()).toBeNull();
  const result = await session.commitBatch('move-1');
  expect(result.revisionId).toBeTypeOf('string');
  expect(session.getCommittedRevisionId()).toBe(result.revisionId);
});

it('groups a batch for undo/redo and restores only persisted drafts', () => {
  const session = createEditSession(base, { projectId: 'p1', documentId: 'd2', sceneAssetId: 'scene-1' });
  session.beginBatch('drag');
  session.update({ value: 1 });
  session.update({ value: 2 });
  session.endBatch();
  expect(session.undo()).toEqual(base);
  expect(session.redo()).toEqual({ id: 'scene-1', value: 2 });
  session.persistDraft();
  session.update({ value: 3 });
  expect(session.recover()).toEqual({ id: 'scene-1', value: 2 });
});

it('does not apply stale AI results or writes in a read-only session', () => {
  const session = createEditSession(base, { projectId: 'p1', documentId: 'd3', sceneAssetId: 'scene-1', readOnly: true });
  expect(() => session.update({ value: 1 })).toThrow('READ_ONLY');
  expect(session.applyAiResult({ id: 'scene-1', value: 2 }, 'stale-token')).toBe(false);
  expect(session.getDraft()).toEqual(base);
});
