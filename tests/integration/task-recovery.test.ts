import { expect, it } from 'vitest';
import { createRevisionStore } from '../../src/features/revisions/model';
import { createTaskRuntime } from '../../src/features/tasks/runtime';

it('repeated completion callback commits one revision only', async () => {
  const runtime = createTaskRuntime();
  const store = createRevisionStore();
  runtime.start({ id: 'task-1', requestId: 'request-1', source: { kind: 'project', id: 'project-1' }, documentId: 'doc-1', baseRevisionId: null });
  await runtime.finish('task-1', { sceneAssetId: 'scene-2' }, store);
  await runtime.finish('task-1', { sceneAssetId: 'scene-2' }, store);
  expect(store.listRevisions('doc-1')).toHaveLength(1);
});
