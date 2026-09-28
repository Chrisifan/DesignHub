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
