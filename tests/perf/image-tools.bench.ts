import { describe, expect, it } from 'vitest';

import { filterImageToolJobs } from '../../src/features/image-tools/view-model';
import { createImageToolJobFixture } from '../fixtures/image-tool-job';

describe('image tools performance budget', () => {
  it('indexes 1000 persisted job snapshots within one second', () => {
    const jobs = Array.from({ length: 1000 }, (_, index) => {
      const fixture = createImageToolJobFixture({ id: `perf-job-${index}` });
      return fixture;
    });
    const startedAt = performance.now();
    const indexed = filterImageToolJobs(jobs, 'all');
    const elapsed = performance.now() - startedAt;
    console.info(`[perf] image-tool-index-1000: ${elapsed.toFixed(2)}ms`);
    expect(indexed).toHaveLength(1000);
    expect(elapsed).toBeLessThan(1000);
  });
});
