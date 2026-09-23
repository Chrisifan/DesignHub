// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createTaskRuntime } from '../../src/features/tasks/runtime';
import { createDesignGenerationSlots, type TaskRecord } from '../../src/features/tasks/state';
import { loadTaskState, saveTaskState } from '../../src/desktop/storage/task-store';
import { initializeProjectLibrary, openProjectLibrary } from '../../src/desktop/storage/project-library-store';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('recovers unfinished generation slots without losing successful or legacy candidates', async () => {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'designhub-generation-batch-'));
  temporaryDirectories.push(parentDirectory);
  const workspace = await initializeProjectLibrary(parentDirectory);
  const slots = createDesignGenerationSlots();
  slots[0] = { ...slots[0]!, state: 'completed', assetId: 'asset-primary', candidateId: 'candidate-design-batch-1-primary', cost: 0.1 };
  slots[1] = { ...slots[1]!, state: 'running' };
  slots[2] = { ...slots[2]!, state: 'failed', errorCode: 'PROVIDER_REQUEST_FAILED' };
  const batch: TaskRecord = {
    id: 'design-batch-1', requestId: 'request-batch-1', state: 'running', cancelRequested: false, attempt: 1,
    source: { kind: 'project', id: 'project-1' }, documentId: 'document-1', capability: 'design-generation',
    generationSlots: slots,
    result: {
      candidates: [{
        id: 'candidate-design-batch-1-primary', baseRevisionId: null, assetIds: ['asset-primary'], sceneAssetId: 'asset-primary', createdAt: '2026-09-20T00:00:00.000Z',
      }],
      assetIds: ['asset-primary'], imageCount: 1, cost: 0.1,
    },
  };
  const legacy: TaskRecord = {
    id: 'design-legacy', requestId: 'request-legacy', state: 'completed', cancelRequested: false, attempt: 1,
    result: { candidate: { id: 'candidate-legacy', baseRevisionId: null, assetIds: ['asset-legacy'], createdAt: '2026-09-19T00:00:00.000Z' } },
  };
  await saveTaskState(workspace, workspace.library.libraryId, [batch, legacy]);
  workspace.close();

  const reopened = await openProjectLibrary(parentDirectory);
  try {
    const loaded = await loadTaskState(reopened, reopened.library.libraryId);
    const recovered = createTaskRuntime({ initialTasks: loaded });
    expect(recovered.get('design-batch-1')).toMatchObject({
      state: 'completed',
      result: { candidates: [expect.objectContaining({ id: 'candidate-design-batch-1-primary' })] },
    });
    expect(recovered.get('design-batch-1')?.generationSlots?.find((slot) => slot.id === 'primary')).toMatchObject({ state: 'completed' });
    expect(recovered.get('design-batch-1')?.generationSlots?.find((slot) => slot.id === 'composition')).toMatchObject({ state: 'failed', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' });
    expect(recovered.get('design-batch-1')?.generationSlots?.find((slot) => slot.id === 'expressive')).toMatchObject({ state: 'failed', errorCode: 'PROVIDER_REQUEST_FAILED' });
    expect(recovered.get('design-legacy')).toEqual(legacy);
    expect(() => recovered.retryGenerationSlot('design-batch-1', 'primary')).toThrow('GENERATION_SLOT_NOT_RETRYABLE');
    expect(recovered.retryGenerationSlot('design-batch-1', 'composition')).toMatchObject({ state: 'running' });
  } finally {
    reopened.close();
  }
});
