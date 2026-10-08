import { describe, expect, it, vi } from 'vitest';

import { createRevisionStore } from '../revisions/model';
import { createTaskRuntime } from '../tasks/runtime';
import type { TaskRecord } from '../tasks/state';
import { createScene } from '../canvas/scene';
import { createTaskCandidateService } from './task-candidate-service';
import { createTaskExecutor } from './task-executor';
import { createTaskRecovery } from './task-recovery';
import { createTaskRuntimeAdapter } from './task-runtime-adapter';

const task = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'task-1',
  requestId: 'request-1',
  state: 'running',
  cancelRequested: false,
  attempt: 1,
  source: { kind: 'project', id: 'project-1' },
  documentId: 'document-1',
  ...overrides,
});

describe('task execution chain boundaries', () => {
  it('executes a provider operation exactly once without implicit retry or fallback', async () => {
    const providerCalls: string[] = [];
    const fallbackCalls: string[] = [];
    const executor = createTaskExecutor({
      resolveProvider: async (connectionId) => ({
        execute: async () => {
          providerCalls.push(connectionId);
          throw new Error('PROVIDER_REQUEST_FAILED');
        },
      }),
      resolveFallback: async () => ({
        execute: async () => {
          fallbackCalls.push('fallback');
          return { value: 'unexpected' };
        },
      }),
    });

    await expect(executor.execute({
      executor: { kind: 'provider', connectionId: 'provider-1', modelId: 'model-1' },
      request: { prompt: 'test' },
    })).rejects.toThrow('PROVIDER_REQUEST_FAILED');
    expect(providerCalls).toEqual(['provider-1']);
    expect(fallbackCalls).toEqual([]);
  });

  it('retries only when explicitly requested and keeps the persisted request metadata', async () => {
    const runtime = createTaskRuntime({ initialTasks: [task({ state: 'unknown', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART', sourceAssetId: 'source-1', maskAssetId: 'mask-1', model: 'model-1', tool: 'remove-background', toolParams: { mode: 'transparent' } })] });
    const execute = vi.fn(async (record: TaskRecord) => record);
    const recovery = createTaskRecovery({ runtime, executeRetry: execute });

    expect(execute).not.toHaveBeenCalled();
    const retried = await recovery.retryExplicitly('task-1');
    expect(retried).toMatchObject({ state: 'queued', attempt: 2, sourceAssetId: 'source-1', maskAssetId: 'mask-1', model: 'model-1', tool: 'remove-background' });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ sourceAssetId: 'source-1', maskAssetId: 'mask-1', model: 'model-1', tool: 'remove-background' }));
  });

  it('distinguishes local cancellation from unsupported remote cancellation', async () => {
    const runtime = createTaskRuntime({ initialTasks: [task()] });
    const controllers = new Map<string, AbortController>();
    const adapter = createTaskRuntimeAdapter({ runtime, controllers });

    const result = adapter.cancel('task-1');
    expect(result?.cancelRequested).toBe(true);
    await expect(adapter.cancelRemote(task())).resolves.toEqual({ status: 'unsupported' });
  });

  it('uses remote cancellation and status query only when the task advertises both capabilities', async () => {
    const runtime = createTaskRuntime();
    const remoteCancel = vi.fn(async () => undefined);
    const remoteQuery = vi.fn(async () => 'running' as const);
    const adapter = createTaskRuntimeAdapter({ runtime, cancelRemote: remoteCancel, queryRemote: remoteQuery });
    const remoteTask = task({ remoteRequestId: 'remote-1', remoteSupportsCancellation: true, remoteSupportsStatusQuery: true });

    await expect(adapter.cancelRemote(remoteTask)).resolves.toEqual({ status: 'cancelled', remoteRequestId: 'remote-1' });
    await expect(adapter.queryRemote(remoteTask)).resolves.toBe('running');
    expect(remoteCancel).toHaveBeenCalledWith(remoteTask);
    expect(remoteQuery).toHaveBeenCalledWith(remoteTask);
  });

  it('confirms one tool candidate idempotently and never commits discarded candidates', async () => {
    const runtime = createTaskRuntime({ initialTasks: [task({
      state: 'completed',
      result: {
        toolCandidate: {
          taskId: 'task-1',
          tool: 'remove-background',
          sourceAssetId: 'source-1',
          baseRevisionId: null,
          resultAssetId: 'result-1',
          beforeScene: createScene({ id: 'before', width: 100, height: 100, layers: [] }),
          candidateScene: createScene({ id: 'candidate', width: 100, height: 100, layers: [] }),
        },
      },
    })] });
    const revisionStore = createRevisionStore();
    const service = createTaskCandidateService({ runtime, revisionStore });

    const first = await service.confirm('task-1', 'request-1');
    const second = await service.confirm('task-1', 'request-1');
    expect(first.revisionId).toBe(second.revisionId);
    expect(revisionStore.listRevisions('document-1')).toHaveLength(1);
    await expect(service.discard('task-1')).resolves.toBeUndefined();
  });
});
