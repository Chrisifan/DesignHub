import { describe, expect, it } from 'vitest';

import { createScene } from '../../features/canvas/scene';
import type { DesignSceneCandidate } from '../../features/composition/design-scene-candidate';
import type { TaskCandidate, TaskRecord, ToolCandidate } from '../../features/tasks/state';
import {
  findCandidateById,
  findToolCandidate,
  getCompletedCandidates,
  getUnresolvedEntryCandidate,
  resolveCandidateScene,
  taskCandidates,
} from './candidate-controller';

const baseScene = createScene({ id: 'base', width: 100, height: 200, layers: [] });

const makeTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'task-1',
  requestId: 'request-1',
  state: 'completed',
  cancelRequested: false,
  attempt: 1,
  capability: 'design-generation',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const makeCandidate = (overrides: Partial<TaskCandidate> = {}): TaskCandidate => ({
  id: 'candidate-1',
  baseRevisionId: null,
  assetIds: ['asset-1'],
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

describe('candidate controller', () => {
  it('normalizes legacy single candidates and prefers explicit candidate arrays', () => {
    const legacy = makeCandidate({ id: 'legacy' });
    const explicit = makeCandidate({ id: 'explicit' });

    expect(taskCandidates(makeTask({ result: { candidate: legacy } }))).toEqual([legacy]);
    expect(taskCandidates(makeTask({ result: { candidate: legacy, candidates: [explicit] } }))).toEqual([explicit]);
    expect(taskCandidates(makeTask())).toEqual([]);
  });

  it('filters completed design candidates to the active base and ranks newest slot order', () => {
    const oldBase = makeCandidate({ id: 'old-base', baseRevisionId: 'rev-old' });
    const expressive = makeCandidate({ id: 'expressive', createdAt: '2026-10-02T00:00:00.000Z' });
    const primary = makeCandidate({ id: 'primary', createdAt: '2026-10-02T00:00:00.000Z' });
    const tasks = [
      makeTask({ id: 'old', result: { candidates: [oldBase] } }),
      makeTask({
        id: 'new',
        generationSlots: [
          { id: 'expressive', direction: '', state: 'completed', attempt: 1, candidateId: expressive.id },
          { id: 'primary', direction: '', state: 'completed', attempt: 1, candidateId: primary.id },
        ],
        result: { candidates: [expressive, primary] },
      }),
    ];

    expect(getCompletedCandidates(tasks, 'rev-active').map(({ candidate }) => candidate.id)).toEqual([]);
    expect(getCompletedCandidates(tasks, null).map(({ candidate }) => candidate.id)).toEqual(['primary', 'expressive', 'old-base']);
  });

  it('selects entry candidate scenes, tool scenes, and raster candidate scenes consistently', () => {
    const entryCandidate: DesignSceneCandidate = {
      id: 'entry', sourceTaskId: 'local-task', mode: 'structured', editable: true,
      scene: createScene({ id: 'entry-scene', width: 100, height: 200, layers: [] }),
      assets: [{ assetId: 'entry-asset', role: 'core' }], createdAt: '2026-10-01T00:00:00.000Z',
    };
    const toolCandidate: ToolCandidate = {
      taskId: 'tool-task', tool: 'resize', sourceAssetId: 'before', baseRevisionId: null, resultAssetId: 'after',
      beforeScene: baseScene, candidateScene: createScene({ id: 'tool-scene', width: 100, height: 200, layers: [] }),
    };
    const raster = makeCandidate({ id: 'raster', sceneAssetId: 'raster-asset' });
    const tasks = [
      makeTask({ id: 'tool-task', capability: 'image-editing', result: { toolCandidate } }),
      makeTask({ id: 'raster-task', result: { candidates: [raster] } }),
    ];

    expect(resolveCandidateScene({ entryCandidate, selectedCandidateId: null, toolCandidateTaskId: null, tasks, baseScene })).toBe(entryCandidate.scene);
    expect(resolveCandidateScene({ selectedCandidateId: null, toolCandidateTaskId: 'tool-task', tasks, baseScene })).toBe(toolCandidate.candidateScene);
    const generated = resolveCandidateScene({ selectedCandidateId: 'raster', toolCandidateTaskId: null, tasks, baseScene });
    expect(generated?.layers[0]).toMatchObject({ assetId: 'raster-asset', width: 100, height: 200 });
    expect(resolveCandidateScene({ selectedCandidateId: 'missing', toolCandidateTaskId: null, tasks, baseScene })).toBeNull();
  });

  it('finds only unresolved project composition candidates, newest first', () => {
    const valid: DesignSceneCandidate = {
      id: 'valid', sourceTaskId: 'valid-task', mode: 'structured', editable: true, scene: baseScene,
      assets: [{ assetId: 'asset', role: 'core' }], createdAt: '2026-10-01T00:00:00.000Z',
    };
    const newer = { ...valid, id: 'newer', sourceTaskId: 'newer-task', createdAt: '2026-10-02T00:00:00.000Z' };
    const tasks = [
      makeTask({ id: 'wrong-project', capability: 'local-composition', source: { kind: 'project', id: 'other' }, documentId: 'doc', result: { compositionCandidate: newer } }),
      makeTask({ id: 'old-valid', capability: 'local-composition', source: { kind: 'project', id: 'project' }, documentId: 'doc', createdAt: '2026-10-01T00:00:00.000Z', result: { compositionCandidate: valid } }),
      makeTask({ id: 'new-valid', capability: 'local-composition', source: { kind: 'project', id: 'project' }, documentId: 'doc', createdAt: '2026-10-02T00:00:00.000Z', result: { compositionCandidate: newer } }),
    ];

    expect(getUnresolvedEntryCandidate(tasks, 'project', 'doc')).toEqual({ task: tasks[2], candidate: newer });
  });

  it('resolves candidate and tool lookups without coupling callers to task result shape', () => {
    const candidate = makeCandidate();
    const toolCandidate = { taskId: 'tool', tool: 'resize' as const, sourceAssetId: 'before', baseRevisionId: null, resultAssetId: 'after', beforeScene: baseScene, candidateScene: baseScene };
    const tasks = [makeTask({ id: 'candidate-task', result: { candidates: [candidate] } }), makeTask({ id: 'tool', capability: 'image-editing', result: { toolCandidate } })];

    expect(findCandidateById(tasks, candidate.id)).toEqual({ task: tasks[0], candidate });
    expect(findToolCandidate(tasks, 'tool')).toEqual({ task: tasks[1], candidate: toolCandidate });
    expect(findToolCandidate(tasks, 'candidate-task')).toEqual({ task: tasks[0], candidate });
  });
});
