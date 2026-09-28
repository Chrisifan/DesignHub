import { describe, expect, it } from 'vitest';

import { aggregateImageToolJobState, canRetryImageToolItem, createImageToolJob, retryImageToolItem, validateRelativePath, type ImageToolItem } from './jobs';

const item = (state: ImageToolItem['state']): ImageToolItem => ({ id: `item-${state}`, jobId: 'job-1', relativePath: 'nested/source.png', state, attempt: 1, updatedAt: '2026-09-28T00:00:00.000Z' });

describe('image tool jobs', () => {
  it('rejects absolute, parent-traversing, control-character and empty paths', () => {
    expect(validateRelativePath('nested/source.png')).toBe(true);
    expect(validateRelativePath('../source.png')).toBe(false);
    expect(validateRelativePath('nested/../../source.png')).toBe(false);
    expect(validateRelativePath('/tmp/source.png')).toBe(false);
    expect(validateRelativePath('C:\\source.png')).toBe(false);
    expect(validateRelativePath('nested/\u0000source.png')).toBe(false);
    expect(validateRelativePath('CON.png')).toBe(false);
    expect(validateRelativePath('')).toBe(false);
  });

  it('creates a queued job with independent source and output roots', () => {
    expect(createImageToolJob({ id: 'job-1', tool: 'remove-background', params: {}, sourceRoot: '/tmp/source', outputRoot: '/tmp/output', itemIds: [] })).toMatchObject({ id: 'job-1', state: 'queued' });
    expect(() => createImageToolJob({ id: 'job-1', tool: 'remove-background', params: {}, sourceRoot: '/tmp/same', outputRoot: '/tmp/same', itemIds: [] })).toThrow('IMAGE_TOOL_JOB_ROOTS_INVALID');
  });

  it('aggregates item state without hiding partial failures or unknown results', () => {
    expect(aggregateImageToolJobState([item('queued'), item('completed')])).toBe('queued');
    expect(aggregateImageToolJobState([item('running'), item('failed')])).toBe('running');
    expect(aggregateImageToolJobState([item('unknown'), item('completed')])).toBe('unknown');
    expect(aggregateImageToolJobState([item('failed'), item('completed')])).toBe('failed');
    expect(aggregateImageToolJobState([item('completed'), item('completed')])).toBe('completed');
  });

  it('only retries terminal or unknown items and clears stale output', () => {
    expect(canRetryImageToolItem(item('running'))).toBe(false);
    expect(retryImageToolItem({ ...item('unknown'), resultPath: '/tmp/output/source.png', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART' })).toMatchObject({ state: 'queued', attempt: 2, resultPath: undefined, errorCode: undefined });
  });
});
