import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createImageToolJob } from './jobs';
import { createImageToolJobStore } from './job-store';

it('persists image tool jobs and items for restart recovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-image-jobs-'));
  try {
    const store = createImageToolJobStore(root);
    const job = createImageToolJob({ id: 'job-1', tool: 'resize', params: { width: 800, height: 600 }, sourceRoot: '/input', outputRoot: '/output', itemIds: ['item-1'] });
    await store.save(job, [{ id: 'item-1', jobId: job.id, relativePath: 'nested/photo.png', state: 'queued', attempt: 1, updatedAt: job.updatedAt }]);
    const loaded = await createImageToolJobStore(root).load(job.id);
    expect(loaded).toEqual({ job, items: [{ id: 'item-1', jobId: job.id, relativePath: 'nested/photo.png', state: 'queued', attempt: 1, updatedAt: job.updatedAt }] });
    expect(JSON.parse(await readFile(join(root, 'image-tool-jobs', 'job-1.json'), 'utf8'))).toMatchObject({ job: { id: 'job-1' } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects job items with absolute or escaping paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-image-jobs-'));
  try {
    const store = createImageToolJobStore(root);
    const job = createImageToolJob({ id: 'job-2', tool: 'resize', params: { width: 800, height: 600 }, sourceRoot: '/input', outputRoot: '/output', itemIds: [] });
    await expect(store.save(job, [{ id: 'item-2', jobId: job.id, relativePath: '../escape.png', state: 'queued', attempt: 1, updatedAt: job.updatedAt }])).rejects.toThrow('IMAGE_TOOL_PATH_INVALID');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('migrates legacy snapshots to the current schema', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-image-jobs-migration-'));
  try {
    const store = createImageToolJobStore(root);
    const job = createImageToolJob({ id: 'job-migration', tool: 'resize', params: { width: 800, height: 600 }, sourceRoot: '/input', outputRoot: '/output', itemIds: [] });
    await store.save({ ...job, schemaVersion: undefined }, []);
    await expect(store.load(job.id)).resolves.toMatchObject({ job: { schemaVersion: 2 } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('lists jobs and persists running items as unknown during startup recovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-image-jobs-recovery-'));
  try {
    const store = createImageToolJobStore(root);
    const job = createImageToolJob({ id: 'job-recovery', tool: 'resize', params: { width: 800, height: 600 }, sourceRoot: '/input', outputRoot: '/output', itemIds: ['item-running'] });
    await store.save(job, [{ id: 'item-running', jobId: job.id, relativePath: 'nested/photo.png', state: 'running', attempt: 1, updatedAt: job.updatedAt }]);

    const recovered = await store.recoverOnStartup('2026-10-07T00:00:00.000Z');
    expect(recovered).toEqual([expect.objectContaining({
      job: expect.objectContaining({ id: job.id, state: 'unknown', updatedAt: '2026-10-07T00:00:00.000Z' }),
      items: [expect.objectContaining({ state: 'unknown', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' })],
    })]);
    await expect(store.load(job.id)).resolves.toEqual(recovered[0]);
    await expect(store.list()).resolves.toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects result paths outside the declared output root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-image-jobs-invalid-result-'));
  try {
    const store = createImageToolJobStore(root);
    const job = createImageToolJob({ id: 'job-result-path', tool: 'resize', params: { width: 800, height: 600 }, sourceRoot: '/input', outputRoot: '/output', itemIds: ['item-result'] });
    await expect(store.save(job, [{ id: 'item-result', jobId: job.id, relativePath: 'photo.png', state: 'completed', attempt: 1, resultPath: '/output/../outside.png', updatedAt: job.updatedAt }])).rejects.toThrow('IMAGE_TOOL_PATH_INVALID');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
