import type { ImageToolItem, ImageToolJob } from './jobs';
import {
  filterImageToolJobs,
  getImageToolJobProgress,
  getImageToolJobContentName,
  isImageToolJobActive,
  pathConflicts,
} from './view-model';

const makeJob = (id: string, state: ImageToolJob['state']): ImageToolJob => ({
  id,
  tool: 'resize',
  params: {},
  sourceRoot: '/tmp/\${id}',
  outputRoot: '/tmp/\${id}-out',
  state,
  itemIds: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const makeItem = (jobId: string, id: string, relativePath: string, state: ImageToolItem['state']): ImageToolItem => ({
  id,
  jobId,
  relativePath,
  state,
  attempt: 1,
  updatedAt: '2026-10-01T00:00:00.000Z',
});

describe('image tools view model helpers', () => {
  it('calculates progress and a compact content name from item paths', () => {
    const items = [
      makeItem('job-1', 'item-1', 'nested/alpha.png', 'completed'),
      makeItem('job-1', 'item-2', 'nested/beta.png', 'queued'),
    ];

    expect(getImageToolJobProgress(items)).toEqual({ completed: 1, total: 2, percent: 50 });
    expect(getImageToolJobContentName(items, 'job-1')).toEqual({
      full: 'alpha.png、beta.png',
      display: 'alpha.p...',
    });
  });

  it('filters active, recent, and archived jobs without mutating input', () => {
    const jobs = [
      { job: makeJob('active', 'running'), items: [] },
      { job: makeJob('recent', 'completed'), items: [] },
      { job: makeJob('archived', 'cancelled'), items: [] },
    ];

    expect(filterImageToolJobs(jobs, 'active').map(({ job }) => job.id)).toEqual(['active']);
    expect(filterImageToolJobs(jobs, 'recent').map(({ job }) => job.id)).toEqual(['recent']);
    expect(filterImageToolJobs(jobs, 'archived').map(({ job }) => job.id)).toEqual(['archived']);
    expect(jobs.map(({ job }) => job.id)).toEqual(['active', 'recent', 'archived']);
    expect(isImageToolJobActive('unknown')).toBe(true);
  });

  it('rejects source/output paths that overlap after normalization', () => {
    expect(pathConflicts('/Users/A/Source', '/Users/A/Source/out')).toBe(true);
    expect(pathConflicts('/Users/A/Source', '/Users/A/Output')).toBe(false);
    expect(pathConflicts('C:\\Source', 'c:/source')).toBe(true);
  });
});
