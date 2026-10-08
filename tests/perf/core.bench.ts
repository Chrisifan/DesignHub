import { describe, expect, it } from 'vitest';

import { createTaskRuntime } from '../../src/features/tasks/runtime';
import { filterImageToolJobs } from '../../src/features/image-tools/view-model';
import type { ImageToolItem, ImageToolJob } from '../../src/features/image-tools/jobs';

const timestamp = '2026-10-06T00:00:00.000Z';

const taskRuntime = createTaskRuntime();
for (let index = 0; index < 100; index += 1) {
  taskRuntime.start({
    id: `perf-task-${index}`,
    requestId: `perf-request-${index}`,
    requestText: `task ${index}`,
    providerId: 'perf-provider',
    capability: 'conversation',
    createdAt: timestamp,
  });
}

const jobs: Array<{ job: ImageToolJob; items: ImageToolItem[] }> = Array.from({ length: 1000 }, (_, index) => ({
  job: {
    id: `perf-job-${index}`,
    tool: 'resize',
    params: { width: 1024, height: 1024 },
    sourceRoot: `/tmp/source-${index}`,
    outputRoot: `/tmp/output-${index}`,
    state: index % 5 === 0 ? 'completed' : 'queued',
    itemIds: [`perf-item-${index}`],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  items: [{
    id: `perf-item-${index}`,
    jobId: `perf-job-${index}`,
    relativePath: 'image.png',
    state: index % 5 === 0 ? 'completed' : 'queued',
    attempt: 1,
    updatedAt: timestamp,
  }],
}));

describe('DesignHub optimization baseline', () => {
  it('loads 100 task history records within the optimization budget', () => {
    const startedAt = performance.now();
    const snapshot = taskRuntime.list();
    if (snapshot.length !== 100) throw new Error(`expected 100 tasks, received ${snapshot.length}`);
    const elapsed = performance.now() - startedAt;
    console.info(`[perf] task-history-100: ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(500);
  });

  it('indexes 1000 image tool jobs within the optimization budget', () => {
    const startedAt = performance.now();
    const indexed = filterImageToolJobs(jobs, 'all');
    if (indexed.length !== 1000) throw new Error(`expected 1000 indexed jobs, received ${indexed.length}`);
    const elapsed = performance.now() - startedAt;
    console.info(`[perf] image-tool-index-1000: ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(1000);
  });
});
